import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AsyncDuckDB, AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import { initDB } from '../data/duckdb';
import { useAppStore } from '../store';
import { getFileFromStorage } from '../data/filePersistence';
import { convertToXLSX } from '../data/exportUtils';
import { globalHistory } from '../utils/historyManager';
import { getAIKey } from '../utils/aiKeyStorage';

// ── Column type system ────────────────────────────────────────────────────────
type ColumnType = 'text' | 'integer' | 'decimal' | 'boolean' | 'date' | 'timestamp';

// Strict ISO 8601 date: exactly YYYY-MM-DD, nothing more
const ISO_DATE_STRICT = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// Strict ISO 8601 timestamp: YYYY-MM-DDTHH:MM with optional seconds/millis/tz
// The 'T' separator and time component (HH:MM) are MANDATORY.
const ISO_TIMESTAMP_STRICT = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d/;

/**
 * Accept ONLY YYYY-MM-DD format with valid calendar values.
 * Rejects: "12/12/2024", "yesterday", "Laptop Pro", ISO timestamps.
 */
function isValidDate(v: string): boolean {
    const s = String(v).trim();
    if (!ISO_DATE_STRICT.test(s)) return false;
    // Secondary guard: Date constructor must agree it's a real calendar date
    const d = new Date(s + 'T00:00:00');
    if (isNaN(d.getTime())) return false;
    // Ensure no month/day overflow (e.g. 2024-02-31 normalises silently)
    const [, y, m, day] = ISO_DATE_STRICT.exec(s)!.map(Number);
    return d.getUTCFullYear() === y && d.getUTCMonth() + 1 === m && d.getUTCDate() === day;
}

/**
 * Accept ONLY ISO 8601 timestamps that include a time portion.
 * Rejects: plain dates (YYYY-MM-DD), slashed formats, natural language.
 */
function isValidTimestamp(v: string): boolean {
    const s = String(v).trim();
    if (!ISO_TIMESTAMP_STRICT.test(s)) return false;
    return !isNaN(new Date(s).getTime());
}

const BOOL_TRUTHY = new Set(['true', 'false', '1', '0', 'yes', 'no']);

function nonNull(values: any[]): any[] {
    return values.filter(v => v !== null && v !== undefined && String(v).trim() !== '');
}

function isWholeNumber(v: any): boolean {
    const n = Number(v);
    return !isNaN(n) && Number.isFinite(n) && n === Math.floor(n);
}

function validateTypeTransition(

    currentType: ColumnType,
    targetType: ColumnType,
    values: any[]
): { allowed: boolean; reason?: string } {
    if (currentType === targetType) {
        return { allowed: false, reason: 'Target type is the same as the current type.' };
    }

    const allowed: Record<ColumnType, ColumnType[]> = {
        text: ['integer', 'decimal', 'boolean', 'date', 'timestamp'],
        integer: ['decimal', 'text', 'boolean'],
        decimal: ['text', 'integer'],
        boolean: ['text', 'integer'],
        date: ['text', 'timestamp'],
        timestamp: ['text', 'date'],
    };

    if (!allowed[currentType]?.includes(targetType)) {
        return { allowed: false, reason: `Transition from "${currentType}" to "${targetType}" is not allowed.` };
    }

    const data = nonNull(values);

    if (currentType === 'text') {
        if (targetType === 'integer') {
            const bad = data.find(v => { const n = Number(String(v).trim()); return isNaN(n) || !Number.isInteger(n); });
            if (bad !== undefined) return { allowed: false, reason: `Value "${bad}" cannot be converted to Integer.` };
        }
        if (targetType === 'decimal') {
            const bad = data.find(v => isNaN(Number(String(v).trim())));
            if (bad !== undefined) return { allowed: false, reason: `Value "${bad}" cannot be converted to Decimal.` };
        }
        if (targetType === 'boolean') {
            const bad = data.find(v => !BOOL_TRUTHY.has(String(v).trim().toLowerCase()));
            if (bad !== undefined) return { allowed: false, reason: `Value "${bad}" is not a valid boolean representation.` };
        }
        if (targetType === 'date') {
            const bad = data.find(v => !isValidDate(String(v).trim()));
            if (bad !== undefined) return { allowed: false, reason: `Value "${bad}" is not a valid ISO date (YYYY-MM-DD).` };
        }
        if (targetType === 'timestamp') {
            const bad = data.find(v => !isValidTimestamp(String(v).trim()));
            if (bad !== undefined) return { allowed: false, reason: `Value "${bad}" is not a valid ISO timestamp.` };
        }
    }

    if (currentType === 'decimal' && targetType === 'integer') {
        const bad = data.find(v => !isWholeNumber(v));
        if (bad !== undefined) return { allowed: false, reason: `Value "${bad}" has a fractional part — cannot convert to Integer without data loss.` };
    }

    return { allowed: true };
}

export interface FileItem {
    id: string | number;
    name: string;
    tableName: string;
    type: 'csv' | 'json' | 'folder' | 'query' | 'parquet';
    rows: string;
    color: string;
    x: number;
    y: number;
    children?: FileItem[];
}

export interface QueryHistoryItem {
    id: string;
    sql: string;
    timestamp: number;
    pinned?: boolean;
}

export interface ColumnStat {
    name: string;
    type: string;
    nulls: number;
    unique: number;
    min?: any;
    max?: any;
    avg?: number;
}

export interface PipelineStep {
    id: string;
    type: "computed";
    name: string;
    expression: string;
    dependencies: string[];
    enabled: boolean;
}

export interface ColumnProfile {
    name: string;
    type: string;
    count: number;
    nulls: number;
    unique: number;
    sampleValues: any[];
}

export interface PipelineSnapshot {
    id: string;
    name: string;
    tableName: string;
    pipeline: PipelineStep[];
    createdAt: number;
}

const mockFiles: FileItem[] = [
    { id: 'sales', name: 'sales', tableName: 'sales', type: 'csv', rows: '1.2 KB', color: 'bg-emerald-100 text-emerald-600', x: 100, y: 100 },
    { id: 'sample', name: 'sample', tableName: 'sample', type: 'csv', rows: '840 B', color: 'bg-emerald-100 text-emerald-600', x: 100, y: 230 },
    { id: 'api_logs', name: 'api_logs', tableName: 'api_logs', type: 'json', rows: '420 B', color: 'bg-amber-100 text-amber-600', x: 100, y: 360 },
];

interface AppState {
    db: AsyncDuckDB | null;
    conn: AsyncDuckDBConnection | null;
    isLoading: boolean;
    error: string | null;
    queryResult: any[] | null;
    queryColumns: string[] | null;
    queryError: string | null;
    isQueryRunning: boolean;
    lastSQL: string | null;
    lastAIQuery: string | null;
    files: FileItem[];
    selectedId: string | number | null;
    isCommandPaletteOpen: boolean;
    scale: number;
    offset: { x: number; y: number };
    schema: {
        tables: string[];
        columns: Record<string, { name: string; type: string }[]>;
    };
    pipeline: Record<string, PipelineStep[]>;
    snapshots: PipelineSnapshot[];
    columnGraph: Record<string, string[]>;
    viewMode: 'table' | 'query';
    setViewMode: (mode: 'table' | 'query') => void;
    queryHistory: QueryHistoryItem[];
    isSettingsOpen: boolean;
    anthropicKey: string;
    appTheme: 'light' | 'dark' | 'system';

    showOnboarding: boolean;
    onboardingStep: number;
    startOnboarding: () => void;
    nextOnboardingStep: () => void;
    completeOnboarding: () => void;
    skipOnboarding: () => void;

    selectedColumn: string | null;
    columnProfile: ColumnProfile | null;
    isProfileLoading: boolean;
    setSelectedColumn: (col: string | null) => void;
    sortConfig: { colKey: string, direction: 'ASC' | 'DESC' } | null;
    setSortConfig: (config: { colKey: string, direction: 'ASC' | 'DESC' } | null) => void;
    filterConfig: { colKey: string, operator: string, value: string } | null;
    setFilterConfig: (config: { colKey: string, operator: string, value: string } | null) => void;
    groupConfig: { colKey: string } | null;
    setGroupConfig: (config: { colKey: string } | null) => void;

    initialize: () => Promise<void>;
    runQuery: (query: string) => Promise<void>;
    runSQL: (query: string, isAi?: boolean) => Promise<void>;
    validateSQL: (query: string) => Promise<string | null>;
    loadSchema: () => Promise<void>;
    clearSQLResult: () => void;
    setCommandPaletteOpen: (open: boolean) => void;
    setFiles: (files: FileItem[]) => void;
    setSelectedId: (id: string | number | null) => void;
    updateFilePosition: (id: string | number, x: number, y: number) => void;
    mergeFiles: (sourceId: string | number, targetId: string | number) => void;
    removeFileFromFolder: (folderId: string | number, fileId: string | number) => void;
    removeFile: (id: string | number) => void;
    renameFile: (id: string | number, newName: string) => Promise<void>;
    resetFiles: () => void;
    rearrangeLayout: () => void;
    setScale: (scale: number | ((prev: number) => number)) => void;
    setOffset: (offset: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
    saveQueryAsTable: (query: string, newName: string) => Promise<void>;
    exportTable: (tableName: string, format: 'csv' | 'json' | 'parquet' | 'xlsx') => Promise<Uint8Array>;
    getColumnProfile: (tableName: string, colName: string) => Promise<void>;
    createComputedColumn: (tableName: string, columnName: string, expression: string) => void;
    togglePipelineStep: (tableName: string, stepId: string) => void;
    removePipelineStep: (tableName: string, stepId: string) => void;
    reorderPipelineStep: (tableName: string, fromIndex: number, toIndex: number) => void;
    rebuildPipelineQuery: (tableName: string, baseQuery: string) => string;
    validatePipelineOrder: (tableName: string) => boolean;
    savePipelineSnapshot: (tableName: string, snapshotName: string) => void;
    loadPipelineSnapshot: (snapshotId: string) => void;
    deletePipelineSnapshot: (snapshotId: string) => void;
    exportSnapshot: (snapshotId: string) => void;
    importSnapshot: (file: File) => Promise<void>;
    exportPipelineSQL: (tableName: string) => void;
    copyPipelineSQL: (tableName: string) => void;
    editPipelineStepWithAI: (tableName: string, stepId: string, instruction: string) => Promise<{ expression: string } | null>;
    generateMultiStepWithAI: (tableName: string, instruction: string) => Promise<Array<{ name: string, expression: string }> | null>;
    applyMultiStepWithAI: (tableName: string, steps: Array<{ name: string, expression: string }>) => Promise<boolean>;
    addComputedColumnWithAI: (tableName: string, instruction: string) => Promise<{ name: string; expression: string } | null>;
    changeColumnType: (tableName: string, columnName: string, targetType: string) => Promise<{ success: boolean; error?: string }>;
    explainPipeline: (tableName: string) => Promise<any | null>;
    optimizePipeline: (tableName: string) => Promise<any | null>;
    applyOptimization: (tableName: string, optimization: any) => Promise<boolean>;

    // History Actions
    addQueryToHistory: (sql: string) => void;
    loadQueryFromHistory: (id: string) => void;
    pinQuery: (id: string) => void;
    removeQuery: (id: string) => void;
    setSettingsOpen: (open: boolean) => void;
    setAnthropicKey: (key: string) => void;
    setAppTheme: (theme: 'light' | 'dark' | 'system') => void;
    setLastAIQuery: (sql: string | null) => void;

    // Toast
    toast: { message: string; type: 'info' | 'error' | 'success' } | null;
    showToast: (message: string, type?: 'info' | 'error' | 'success') => void;

    // Custom Prompt Modal
    promptConfig: {
        isOpen: boolean;
        title: string;
        message: string;
        placeholder?: string;
        defaultValue?: string;
        confirmText?: string;
        cancelText?: string;
        onConfirm: (val: string) => void;
        onCancel: () => void;
    } | null;
    openPrompt: (config: Omit<AppState['promptConfig'], 'isOpen'>) => void;
    closePrompt: () => void;
    showPrivacyPolicy: boolean;
    setShowPrivacyPolicy: (show: boolean) => void;
    showTermsOfService: boolean;
    setShowTermsOfService: (show: boolean) => void;
}

export const useStore = create<AppState>()(
    persist(
        (set, get) => ({
            db: null,
            conn: null,
            isLoading: false,
            error: null,
            queryResult: null,
            queryColumns: null,
            queryError: null,
            isQueryRunning: false,
            lastSQL: null,
            lastAIQuery: null,
            files: mockFiles,
            selectedId: null,
            isCommandPaletteOpen: false,
            scale: 1,
            offset: { x: 0, y: 0 },
            schema: { tables: [], columns: {} },
            pipeline: {},
            snapshots: [],
            columnGraph: {},
            viewMode: 'table',
            queryHistory: [],
            isSettingsOpen: false,
            anthropicKey: '',
            appTheme: 'light',

            showOnboarding: !localStorage.getItem("krid_onboarding_completed"),
            onboardingStep: 1,

            startOnboarding: () => set({ showOnboarding: true, onboardingStep: 1 }),
            nextOnboardingStep: () => set((state) => ({ onboardingStep: state.onboardingStep + 1 })),
            completeOnboarding: () => {
                localStorage.setItem("krid_onboarding_completed", "true");
                set({ showOnboarding: false, onboardingStep: 0 });
            },
            skipOnboarding: () => {
                localStorage.setItem("krid_onboarding_completed", "true");
                set({ showOnboarding: false });
            },

            selectedColumn: null,
            columnProfile: null,
            isProfileLoading: false,
            sortConfig: null,
            filterConfig: null,
            groupConfig: null,
            toast: null,
            promptConfig: null,

            openPrompt: (config: any) => set({ promptConfig: { ...config, isOpen: true } }),
            closePrompt: () => set({ promptConfig: null }),

            showPrivacyPolicy: false,
            setShowPrivacyPolicy: (show: boolean) => set({ showPrivacyPolicy: show }),
            showTermsOfService: false,
            setShowTermsOfService: (show: boolean) => set({ showTermsOfService: show }),

            setViewMode: (mode: 'table' | 'query') => set({ viewMode: mode }),

            setCommandPaletteOpen: (open: boolean) => set({ isCommandPaletteOpen: open }),
            setSettingsOpen: (open: boolean) => set({ isSettingsOpen: open }),
            setAnthropicKey: (key: string) => set({ anthropicKey: key }),
            setAppTheme: (theme: 'light' | 'dark' | 'system') => set({ appTheme: theme }),
            setLastAIQuery: (sql: string | null) => set({ lastAIQuery: sql }),
            setSelectedColumn: (col) => set({ selectedColumn: col }),
            setSortConfig: (config) => set({ sortConfig: config }),
            setFilterConfig: (config) => set({ filterConfig: config }),
            setGroupConfig: (config) => set({ groupConfig: config }),
            showToast: (message: string, type: 'info' | 'error' | 'success' = 'info') => {
                set({ toast: { message, type } });
                setTimeout(() => {
                    const currentToast = get().toast;
                    if (currentToast?.message === message) {
                        set({ toast: null });
                    }
                }, 4000);
            },
            setFiles: (files: FileItem[]) => set({ files }),
            setSelectedId: (id: string | number | null) => set({ selectedId: id }),
            updateFilePosition: (id: string | number, x: number, y: number) => set((state) => ({
                files: state.files.map(f => {
                    if (String(f.id) === String(id)) return { ...f, x, y };
                    if (f.type === 'folder' && f.children) {
                        return {
                            ...f,
                            children: f.children.map(c => String(c.id) === String(id) ? { ...c, x, y } : c)
                        };
                    }
                    return f;
                })
            })),

            mergeFiles: (sourceId: string | number, targetId: string | number) => set((state) => {
                const sourceFile = state.files.find(f => String(f.id) === String(sourceId));
                const targetFile = state.files.find(f => String(f.id) === String(targetId));

                if (!sourceFile || !targetFile) return state;

                // If target is already a folder, add source to it
                if (targetFile.type === 'folder') {
                    return {
                        files: state.files
                            .filter(f => String(f.id) !== String(sourceId))
                            .map(f => String(f.id) === String(targetId)
                                ? { ...f, children: [...(f.children || []), sourceFile] }
                                : f
                            )
                    };
                }

             // If target is a file, create a new folder with both
                const newFolder: FileItem = {
                    id: `folder-${Date.now()}`, // String ID
                    name: 'Folder',
                    tableName: 'Folder',
                    type: 'folder',
                    rows: 'Multiple Files',
                    color: 'bg-blue-100 text-blue-600',
                    x: targetFile.x,
                    y: targetFile.y,
                    children: [targetFile, sourceFile]
                };

                return {
                    files: state.files
                        .filter(f => String(f.id) !== String(sourceId) && String(f.id) !== String(targetId))
                        .concat(newFolder)
                };
            }),
            removeFileFromFolder: (folderId: string | number, fileId: string | number) => set((state) => {
                const folder = state.files.find(f => String(f.id) === String(folderId));
                if (!folder || folder.type !== 'folder' || !folder.children) return state;

                const fileToRemove = folder.children.find(f => String(f.id) === String(fileId));
                if (!fileToRemove) return state;

                // Update the file position - move it outside the folder
                const updatedFile = { ...fileToRemove, x: folder.x + 40, y: folder.y + 40 };
                const remainingChildren = folder.children.filter(c => String(c.id) !== String(fileId));

                // If folder has only 1 file left, break up the folder
                if (remainingChildren.length === 1) {
                    const otherFile = remainingChildren[0];
                    return {
                        files: state.files
                            .filter(f => String(f.id) !== String(folderId))
                            .concat([
                                { ...otherFile, x: folder.x, y: folder.y },
                                updatedFile
                            ])
                    };
                }

                // Otherwise, just remove the file from the folder
                return {
                    files: state.files
                        .map(f => String(f.id) === String(folderId)
                            ? { ...f, children: remainingChildren }
                            : f
                        )
                        .concat(updatedFile)
                };
            }),
            removeFile: (id: string | number) => set((state) => {
                const removeRecursive = (items: FileItem[]): FileItem[] => {
                    return items
                        .filter(f => String(f.id) !== String(id))
                        .map(f => {
                            if (f.type === 'folder' && f.children) {
                                return {
                                    ...f,
                                    children: removeRecursive(f.children)
                                };
                            }
                            return f;
                        });
                };
                
                return { files: removeRecursive(state.files) };
            }),
            renameFile: async (id: string | number, newName: string) => {
                const { conn, files } = get();
                
                // Find file anywhere in the tree
                let fileToRename: FileItem | undefined;
                for (const f of files) {
                    if (String(f.id) === String(id)) {
                        fileToRename = f;
                        break;
                    }
                    if (f.type === 'folder' && f.children) {
                        const child = f.children.find(c => String(c.id) === String(id));
                        if (child) {
                            fileToRename = child;
                            break;
                        }
                    }
                }

                if (!fileToRename || !conn) return;

                const oldName = fileToRename.name;
                const isDefault = id === 'sales' || id === 'sample' || id === 'api_logs';

                try {
                    // 1. Rename DuckDB table if it exists (Skip for default files to keep tableName stable)
                    if (fileToRename.type !== 'folder' && !isDefault) {
                        await conn.query(`ALTER TABLE "${oldName}" RENAME TO "${newName}"`);
                    }

                    // 2. Synchronize with App Store (Handles IndexedDB and activeFile state)
                    await useAppStore.getState().renameFile(oldName, newName);

                    // 3. Update visual store state (Recursive)
                    set((state) => ({
                        files: state.files.map(f => {
                            if (String(f.id) === String(id)) {
                                return { 
                                    ...f, 
                                    name: newName,
                                    tableName: isDefault ? f.tableName : newName 
                                };
                            }
                            if (f.type === 'folder' && f.children) {
                                return {
                                    ...f,
                                    children: f.children.map(c => String(c.id) === String(id) ? { 
                                        ...c, 
                                        name: newName,
                                        tableName: isDefault ? c.tableName : newName
                                    } : c)
                                };
                            }
                            return f;
                        })
                    }));

                    // 4. Refresh schema
                    await get().loadSchema();
                    
                    get().showToast(`Renamed to ${newName}`, 'success');
                } catch (err) {
                    console.error("[Store] Failed to rename file:", err);
                    get().showToast("Rename failed", 'error');
                }
            },
            resetFiles: () => set({ files: mockFiles, scale: 1, offset: { x: 0, y: 0 } }),
            rearrangeLayout: () => set((state) => {
                const ROWS_MAX = 5;
                const START_X = 100;
                const START_Y = 100;
                const SPACING_X = 220;
                const SPACING_Y = 140;

                const rearrangedFiles = state.files.map((file, index) => {
                    const col = Math.floor(index / ROWS_MAX);
                    const row = index % ROWS_MAX;
                    return {
                        ...file,
                        x: START_X + col * SPACING_X,
                        y: START_Y + row * SPACING_Y
                    };
                });

                return {
                    files: rearrangedFiles,
                    scale: 1,
                    offset: { x: 0, y: 0 }
                };
            }),
            setScale: (scale) => set((state) => ({
                scale: typeof scale === 'function' ? scale(state.scale) : scale
            })),
            setOffset: (offset) => set((state) => ({
                offset: typeof offset === 'function' ? offset(state.offset) : offset
            })),

            // ... (existing imports)

            initialize: async () => {
                if (get().db) return;
                set({ isLoading: true, error: null });
                try {
                    const savedSnapshots = localStorage.getItem("gridless_snapshots");
                    if (savedSnapshots) {
                        try {
                            set({ snapshots: JSON.parse(savedSnapshots) });
                        } catch (e) {
                            console.error("Failed to parse snapshots", e);
                        }
                    }

                    const db = await initDB();
                    const conn = await db.connect();

                    // Load Default Data (Sales and Sample)
                    // Load Default Data (Sales and Sample)
                    // Matching the breakdown in the screenshot exactly
                    await conn.query(`
                        CREATE TABLE IF NOT EXISTS sales AS SELECT * FROM (VALUES 
                            (0, 'Laptop Pro', 'Electronics', 1299, 45, 58455, 'North'),
                            (1, 'Wireless Mouse', 'Electronics', 29, 234, 6786, 'East'),
                            (2, 'Office Chair', 'Furniture', 399, 67, 26733, 'West'),
                            (3, 'Standing Desk', 'Furniture', 599, 32, 19168, 'North'),
                            (4, 'Monitor 27"', 'Electronics', 449, 89, 39961, 'South'),
                            (5, 'Keyboard RGB', 'Electronics', 149, 156, 23244, 'East'),
                            (6, 'Webcam HD', 'Electronics', 79, 203, 16037, 'West'),
                            (7, 'Desk Lamp', 'Furniture', 49, 312, 15288, 'South'),
                            (8, 'USB Hub', 'Electronics', 39, 445, 17355, 'North'),
                            (9, 'Cable Kit', 'Accessories', 19, 567, 10773, 'East')
                        ) AS t(id, product, category, price, quantity, revenue, region);
                    `);

                    await conn.query(`
                        CREATE TABLE IF NOT EXISTS sample AS SELECT 
                            CAST(id AS INTEGER) as id,
                            CAST(name AS VARCHAR) as name,
                            CAST(email AS VARCHAR) as email,
                            CAST(plan AS VARCHAR) as plan,
                            CAST(country AS VARCHAR) as country,
                            CAST(status AS VARCHAR) as status,
                            CAST(signup_date AS DATE) as signup_date
                        FROM (VALUES 
                            (1, 'Alice Smith', 'alice@example.com', 'Enterprise', 'USA', 'active', current_date - interval '5 days'),
                            (2, 'Bob Jones', 'bob@example.com', 'Pro', 'Canada', 'active', current_date - interval '10 days'),
                            (3, 'Charlie Brown', 'charlie@example.com', 'Free', 'UK', 'inactive', current_date - interval '45 days'),
                            (4, 'David Wilson', 'david@example.com', 'Pro', 'USA', 'active', current_date - interval '2 days'),
                            (5, 'Eve Davis', 'eve@example.com', 'Enterprise', 'Germany', 'active', current_date - interval '12 days'),
                            (6, 'Frank Miller', 'frank@example.com', 'Free', 'Canada', 'active', current_date - interval '1 day'),
                            (7, 'Grace Lee', 'grace@example.com', 'Pro', 'UK', 'active', current_date - interval '8 days'),
                            (8, 'Henry Ford', 'henry@example.com', 'Enterprise', 'USA', 'active', current_date - interval '3 days'),
                            (9, 'Ivy Chen', 'ivy@example.com', 'Pro', 'Germany', 'active', current_date - interval '20 days'),
                            (10, 'Jack Ross', 'jack@example.com', 'Free', 'USA', 'active', current_date - interval '4 days'),
                            (11, 'Alice Smith', 'alice@example.com', 'Enterprise', 'USA', 'active', current_date - interval '5 days')
                        ) AS t(id, name, email, plan, country, status, signup_date);
                    `);

                    await conn.query(`
                        CREATE TABLE IF NOT EXISTS api_logs AS SELECT 
                            CAST(id AS INTEGER) as id,
                            CAST(status AS VARCHAR) as status,
                            CAST(method AS VARCHAR) as method,
                            CAST(endpoint AS VARCHAR) as endpoint,
                            CAST(latency_ms AS INTEGER) as latency_ms,
                            CAST(timestamp AS TIMESTAMP) as timestamp
                        FROM (VALUES 
                            (1, 'success', 'GET', '/api/users', 45, now()::TIMESTAMP - interval '10 minutes'),
                            (2, 'success', 'POST', '/api/login', 128, now()::TIMESTAMP - interval '15 minutes'),
                            (3, 'error', 'GET', '/api/products', 5032, now()::TIMESTAMP - interval '30 minutes'),
                            (4, 'success', 'GET', '/api/orders', 89, now()::TIMESTAMP - interval '45 minutes'),
                            (5, 'error', 'POST', '/api/reports', 890, now()::TIMESTAMP - interval '50 minutes'),
                            (6, 'success', 'GET', '/api/config', 12, now()::TIMESTAMP - interval '55 minutes')
                        ) AS t(id, status, method, endpoint, latency_ms, timestamp);
                    `);

                    set({ db, conn });
                    console.log("DuckDB Ready");

                    // Register defaults in useAppStore so they can be opened
                    const appStore = useAppStore.getState();
                    const existingFiles = appStore.files;

                    // Helper to check for a default file by its original identity
                    const ensureDefaultFile = (id: string, name: string, type: string = 'csv') => {
                        const exists = existingFiles.find(f => f.id === id || (f.tableName === id && f.type === type));
                        if (!exists) {
                            appStore.addFile({ id, name, tableName: id, type }, false);
                        }
                    };

                    ensureDefaultFile('sales', 'sales');
                    ensureDefaultFile('sample', 'sample');
                    ensureDefaultFile('api_logs', 'api_logs', 'json');

                    // Synchronize visual store names with application store names
                    // This ensures that renamed files on canvas remain consistent with the data store
                    // Refresh app store reference after potentially adding default files
                    const currentFiles = get().files;
                    const latestAppFiles = useAppStore.getState().files;
                    
                    const updatedFiles = currentFiles.map(vf => {
                        const af = latestAppFiles.find(f => String(f.tableName) === String(vf.tableName));
                        if (af && af.name !== vf.name) {
                            console.log(`[Sync] Updating visual node name from ${vf.name} to ${af.name}`);
                            return { ...vf, name: af.name };
                        }
                        if (vf.type === 'folder' && vf.children) {
                            return {
                                ...vf,
                                children: vf.children.map(cvf => {
                                    const caf = latestAppFiles.find(f => String(f.tableName) === String(cvf.tableName));
                                    if (caf && caf.name !== cvf.name) {
                                        console.log(`[Sync] Updating folder child name from ${cvf.name} to ${caf.name}`);
                                        return { ...cvf, name: caf.name };
                                    }
                                    return cvf;
                                })
                            };
                        }
                        return vf;
                    });
                    
                    if (JSON.stringify(updatedFiles) !== JSON.stringify(currentFiles)) {
                        set({ files: updatedFiles });
                    }

                    // Re-hydrate user-uploaded files
                    for (const file of latestAppFiles) {
                        const isDefault = String(file.id) === 'sales' || String(file.id) === 'sample' || String(file.id) === 'api_logs' || 
                                         file.tableName === 'sales' || file.tableName === 'sample' || file.tableName === 'api_logs';
                        if (isDefault) continue;

                        try {
                            // Use tableName (which is the storage key) for retrieval
                            const buffer = await getFileFromStorage(file.tableName);
                            if (buffer) {
                                // Register with DuckDB using tableName
                                await db.registerFileBuffer(file.tableName, buffer);

                                // Use saved type or fallback to extension from name
                                const extension = file.type || file.name.split('.').pop()?.toLowerCase();
                                let query = "";
                                if (extension === 'csv') {
                                    query = `CREATE TABLE IF NOT EXISTS "${file.tableName}" AS SELECT * FROM read_csv_auto('${file.tableName}');`;
                                } else if (extension === 'json') {
                                    query = `CREATE TABLE IF NOT EXISTS "${file.tableName}" AS SELECT * FROM read_json_auto('${file.tableName}');`;
                                } else if (extension === 'parquet') {
                                    query = `CREATE TABLE IF NOT EXISTS "${file.tableName}" AS SELECT * FROM read_parquet('${file.tableName}');`;
                                }

                                if (query) {
                                    await conn.query(query);
                                    console.log(`Re-hydrated ${file.tableName}`);
                                }
                            }
                        } catch (rehydrateErr) {
                            console.error(`Failed to re-hydrate ${file.tableName}:`, rehydrateErr);
                        }
                    }

                    // Initial schema load
                    await get().loadSchema();

                    // Restore SQL results if we were in query mode
                    const currentState = get();
                    if (currentState.viewMode === 'query' && currentState.lastSQL) {
                        try {
                            await currentState.runSQL(currentState.lastSQL);
                        } catch (e) {
                            console.error("Failed to restore SQL results:", e);
                        }
                    }

                    // Finally, done loading
                    set({ isLoading: false });

                } catch (err: any) {
                    console.error(err);
                    set({ error: err.message || 'Failed to initialize DuckDB', isLoading: false });
                }
            },

            runQuery: async (query: string) => {
                const { conn } = get();
                if (!conn) {
                    set({ error: 'Database not initialized' });
                    return;
                }
                set({ isLoading: true, error: null });
                try {
                    const result = await conn.query(query);
                    set({ queryResult: result.toArray().map((row) => row.toJSON()), isLoading: false });
                } catch (err: any) {
                    console.error(err);
                    set({ error: err.message || 'Query failed', isLoading: false });
                }
            },

            runSQL: async (query: string, isAi: boolean = false) => {
                const { conn } = get();
                console.log(`[SQL] ${isAi ? 'AI' : 'Manual'} Executing:`, query);

                set({
                    isQueryRunning: true,
                    queryError: null,
                    queryResult: null,
                    queryColumns: null,
                    lastSQL: query
                });

                if (!conn) {
                    set({
                        queryError: 'Database not initialized',
                        isQueryRunning: false
                    });
                    return;
                }

                try {
                    // Validation Guard: EXPLAIN before execution
                    try {
                        await conn.query(`EXPLAIN ${query}`);
                    } catch (explainErr: any) {
                        console.error("EXPLAIN Validation Failed:", explainErr);
                        set({
                            queryError: isAi ? "AI generated invalid SQL. Please retry." : (explainErr.message || "Invalid SQL syntax"),
                            isQueryRunning: false
                        });
                        return;
                    }

                    const result = await conn.query(query);
                    const rows = result.toArray().map((row) => row.toJSON());
                    const columns = result.schema.fields.map(f => f.name);

                    set({
                        queryResult: rows,
                        queryColumns: columns,
                        isQueryRunning: false,
                        viewMode: 'query'
                    });

                    // Success! Add to history
                    get().addQueryToHistory(query);
                } catch (err: any) {
                    console.error("SQL Execution Error:", err);
                    set({
                        queryError: err.message || "Failed to execute query",
                        isQueryRunning: false
                    });
                }
            },

            validateSQL: async (query: string) => {
                const trimmed = query.trim();

                // Smart Trigger: Don't validate if too short
                if (trimmed.length < 8) {
                    set({ queryError: null });
                    return null;
                }

                // Smart Trigger: Don't validate if ends with unfinished keywords or symbols
                const unfinishedKeywords = /\b(SELECT|FROM|WHERE|JOIN|AND|OR|GROUP|ORDER|BY)$/i;
                const unfinishedSymbols = /[,\.=<>\(]$/;

                if (unfinishedKeywords.test(trimmed) || unfinishedSymbols.test(trimmed)) {
                    return null;
                }

                const { conn } = get();
                if (!conn) return "Database not initialized";

                console.log("[SQL VALIDATION]", trimmed);
                try {
                    await conn.query(`EXPLAIN ${trimmed}`);
                    return null;
                } catch (err: any) {
                    return err.message || "Invalid SQL";
                }
            },
            clearSQLResult: () => set({
                queryResult: null,
                queryColumns: null,
                queryError: null,
                isQueryRunning: false,
                lastSQL: null,
                viewMode: 'table'
            }),

            loadSchema: async () => {
                const { conn } = get();
                if (!conn) return;

                try {
                    const tablesRes = await conn.query('SHOW TABLES');
                    const tables = tablesRes.toArray().map(r => r.toJSON().name);
                    console.log("[Schema] tables loaded", tables);

                    const columns: Record<string, { name: string; type: string }[]> = {};
                    for (const table of tables) {
                        const describeRes = await conn.query(`DESCRIBE "${table}"`);
                        columns[table] = describeRes.toArray().map(r => {
                            const row = r.toJSON();
                            return {
                                name: row.column_name,
                                type: row.column_type
                            };
                        });
                    }

                    set({ schema: { tables, columns } });
                    console.log("[Schema] Loaded columns with types", columns);
                } catch (err) {
                    console.error("Failed to load schema:", err);
                }
            },

            saveQueryAsTable: async (queryText: string, newTableName: string) => {
                const { conn, loadSchema } = get();
                if (!conn) return;

                console.log("[SaveQuery] Creating table");

                // Sanitization
                let sanitizedQuery = queryText.trim();
                if (sanitizedQuery.endsWith(';')) {
                    sanitizedQuery = sanitizedQuery.slice(0, -1).trim();
                }
                console.log("[SaveQuery] Sanitized query", sanitizedQuery);

                // 0. Validate: Only SELECT queries
                if (!sanitizedQuery.toLowerCase().startsWith('select')) {
                    throw new Error("Only SELECT queries can be saved");
                }

                // 1. Sanitize table name: lowercase, replace spaces with _, remove special characters
                const sanitized = newTableName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

                // 2. Generate safeTableName
                const safeTableName = `${sanitized}_${Date.now()}`;

                try {
                    // 3. Execute: CREATE TABLE tableName AS (query)
                    await conn.query(`CREATE TABLE "${safeTableName}" AS (${sanitizedQuery})`);

                    // 4. After success: CHECKPOINT
                    await conn.query("CHECKPOINT;");
                    console.log("[SaveQuery] CHECKPOINT complete");

                    // 5. Add to files metadata
                    const appStore = useAppStore.getState();
                    appStore.addFile({
                        id: safeTableName,
                        fileName: newTableName,
                        name: newTableName, // Map to name for component compatibility
                        tableName: safeTableName,
                        type: "query"
                    }, true); // 8. Set activeFileId to new table

                    // Add to visual store (Canvas)
                    set((state) => ({
                        files: [...state.files, {
                            id: Date.now(),
                            name: newTableName,
                            tableName: safeTableName,
                            type: 'query',
                            rows: 'Saved Query',
                            color: 'bg-indigo-100 text-indigo-600',
                            x: 200 + (Math.random() * 50),
                            y: 200 + (Math.random() * 50)
                        }]
                    }));

                    // 7. Call loadSchema()
                    await loadSchema();
                } catch (err: any) {
                    console.error("Save Query Error:", err);
                    set({ queryError: err.message || "Failed to save query as table" });
                }
            },

            exportTable: async (tableName: string, format: 'csv' | 'json' | 'parquet' | 'xlsx') => {
                const { db, conn, lastSQL } = get();
                if (!db || !conn) throw new Error("Database not initialized");

                console.log(`[Export] ${format}`);

                // Handle SQL Results specially: use lastSQL as source
                const sanitizedSQL = lastSQL?.trim().replace(/;+$/, '');
                const isQueryExport = tableName === "SQL Results" && !!sanitizedSQL;

                if (tableName === "SQL Results" && !sanitizedSQL) {
                    throw new Error("No SQL query found for export");
                }

                // Build SELECT with computed columns for non-query tables
                let finalQuery = isQueryExport ? sanitizedSQL : `SELECT * FROM "${tableName}"`;

                if (!isQueryExport) {
                    const { rebuildPipelineQuery } = get();
                    finalQuery = rebuildPipelineQuery(tableName, finalQuery);
                }

                if (format === 'xlsx') {
                    const query = finalQuery;
                    const result = await conn.query(query);
                    const rows = result.toArray().map((row) => row.toJSON());
                    return convertToXLSX(rows);
                }

                const fileName = `export.${format}`;
                let sql = "";

                if (format === 'csv') {
                    sql = `COPY (${finalQuery}) TO '${fileName}' (HEADER, DELIMITER ',');`;
                } else if (format === 'parquet') {
                    sql = `COPY (${finalQuery}) TO '${fileName}' (FORMAT PARQUET);`;
                } else if (format === 'json') {
                    sql = `COPY (${finalQuery}) TO '${fileName}' (FORMAT JSON);`;
                }

                await conn.query(sql);
                const buffer = await db.copyFileToBuffer(fileName);
                return buffer;
            },

            getColumnProfile: async (tableName: string, colName: string) => {
                const { conn, schema, rebuildPipelineQuery } = get();
                if (!conn || !tableName || !colName) return;

                set({ isProfileLoading: true }); // do not clear profile so the UI doesn't unmount and flash

                try {
                    // Try to understand what type the column is exactly from the DB or schema.
                    // We will query the DB directly to get stats to avoid large memory footprints.

                    let baseQuery = `SELECT * FROM "${tableName}"`;
                    try {
                        baseQuery = rebuildPipelineQuery(tableName, baseQuery);
                    } catch (e) {
                        // fallback to base target table
                    }

                    const escapedCol = `"${colName}"`;

                    // 1. Get Count & Nulls & Unique
                    const statsQuery = `
                        SELECT 
                            COUNT(*) as total_count,
                            COUNT(${escapedCol}) as valid_count,
                            COUNT(DISTINCT ${escapedCol}) as unique_count
                        FROM (${baseQuery})
                    `;

                    const statsRes = await conn.query(statsQuery);
                    const stats = statsRes.toArray()[0].toJSON();

                    const totalCount = Number(stats.total_count);
                    const validCount = Number(stats.valid_count);
                    const uniqueCount = Number(stats.unique_count);
                    const nulls = totalCount - validCount;

                    // 2. Get Data Type
                    // DuckDB's typeof can tell us the runtime type of the column
                    const typeQuery = `SELECT typeof(${escapedCol}) as col_type FROM (${baseQuery}) LIMIT 1`;
                    let colType = "Unknown";
                    try {
                        const typeRes = await conn.query(typeQuery);
                        const typeArr = typeRes.toArray();
                        if (typeArr.length > 0) {
                            colType = typeArr[0].toJSON().col_type || "Unknown";
                        } else {
                            // Fallback to schema if table is empty
                            const schemaCol = schema.columns[tableName]?.find(c => c.name === colName);
                            if (schemaCol) colType = schemaCol.type;
                        }
                    } catch (e) {
                        const schemaCol = schema.columns[tableName]?.find(c => c.name === colName);
                        if (schemaCol) colType = schemaCol.type;
                    }

                    // 3. Get Sample Values (Top 5 most frequent or just distinct)
                    const sampleQuery = `
                        SELECT ${escapedCol}
                        FROM (${baseQuery})
                        WHERE ${escapedCol} IS NOT NULL
                        GROUP BY ${escapedCol}
                        ORDER BY COUNT(*) DESC
                        LIMIT 5
                    `;
                    const sampleRes = await conn.query(sampleQuery);
                    const sampleValues = sampleRes.toArray().map(row => row.toJSON()[colName]);

                    set({
                        columnProfile: {
                            name: colName,
                            type: colType,
                            count: totalCount,
                            nulls: nulls,
                            unique: uniqueCount,
                            sampleValues
                        },
                        isProfileLoading: false
                    });

                } catch (err) {
                    console.error(`Failed to generate profile for column ${colName}:`, err);
                    set({ isProfileLoading: false });
                }
            },


            // History Implementations
            addQueryToHistory: (sql: string) => {
                if (!sql.trim()) return;
                const { queryHistory } = get();

                // Case-insensitive match check
                const existingIndex = queryHistory.findIndex(h => h.sql.toLowerCase() === sql.toLowerCase().trim());

                let nextHistory = [...queryHistory];
                if (existingIndex !== -1) {
                    // Update timestamp and move to top
                    const item = { ...nextHistory[existingIndex], timestamp: Date.now() };
                    nextHistory.splice(existingIndex, 1);
                    nextHistory.unshift(item);
                } else {
                    // Push new item
                    nextHistory.unshift({
                        id: Math.random().toString(36).substr(2, 9),
                        sql: sql.trim(),
                        timestamp: Date.now()
                    });
                }

                // Keep max 50 entries
                if (nextHistory.length > 50) {
                    nextHistory = nextHistory.slice(0, 50);
                }

                set({ queryHistory: nextHistory });
            },

            loadQueryFromHistory: (id: string) => {
                const { queryHistory } = get();
                const item = queryHistory.find(h => h.id === id);
                if (item) {
                    set({ lastSQL: item.sql });
                }
            },

            pinQuery: (id: string) => set((state) => ({
                queryHistory: state.queryHistory.map(h =>
                    h.id === id ? { ...h, pinned: !h.pinned } : h
                )
            })),

            removeQuery: (id: string) => set((state) => ({
                queryHistory: state.queryHistory.filter(h => h.id !== id)
            })),

            createComputedColumn: (tableName: string, columnName: string, expression: string) => {
                const { schema, pipeline, columnGraph, showToast } = get();

                // 1. Validate
                if (!expression.trim()) {
                    showToast("Expression cannot be empty", "error");
                    return;
                }

                if (!schema.tables.includes(tableName)) {
                    showToast(`Table "${tableName}" not found`, "error");
                    return;
                }

                const tableColumns = schema.columns[tableName] || [];
                const columnExistsInSchema = tableColumns.some(c => c.name.toLowerCase() === columnName.toLowerCase());
                const columnExistsInComputed = (pipeline[tableName] || []).some(c => c.type === 'computed' && c.name.toLowerCase() === columnName.toLowerCase());

                if (columnExistsInSchema || columnExistsInComputed) {
                    showToast(`Column "${columnName}" already exists`, "error");
                    return;
                }

                // 2. Strict Security Validation

                // Block semicolons
                if (expression.includes(';')) {
                    showToast("Semicolons are not allowed", "error");
                    return;
                }

                // Block SQL Keywords (case-insensitive)
                const sqlKeywords = /\b(SELECT|DROP|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN|UNION|CREATE|ALTER|TRUNCATE|DATABASE|SCHEMA|TABLE|GRANT|REVOKE)\b/i;
                if (sqlKeywords.test(expression)) {
                    showToast("SQL keywords are restricted in expressions", "error");
                    return;
                }

                // Character Whitelist: only alphanumeric, underscore, space, dots, and allowed operators
                // Allowed operators: + - * / ( ) > < = !
                const allowedChars = /^[a-zA-Z0-9_\s\.\+\-\*\/\(\)><=!]+$/;
                if (!allowedChars.test(expression)) {
                    showToast("Expression contains disallowed characters", "error");
                    return;
                }

                // 3. Extract dependencies using regex
                // Match identifiers that aren't keywords (simplified)
                const potentialDeps = Array.from(expression.matchAll(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g))
                    .map(match => match[0]);

                // Filter dependencies that exist in the table schema or existing computed columns
                const tableComputedCols = (pipeline[tableName] || []).filter(step => step.type === 'computed');
                const dependencies = potentialDeps.filter(dep =>
                    tableColumns.some(c => c.name.toLowerCase() === dep.toLowerCase()) ||
                    tableComputedCols.some(c => c.name.toLowerCase() === dep.toLowerCase())
                );

                if (dependencies.length === 0) {
                    showToast("Expression must reference at least one valid column", "error");
                    return;
                }

                const uniqueDependencies = Array.from(new Set(dependencies));

                // 4. Cycle Detection
                const hasCycle = (startCol: string, deps: string[], graph: Record<string, string[]>): boolean => {
                    const visited = new Set<string>();
                    const visit = (node: string): boolean => {
                        if (node === startCol) return true; // Cycle detected
                        if (visited.has(node)) return false;
                        visited.add(node);
                        const nodeDeps = graph[node] || [];
                        for (const dep of nodeDeps) {
                            if (visit(dep)) return true;
                        }
                        return false;
                    };
                    for (const dep of deps) {
                        if (visit(dep)) return true;
                    }
                    return false;
                };

                if (hasCycle(columnName, uniqueDependencies, columnGraph)) {
                    showToast("Circular dependency detected", "error");
                    return;
                }

                // 5. Store metadata
                const newComputedColumn = {
                    id: Math.random().toString(36).substring(2, 9),
                    type: "computed" as const,
                    name: columnName,
                    expression,
                    dependencies: uniqueDependencies,
                    enabled: true
                };

                set((state) => ({
                    pipeline: {
                        ...state.pipeline,
                        [tableName]: [
                            ...(state.pipeline[tableName] || []),
                            newComputedColumn
                        ]
                    },
                    columnGraph: {
                        ...state.columnGraph,
                        [columnName]: uniqueDependencies
                    }
                }));

                showToast(`Computed column "${columnName}" created`, "success");
            },

            togglePipelineStep: (tableName: string, stepId: string) => {
                const { pipeline, showToast } = get();
                const steps = pipeline[tableName] || [];
                const stepIdx = steps.findIndex(s => s.id === stepId);

                if (stepIdx === -1) return;

                const step = steps[stepIdx];
                const newEnabled = !step.enabled;

                // Dependency validation when ENABLING a step
                if (newEnabled) {
                    const activeStepNames = steps.slice(0, stepIdx).filter(s => s.enabled).map(s => s.name);
                    const schemaCols = get().schema.columns[tableName]?.map(c => c.name) || [];
                    const allAvailable = [...schemaCols, ...activeStepNames];

                    const missingDeps = step.dependencies.filter(dep => !allAvailable.includes(dep));

                    if (missingDeps.length > 0) {
                        showToast(`Cannot enable: missing dependencies (${missingDeps.join(', ')})`, "error");
                        return;
                    }
                }
                // Dependency validation when DISABLING a step
                else {
                    const dependentSteps = steps.slice(stepIdx + 1).filter(s => s.enabled && s.dependencies.includes(step.name));
                    if (dependentSteps.length > 0) {
                        showToast(`Cannot disable: used by ${dependentSteps.map(s => s.name).join(', ')}`, "error");
                        return;
                    }
                }

                set((state) => ({
                    pipeline: {
                        ...state.pipeline,
                        [tableName]: state.pipeline[tableName].map(s =>
                            s.id === stepId ? { ...s, enabled: newEnabled } : s
                        )
                    }
                }));

                // The TableView component will automatically re-fetch data based on the pipeline change
            },

            removePipelineStep: (tableName: string, stepId: string) => {
                const { pipeline, showToast } = get();
                const steps = pipeline[tableName] || [];
                const stepIdx = steps.findIndex(s => s.id === stepId);

                if (stepIdx === -1) return;
                const stepToRemove = steps[stepIdx];

                // Check if any activated downstream steps depend on it
                const dependentSteps = steps.slice(stepIdx + 1).filter(s => s.enabled && s.dependencies.includes(stepToRemove.name));
                if (dependentSteps.length > 0) {
                    showToast(`Cannot delete: used by ${dependentSteps.map(s => s.name).join(', ')}`, "error");
                    return;
                }

                set((state) => {
                    // Clean up dependent columns from graph
                    const nextGraph = { ...state.columnGraph };
                    delete nextGraph[stepToRemove.name];

                    return {
                        pipeline: {
                            ...state.pipeline,
                            [tableName]: steps.filter(step => step.id !== stepId)
                        },
                        columnGraph: nextGraph
                    };
                });
            },

            validatePipelineOrder: (tableName: string) => {
                const { pipeline, schema } = get();
                const steps = pipeline[tableName] || [];
                const availableColumns = new Set(schema.columns[tableName]?.map(c => c.name) || []);

                for (const step of steps) {
                    if (step.enabled) {
                        const missingDeps = step.dependencies.filter(dep => !availableColumns.has(dep));
                        if (missingDeps.length > 0) {
                            return false;
                        }
                        availableColumns.add(step.name);
                    }
                }
                return true;
            },

            reorderPipelineStep: (tableName: string, fromIndex: number, toIndex: number) => {
                const { pipeline, showToast, validatePipelineOrder } = get();
                const steps = [...(pipeline[tableName] || [])];

                if (fromIndex < 0 || fromIndex >= steps.length || toIndex < 0 || toIndex >= steps.length) {
                    return;
                }

                // Perform the reorder
                const [movedStep] = steps.splice(fromIndex, 1);
                steps.splice(toIndex, 0, movedStep);

                // Temporarily apply to state to validate
                const oldPipeline = pipeline[tableName] || [];
                set((state) => ({
                    pipeline: {
                        ...state.pipeline,
                        [tableName]: steps
                    }
                }));

                // Validate dependency order
                if (!validatePipelineOrder(tableName)) {
                    showToast("Invalid transform order: dependency violation.", "error");
                    // Revert state
                    set((state) => ({
                        pipeline: {
                            ...state.pipeline,
                            [tableName]: oldPipeline
                        }
                    }));
                    return;
                }

                // Integrate with history so undo works
                globalHistory.push({
                    type: 'REORDER_PIPELINE',
                    undo: () => set(state => ({ pipeline: { ...state.pipeline, [tableName]: oldPipeline } })),
                    redo: () => set(state => ({ pipeline: { ...state.pipeline, [tableName]: steps } }))
                });

                set((state) => ({
                    pipeline: {
                        ...state.pipeline,
                        [tableName]: steps
                    }
                }));
            },

            rebuildPipelineQuery: (tableName: string, baseQuery: string) => {
                const { pipeline, schema } = get();
                const steps = pipeline[tableName] || [];

                let currentQuery = baseQuery;
                const availableColumns = new Set(schema.columns[tableName]?.map(c => c.name) || []);

                // Track execution order to properly resolve references
                // We only execute enabled steps
                // We must ensure that step.dependencies are present in availableColumns before applying
                for (const step of steps) {
                    if (!step.enabled) continue;

                    // Verify dependencies are met
                    const missingDeps = step.dependencies.filter(dep => !availableColumns.has(dep));

                    if (missingDeps.length === 0) {
                        // All dependencies met, safe to execute
                        if (availableColumns.has(step.name)) {
                            // Column redefinition (e.g. type casting)
                            currentQuery = `SELECT * EXCLUDE ("${step.name}"), (${step.expression}) AS "${step.name}" FROM (${currentQuery})`;
                        } else {
                            currentQuery = `SELECT *, (${step.expression}) AS "${step.name}" FROM (${currentQuery})`;
                            availableColumns.add(step.name);
                        }
                    } else {
                        // Skip execution if dependencies are not met (should be prevented by the UI toggle anyway, but this is a safety net)
                        console.warn(`[Pipeline] Skipping step ${step.name} due to missing dependencies: ${missingDeps.join(', ')}`);
                    }
                }

                return currentQuery;
            },

            savePipelineSnapshot: (tableName: string, snapshotName: string) => {
                const { pipeline, snapshots, showToast } = get();
                const currentPipeline = pipeline[tableName] || [];

                // Deep clone current pipeline for that table
                const clonedPipeline = JSON.parse(JSON.stringify(currentPipeline));

                const newSnapshot: PipelineSnapshot = {
                    id: Math.random().toString(36).substring(2, 9),
                    name: snapshotName,
                    tableName,
                    pipeline: clonedPipeline,
                    createdAt: Date.now()
                };

                const newSnapshots = [...snapshots, newSnapshot];

                set({ snapshots: newSnapshots });

                // Persist to localStorage
                try {
                    localStorage.setItem("gridless_snapshots", JSON.stringify(newSnapshots));
                } catch (e) {
                    console.error("Failed to save snapshots to localStorage", e);
                }

                showToast(`Snapshot "${snapshotName}" saved`, "success");
            },

            loadPipelineSnapshot: (snapshotId: string) => {
                const { snapshots, pipeline, columnGraph, showToast, validatePipelineOrder } = get();

                const snapshot = snapshots.find(s => s.id === snapshotId);
                if (!snapshot) {
                    showToast("Snapshot not found", "error");
                    return;
                }

                const tableName = snapshot.tableName;
                const oldPipeline = pipeline[tableName] || [];
                const oldColumnGraph = { ...columnGraph };

                // Rebuild column graph for this table
                const nextGraph = { ...oldColumnGraph };
                // Remove existing ones for this table
                oldPipeline.forEach(s => {
                    if (s.type === 'computed') {
                        delete nextGraph[s.name];
                    }
                });
                // Add from snapshot
                snapshot.pipeline.forEach(s => {
                    if (s.type === 'computed') {
                        nextGraph[s.name] = s.dependencies;
                    }
                });

                // Temporarily apply to state to validate
                set((state) => ({
                    pipeline: {
                        ...state.pipeline,
                        [tableName]: JSON.parse(JSON.stringify(snapshot.pipeline))
                    },
                    columnGraph: nextGraph
                }));

                // Validate
                if (!validatePipelineOrder(tableName)) {
                    showToast("Failed to load snapshot: dependency validation failed.", "error");
                    // Revert state
                    set((state) => ({
                        pipeline: {
                            ...state.pipeline,
                            [tableName]: oldPipeline
                        },
                        columnGraph: oldColumnGraph
                    }));
                    return;
                }

                // Validation passed, integrate with undo/redo
                globalHistory.push({
                    type: 'LOAD_SNAPSHOT',
                    undo: () => set(state => ({
                        pipeline: { ...state.pipeline, [tableName]: oldPipeline },
                        columnGraph: oldColumnGraph
                    })),
                    redo: () => set(state => ({
                        pipeline: { ...state.pipeline, [tableName]: JSON.parse(JSON.stringify(snapshot.pipeline)) },
                        columnGraph: nextGraph
                    }))
                });

                showToast(`Loaded snapshot "${snapshot.name}"`, "success");
            },

            deletePipelineSnapshot: (snapshotId: string) => {
                const { snapshots, showToast } = get();
                const snapshotToRemove = snapshots.find(s => s.id === snapshotId);

                if (!snapshotToRemove) {
                    showToast("Snapshot not found", "error");
                    return;
                }

                const newSnapshots = snapshots.filter(s => s.id !== snapshotId);

                set({ snapshots: newSnapshots });

                // Persist to localStorage
                try {
                    localStorage.setItem("gridless_snapshots", JSON.stringify(newSnapshots));
                } catch (e) {
                    console.error("Failed to update snapshots in localStorage", e);
                }

                showToast(`Deleted snapshot "${snapshotToRemove.name}"`, "success");
            },

            exportSnapshot: (snapshotId: string) => {
                const { snapshots, showToast } = get();
                const snapshot = snapshots.find(s => s.id === snapshotId);

                if (!snapshot) {
                    showToast("Snapshot not found", "error");
                    return;
                }

                try {
                    // Convert to formatted JSON
                    const jsonString = JSON.stringify(snapshot, null, 2);

                    // Trigger file download
                    const blob = new Blob([jsonString], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');

                    link.href = url;

                    // Clean filename
                    const safeName = snapshot.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                    link.download = `${safeName}.json`;

                    document.body.appendChild(link);
                    link.click();

                    // Cleanup
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);

                    showToast(`Exported snapshot "${snapshot.name}"`, "success");
                } catch (err) {
                    console.error("Failed to export snapshot", err);
                    showToast("Failed to export snapshot", "error");
                }
            },

            importSnapshot: async (file: File) => {
                const { snapshots, showToast } = get();

                try {
                    const text = await file.text();

                    // 1. Parse JSON safely
                    const parsed = JSON.parse(text);

                    // 2. Validate structure
                    if (!parsed || typeof parsed !== 'object') {
                        throw new Error("Invalid snapshot format: not an object");
                    }
                    if (!parsed.id || typeof parsed.id !== 'string') {
                        throw new Error("Invalid snapshot format: missing or invalid id");
                    }
                    if (!parsed.name || typeof parsed.name !== 'string') {
                        throw new Error("Invalid snapshot format: missing or invalid name");
                    }
                    if (!parsed.tableName || typeof parsed.tableName !== 'string') {
                        throw new Error("Invalid snapshot format: missing or invalid tableName");
                    }
                    if (!Array.isArray(parsed.pipeline)) {
                        throw new Error("Invalid snapshot format: missing or invalid pipeline array");
                    }

                    // Check pipeline steps structure
                    for (const step of parsed.pipeline) {
                        if (!step.id || !step.type || !step.name || typeof step.expression !== 'string' || !Array.isArray(step.dependencies)) {
                            throw new Error("Invalid snapshot format: malformed pipeline step");
                        }
                    }

                    // 3. Prevent malformed injection / deduplicate ID
                    // Generate a new ID to prevent collisions with existing snapshots
                    const newId = Math.random().toString(36).substring(2, 9);

                    const importedSnapshot: PipelineSnapshot = {
                        id: newId,
                        name: `${parsed.name} (Imported)`,
                        tableName: parsed.tableName,
                        pipeline: parsed.pipeline,
                        createdAt: Date.now()
                    };

                    // 4. Add to snapshots array (6. does not auto-load)
                    const newSnapshots = [...snapshots, importedSnapshot];
                    set({ snapshots: newSnapshots });

                    // 5. Persist to localStorage
                    try {
                        localStorage.setItem("gridless_snapshots", JSON.stringify(newSnapshots));
                    } catch (e) {
                        console.error("Failed to save imported snapshot to localStorage", e);
                    }

                    showToast(`Imported snapshot "${importedSnapshot.name}"`, "success");
                } catch (err: any) {
                    console.error("Failed to import snapshot", err);
                    showToast(err.message || "Failed to parse snapshot file", "error");
                }
            },

            exportPipelineSQL: (tableName: string) => {
                const { rebuildPipelineQuery, showToast } = get();

                try {
                    // 1. Call generatePipelineSQL (rebuildPipelineQuery in this codebase)
                    const baseQuery = `SELECT * FROM "${tableName}"`;
                    const pipelineSQL = rebuildPipelineQuery(tableName, baseQuery);

                    // Format the SQL slightly for readability
                    const formattedSQL = `-- Pipeline SQL for table: ${tableName}\n-- Generated at: ${new Date().toISOString()}\n\n${pipelineSQL};\n`;

                    // 2. Create downloadable Blob (5. Ensure UTF-8 encoding)
                    // The Blob constructor inherently uses UTF-8 for strings.
                    const blob = new Blob([formattedSQL], { type: 'text/sql;charset=utf-8' });

                    // 3. Trigger file download
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;

                    // 4. File name format: <tableName>_pipeline.sql
                    const safeName = tableName.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
                    link.download = `${safeName}_pipeline.sql`;

                    document.body.appendChild(link);
                    link.click();

                    // Cleanup
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);

                    showToast(`Exported SQL for "${tableName}"`, "success");
                } catch (err) {
                    console.error("Failed to export pipeline SQL:", err);
                    showToast("Failed to export SQL", "error");
                }
            },

            changeColumnType: async (tableName: string, columnName: string, targetType: string): Promise<{ success: boolean; error?: string }> => {
                const { schema, conn } = get();

                // Derive current DuckDB type from schema
                const tableColumns = schema?.columns?.[tableName] || [];
                const currentCol = tableColumns.find((c: { name: string; type: string }) => c.name === columnName);
                const rawDuckType = (currentCol?.type || '').toUpperCase();

                // Map DuckDB type → ColumnType
                const mapToColumnType = (t: string): ColumnType => {
                    if (t.includes('BOOL')) return 'boolean';
                    if (t.includes('TIMESTAMP') || t.includes('DATETIME')) return 'timestamp';
                    if (t === 'DATE') return 'date';
                    if (t.includes('INT') || t.includes('BIGINT')) return 'integer';
                    if (t.includes('DOUBLE') || t.includes('FLOAT') || t.includes('DECIMAL') || t.includes('NUMERIC') || t.includes('REAL')) return 'decimal';
                    return 'text';
                };

                const currentType = mapToColumnType(rawDuckType);
                const target = targetType.toLowerCase() as ColumnType;

                // Step 1: Retrieve column values from DuckDB for data-level validation
                let columnValues: any[] = [];
                if (conn) {
                    try {
                        const result = await conn.query(`SELECT "${columnName}" FROM "${tableName}"`);
                        columnValues = result.toArray().map((row: any) => row[columnName] ?? null);
                    } catch (fetchErr: any) {
                        return { success: false, error: `Could not read column values: ${fetchErr.message}` };
                    }
                }

                // Step 2: Run strict type transition validation
                const validation = validateTypeTransition(currentType, target, columnValues);
                if (!validation.allowed) {
                    return { success: false, error: validation.reason };
                }

                // Step 3: Only now build and persist the pipeline CAST step
                let castType = targetType.toUpperCase();
                if (castType === 'TEXT') castType = 'VARCHAR';
                if (castType === 'INTEGER') castType = 'BIGINT';
                if (castType === 'DECIMAL') castType = 'DOUBLE';
                if (castType === 'DATETIME') castType = 'TIMESTAMP';

                const expression = `CAST("${columnName}" AS ${castType})`;

                const newStep: PipelineStep = {
                    id: Math.random().toString(36).substring(2, 9),
                    type: 'computed',
                    name: columnName,
                    expression,
                    dependencies: [columnName],
                    enabled: true
                };

                set((state) => ({
                    pipeline: {
                        ...state.pipeline,
                        [tableName]: [
                            ...(state.pipeline[tableName] || []),
                            newStep
                        ]
                    }
                }));

                return { success: true };
            },


            copyPipelineSQL: (tableName: string) => {
                const { rebuildPipelineQuery, showToast } = get();

                try {
                    const baseQuery = `SELECT * FROM "${tableName}"`;
                    const pipelineSQL = rebuildPipelineQuery(tableName, baseQuery);

                    navigator.clipboard.writeText(pipelineSQL)
                        .then(() => {
                            showToast("SQL copied", "success");
                        })
                        .catch(err => {
                            console.error("Failed to copy SQL:", err);
                            showToast("Failed to copy SQL", "error");
                        });
                } catch (err) {
                    console.error("Failed to copy pipeline SQL:", err);
                    showToast("Failed to copy SQL", "error");
                }
            },

            editPipelineStepWithAI: async (tableName: string, stepId: string, instruction: string) => {
                const { pipeline, schema, showToast } = get();
                const steps = pipeline[tableName] || [];
                const stepIndex = steps.findIndex(s => s.id === stepId);

                if (stepIndex === -1) {
                    showToast("Step not found", "error");
                    return null;
                }

                const apiKey = getAIKey();
                if (!apiKey) {
                    showToast("Please configure an Anthropic AI key in settings first.", "error");
                    return null;
                }

                const step = steps[stepIndex];
                const baseColumns = schema.columns[tableName]?.map(c => c.name) || [];

                // Computed columns available are those before this step
                const computedColumns = steps.slice(0, stepIndex).filter(s => s.enabled).map(s => s.name);

                const systemPrompt = `You are a deterministic expression editor for a data transformation engine.

Rules:
- Only output valid SQL expression.
- Do not output SELECT statements.
- Do not change column name.
- Only modify the expression logic.
- Must use existing column names only.
- No explanations.
- Return JSON:
  { "expression": "<new_expression>" }

Base columns:
${baseColumns.join(', ')}

Computed columns:
${computedColumns.join(', ')}

Current step:
name: ${step.name}
expression: ${step.expression}

User instruction:
${instruction}`;

                showToast("Generating AI edit...", "info");
                try {
                    const response = await fetch('/ai', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            system: systemPrompt,
                            prompt: "Return the updated JSON. ONLY JSON.",
                            apiKey: apiKey
                        })
                    });

                    if (!response.ok) {
                        const errData = await response.json().catch(() => ({}));
                        throw new Error(errData.error?.message || "AI request failed");
                    }

                    const data = await response.json();
                    let text = data.text || '';

                    // Clean code blocks
                    const startIndex = text.indexOf('{');
                    const endIndex = text.lastIndexOf('}');
                    if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
                        text = text.substring(startIndex, endIndex + 1);
                    }

                    const parsed = JSON.parse(text);
                    if (!parsed || typeof parsed.expression !== 'string') {
                        throw new Error("Invalid format returned by AI.");
                    }

                    const newExpression = parsed.expression.trim();

                    // --- 2. Security & SQL Validation ---
                    const upperExp = newExpression.toUpperCase();
                    // Block specific structural SQL keywords to prevent injection or full queries
                    const blockedKeywords = ['SELECT ', 'DROP ', 'INSERT ', 'UPDATE ', 'DELETE ', 'ALTER ', 'TRUNCATE ', 'REPLACE INTO', 'GRANT ', 'REVOKE ', 'COMMIT', 'ROLLBACK', 'EXEC ', 'EXECUTE '];
                    if (blockedKeywords.some(kw => upperExp.includes(kw))) {
                        throw new Error("Expression contains unauthorized SQL keywords. Only transformation logic is allowed.");
                    }
                    if (newExpression.includes(';')) {
                        throw new Error("Expression cannot contain semicolons.");
                    }

                    // Block raw function execution outside safe arithmetic bounds (basic heuristic)
                    if (upperExp.includes('()') && !upperExp.match(/(?:NOW|TODAY|RANDOM)\(\)/)) {
                        throw new Error("Unauthorized parameterless function call detected.");
                    }

                    // --- 3. Extract Dependencies ---
                    const dependencies: string[] = [];
                    // Extract potential words that are purely alphabetical/underscores and not SQL keywords
                    const tokens = newExpression.split(/[\s,()=;!<>+/*%"'-]+/);
                    const sqlBuiltins = new Set(['CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'CAST', 'ROUND', 'FLOOR', 'CEIL', 'ABS', 'COALESCE', 'NULLIF', 'AND', 'OR', 'NOT', 'IS', 'NULL', 'TRUE', 'FALSE', 'LIKE', 'ILIKE', 'IN', 'BETWEEN', 'AS']);

                    tokens.forEach((t: string) => {
                        const token = t.replace(/['"]/g, ''); // strip quotes
                        if (!token || /^\d/.test(token)) return; // skip numbers
                        if (sqlBuiltins.has(token.toUpperCase())) return;

                        // If it matches a base column or computed column, it's a dependency
                        if (baseColumns.includes(token) || computedColumns.includes(token)) {
                            // Only add if it's a computed column (base columns aren't tracked in graph per step)
                            if (computedColumns.includes(token)) {
                                dependencies.push(token);
                            }
                        } else if (!token.match(/^[a-zA-Z_]+$/)) {
                            // It's likely a static string 'value', ignore. If it's a raw unquoted string, it will fail SQL eval anyway.
                        } else if (token.toUpperCase() !== token) {
                            // if it's mixed case and not in schema, it might be an invalid column reference.
                            // Let the dry run catch it, or we could explicitly block it here.
                        }
                    });

                    const uniqueDependencies = [...new Set(dependencies)];

                    // --- 4. Validate Dependencies (No Circular/Order) ---
                    // Circular dependency is virtually impossible since we only gave the AI computed columns that exist *before* this step.
                    // But we verify anyway.
                    const stepDependsOnFutureOrSelf = uniqueDependencies.some(dep => {
                        const depIndex = steps.findIndex(s => s.name === dep);
                        return depIndex >= stepIndex; // depends on itself or something later
                    });

                    if (stepDependsOnFutureOrSelf) {
                        throw new Error("AI generated an expression with invalid or circular dependencies.");
                    }

                    // --- 5. Dry-Run SQL Build ---
                    // Temporarily apply it to a clone of the pipeline
                    const testSteps = [...steps];
                    testSteps[stepIndex] = { ...step, expression: newExpression, dependencies: uniqueDependencies };

                    // To do a true dry run without mutating state, we can just compile it. 
                    // Let's use the local rebuildPipelineQuery logic logic manually for test.
                    try {
                        const queryParts = testSteps.filter(s => s.enabled).map(s => `    ${s.expression} AS "${s.name}"`);
                        const testQuery = `SELECT *${queryParts.length > 0 ? ', \n' + queryParts.join(',\n') : ''}\nFROM "${tableName}"`;
                        // Just compiling it ensures the syntax generation part of our UI works.
                        // We also need to query DB to ensure DuckDB accepts it.
                        const { conn } = get();
                        if (conn) {
                            // PREPARE statement does a syntax and binding check without executing
                            await conn.query(`PREPARE _test_ai_query AS ${testQuery} LIMIT 0; DEALLOCATE PREPARE _test_ai_query;`);
                        }
                    } catch (dbErr: any) {
                        throw new Error(`Dry-run failed: ${dbErr.message}`);
                    }

                    // --- 6. Success: Apply & History ---
                    const oldExpression = step.expression;
                    const oldDependencies = [...step.dependencies];

                    set((state) => {
                        const currentSteps = state.pipeline[tableName] || [];
                        const updatedSequence = [...currentSteps];
                        updatedSequence[stepIndex] = {
                            ...step,
                            expression: newExpression,
                            dependencies: uniqueDependencies
                        };

                        return {
                            pipeline: {
                                ...state.pipeline,
                                [tableName]: updatedSequence
                            }
                        };
                    });

                    set({ lastAIQuery: null }); // Optional: clear last AI query so we see table
                    try {
                        const baseQuery = `SELECT * FROM "${tableName}"`;
                        const newQuery = get().rebuildPipelineQuery(tableName, baseQuery);
                        set({ lastSQL: newQuery });
                    } catch (e) {
                        console.error("Failed to load table data after ai edit", e);
                    }

                    // --- 7. Undo Integration ---
                    globalHistory.push({
                        type: 'UPDATE_CELL',
                        undo: async () => {
                            set((state) => {
                                const currentSteps = state.pipeline[tableName] || [];
                                const targetIdx = currentSteps.findIndex(s => s.id === stepId);
                                if (targetIdx === -1) return state; // step deleted since

                                const reverted = [...currentSteps];
                                reverted[targetIdx] = {
                                    ...reverted[targetIdx],
                                    expression: oldExpression,
                                    dependencies: oldDependencies
                                };
                                return { pipeline: { ...state.pipeline, [tableName]: reverted } };
                            });
                            try {
                                const baseQuery = `SELECT * FROM "${tableName}"`;
                                const newQuery = get().rebuildPipelineQuery(tableName, baseQuery);
                                set({ lastSQL: newQuery });
                            } catch (e) { }
                        },
                        redo: async () => {
                            set((state) => {
                                const currentSteps = state.pipeline[tableName] || [];
                                const targetIdx = currentSteps.findIndex(s => s.id === stepId);
                                if (targetIdx === -1) return state;

                                const reApplied = [...currentSteps];
                                reApplied[targetIdx] = {
                                    ...reApplied[targetIdx],
                                    expression: newExpression,
                                    dependencies: uniqueDependencies
                                };
                                return { pipeline: { ...state.pipeline, [tableName]: reApplied } };
                            });
                            try {
                                const baseQuery = `SELECT * FROM "${tableName}"`;
                                const newQuery = get().rebuildPipelineQuery(tableName, baseQuery);
                                set({ lastSQL: newQuery });
                            } catch (e) { }
                        }
                    });

                    showToast("Step updated successfully by AI.", "success");
                    return { expression: newExpression };

                } catch (err: any) {
                    console.error("AI Edit error:", err);
                    showToast(err.message || "Failed to edit step with AI", "error");
                    return null;
                }
            },

            addComputedColumnWithAI: async (tableName: string, instruction: string) => {
                const { pipeline, schema, showToast } = get();

                const apiKey = getAIKey();
                if (!apiKey) {
                    showToast("Please configure an Anthropic AI key in settings first.", "error");
                    return null;
                }

                const steps = pipeline[tableName] || [];
                const baseColumns = schema.columns[tableName]?.map(c => c.name) || [];
                // Computed columns available are all current enabled steps
                const computedColumns = steps.filter(s => s.enabled).map(s => s.name);

                const systemPrompt = `You are a deterministic SQL expression generator.

Rules:
- Only create ONE computed column.
- Return JSON only.
- Do not output SELECT statements.
- Use only provided columns.
- Do not reference unknown columns.
- No explanations.

Return:

{
  "name": "<new_column_name>",
  "expression": "<valid_sql_expression>"
}

Base columns:
${baseColumns.join(', ')}

Existing computed columns:
${computedColumns.join(', ')}

User instruction:
${instruction}`;

                showToast("Generating new column...", "info");
                try {
                    const response = await fetch('/ai', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            system: systemPrompt,
                            prompt: "Return the JSON object. ONLY JSON.",
                            apiKey: apiKey
                        })
                    });

                    if (!response.ok) {
                        const errData = await response.json().catch(() => ({}));
                        throw new Error(errData.error?.message || errData.error || "AI request failed");
                    }

                    const data = await response.json();
                    let text = data.text || '';

                    // Clean code blocks
                    const startIndex = text.indexOf('{');
                    const endIndex = text.lastIndexOf('}');
                    if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
                        text = text.substring(startIndex, endIndex + 1);
                    }

                    const parsed = JSON.parse(text);
                    if (!parsed || typeof parsed.name !== 'string' || typeof parsed.expression !== 'string') {
                        throw new Error("Invalid format returned by AI.");
                    }

                    const newName = parsed.name.trim();
                    const newExpression = parsed.expression.trim();

                    // --- 2. Security & SQL Validation ---
                    if (!newName || newName.length > 64) {
                        throw new Error("Invalid or too long column name generated.");
                    }
                    if (baseColumns.includes(newName) || computedColumns.includes(newName)) {
                        throw new Error(`Column name '${newName}' already exists.`);
                    }

                    const upperExp = newExpression.toUpperCase();
                    const blockedKeywords = ['SELECT ', 'DROP ', 'INSERT ', 'UPDATE ', 'DELETE ', 'ALTER ', 'TRUNCATE ', 'REPLACE INTO', 'GRANT ', 'REVOKE ', 'COMMIT', 'ROLLBACK', 'EXEC ', 'EXECUTE '];
                    if (blockedKeywords.some(kw => upperExp.includes(kw))) {
                        throw new Error("Expression contains unauthorized SQL keywords.");
                    }
                    if (newExpression.includes(';')) {
                        throw new Error("Expression cannot contain semicolons.");
                    }
                    if (upperExp.includes('()') && !upperExp.match(/(?:NOW|TODAY|RANDOM)\(\)/)) {
                        throw new Error("Unauthorized parameterless function call detected.");
                    }

                    // --- 3. Extract Dependencies ---
                    const dependencies: string[] = [];
                    const tokens = newExpression.split(/[\s,()=;!<>+/*%"'-]+/);
                    const sqlBuiltins = new Set(['CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'CAST', 'ROUND', 'FLOOR', 'CEIL', 'ABS', 'COALESCE', 'NULLIF', 'AND', 'OR', 'NOT', 'IS', 'NULL', 'TRUE', 'FALSE', 'LIKE', 'ILIKE', 'IN', 'BETWEEN', 'AS']);

                    tokens.forEach((t: string) => {
                        const token = t.replace(/['"]/g, '');
                        if (!token || /^\d/.test(token)) return;
                        if (sqlBuiltins.has(token.toUpperCase())) return;

                        if (computedColumns.includes(token)) {
                            dependencies.push(token);
                        }
                    });

                    const uniqueDependencies = [...new Set(dependencies)];

                    // --- 4. Validate Dependencies & Order ---
                    // The new step goes at the end, so any currently existing computed column is valid to depend on.

                    // --- 5. Dry-Run SQL Build ---
                    const newStepId = Date.now().toString();
                    const testStep = {
                        id: newStepId,
                        type: 'computed' as const,
                        name: newName,
                        expression: newExpression,
                        dependencies: uniqueDependencies,
                        enabled: true
                    };
                    const testSteps = [...steps, testStep];

                    try {
                        const queryParts = testSteps.filter(s => s.enabled).map(s => `    ${s.expression} AS "${s.name}"`);
                        const testQuery = `SELECT *${queryParts.length > 0 ? ', \n' + queryParts.join(',\n') : ''}\nFROM "${tableName}"`;

                        const { conn } = get();
                        if (conn) {
                            await conn.query(`PREPARE _test_add_ai_query AS ${testQuery} LIMIT 0; DEALLOCATE PREPARE _test_add_ai_query;`);
                        }
                    } catch (dbErr: any) {
                        throw new Error(`Dry-run failed: ${dbErr.message}`);
                    }

                    // --- 6. Success: Apply & History ---
                    set((state) => {
                        const currentSteps = state.pipeline[tableName] || [];
                        return {
                            pipeline: {
                                ...state.pipeline,
                                [tableName]: [...currentSteps, testStep]
                            }
                        };
                    });

                    // Update query
                    set({ lastAIQuery: null });
                    try {
                        const baseQuery = `SELECT * FROM "${tableName}"`;
                        const newQuery = get().rebuildPipelineQuery(tableName, baseQuery);
                        set({ lastSQL: newQuery });
                    } catch (e) { }

                    // --- 7. Undo Integration ---
                    globalHistory.push({
                        type: 'UPDATE_CELL', // Just reusing UPDATE_CELL event logic for state reversion conceptually
                        undo: async () => {
                            set((state) => {
                                const currentSteps = state.pipeline[tableName] || [];
                                return {
                                    pipeline: {
                                        ...state.pipeline,
                                        [tableName]: currentSteps.filter(s => s.id !== newStepId)
                                    }
                                };
                            });
                            try {
                                const baseQuery = `SELECT * FROM "${tableName}"`;
                                const newQuery = get().rebuildPipelineQuery(tableName, baseQuery);
                                set({ lastSQL: newQuery });
                            } catch (e) { }
                        },
                        redo: async () => {
                            set((state) => {
                                const currentSteps = state.pipeline[tableName] || [];
                                return {
                                    pipeline: {
                                        ...state.pipeline,
                                        [tableName]: [...currentSteps, testStep]
                                    }
                                };
                            });
                            try {
                                const baseQuery = `SELECT * FROM "${tableName}"`;
                                const newQuery = get().rebuildPipelineQuery(tableName, baseQuery);
                                set({ lastSQL: newQuery });
                            } catch (e) { }
                        }
                    });

                    showToast("Column generated successfully.", "success");
                    return { name: newName, expression: newExpression };

                } catch (err: any) {
                    console.error("AI Add Column error:", err);
                    showToast(err.message || "Failed to generate column with AI", "error");
                    return null;
                }
            },

            generateMultiStepWithAI: async (tableName: string, instruction: string) => {
                const { pipeline, schema, showToast } = get();

                const apiKey = getAIKey();
                if (!apiKey) {
                    showToast("Please configure an Anthropic AI key in settings first.", "error");
                    return null;
                }

                const steps = pipeline[tableName] || [];
                const baseColumns = schema.columns[tableName]?.map(c => c.name) || [];
                const existingComputedColumns = steps.filter(s => s.enabled).map(s => s.name);

                const systemPrompt = `You are a deterministic transformation generator.

Rules:
- Generate between 1 and 4 computed columns.
- Do NOT modify existing columns.
- Do NOT output SELECT statements.
- Only return JSON array:
[
  { "name": "<column_name>", "expression": "<sql_expression>" }
]

Constraints:
- Use only provided columns.
- Steps may depend on earlier steps in this response.
- No explanations.
- No markdown.

Return format:
[
  { "name": "col_1", "expression": "expression_1" },
  { "name": "col_2", "expression": "expression_2" }
]

Base columns:
${baseColumns.join(', ')}

Existing computed columns:
${existingComputedColumns.join(', ')}

User instruction:
${instruction}`;

                showToast("Generating multiple steps...", "info");
                try {
                    const response = await fetch('/ai', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            system: systemPrompt,
                            prompt: "Return the JSON array. ONLY JSON ARRAY.",
                            apiKey: apiKey
                        })
                    });

                    if (!response.ok) {
                        const errData = await response.json().catch(() => ({}));
                        throw new Error(errData.error?.message || errData.error || "AI request failed");
                    }

                    const data = await response.json();
                    let text = data.text || '';

                    // Clean code blocks
                    const startIndex = text.indexOf('[');
                    const endIndex = text.lastIndexOf(']');
                    if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
                        text = text.substring(startIndex, endIndex + 1);
                    }

                    const parsed = JSON.parse(text);
                    if (!Array.isArray(parsed)) {
                        throw new Error("Invalid format returned by AI: Expected an array.");
                    }

                    return parsed.map(p => ({
                        name: String(p.name || '').trim(),
                        expression: String(p.expression || '').trim()
                    }));

                } catch (err: any) {
                    console.error("AI Multi-Step Generate error:", err);
                    showToast(err.message || "Failed to generate multiple steps", "error");
                    return null;
                }
            },

            applyMultiStepWithAI: async (tableName: string, stepsToApply: Array<{ name: string, expression: string }>) => {
                const { pipeline, schema, showToast, columnGraph } = get();

                const steps = pipeline[tableName] || [];
                const baseColumns = schema.columns[tableName]?.map(c => c.name) || [];
                const existingComputedColumns = steps.filter(s => s.enabled).map(s => s.name);

                const newSteps: PipelineStep[] = [];
                const tempColumnNames = [...baseColumns, ...existingComputedColumns];
                const sqlBuiltins = new Set(['CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'CAST', 'ROUND', 'FLOOR', 'CEIL', 'ABS', 'COALESCE', 'NULLIF', 'AND', 'OR', 'NOT', 'IS', 'NULL', 'TRUE', 'FALSE', 'LIKE', 'ILIKE', 'IN', 'BETWEEN', 'AS']);

                try {
                    for (const item of stepsToApply) {
                        const newName = item.name;
                        const newExpression = item.expression;

                        // Validation
                        if (!newName || newName.length > 64) throw new Error(`Invalid name: ${newName}`);
                        if (tempColumnNames.includes(newName)) throw new Error(`Column '${newName}' already exists.`);

                        const upperExp = newExpression.toUpperCase();
                        const blockedKeywords = ['SELECT ', 'DROP ', 'INSERT ', 'UPDATE ', 'DELETE ', 'ALTER ', 'TRUNCATE ', 'REPLACE INTO', 'GRANT ', 'REVOKE ', 'COMMIT', 'ROLLBACK', 'EXEC ', 'EXECUTE '];
                        if (blockedKeywords.some(kw => upperExp.includes(kw))) throw new Error(`Unauthorized SQL in step '${newName}'`);
                        if (newExpression.includes(';')) throw new Error(`Semicolon in step '${newName}'`);

                        // Dependencies
                        const stepDeps: string[] = [];
                        const tokens = newExpression.split(/[\s,()=;!<>+/*%"'-]+/);
                        tokens.forEach((t: string) => {
                            const token = t.replace(/['"]/g, '');
                            if (!token || /^\d/.test(token)) return;
                            if (sqlBuiltins.has(token.toUpperCase())) return;
                            if (tempColumnNames.includes(token)) {
                                stepDeps.push(token);
                            }
                        });

                        const step: PipelineStep = {
                            id: (Date.now() + Math.random()).toString(),
                            type: 'computed',
                            name: newName,
                            expression: newExpression,
                            dependencies: [...new Set(stepDeps)],
                            enabled: true
                        };

                        newSteps.push(step);
                        tempColumnNames.push(newName);

                        // Early circular dependency check for the new steps combined
                        // We do a lightweight graph check just on temp columns to fail fast
                        const tempAdjacency: Record<string, string[]> = {};
                        for (const s of [...steps.filter(s => s.enabled), ...newSteps]) {
                            tempAdjacency[s.name] = s.dependencies;
                        }
                        const visited = new Set<string>();
                        const recStack = new Set<string>();

                        const hasCycle = (node: string): boolean => {
                            if (recStack.has(node)) return true;
                            if (visited.has(node)) return false;

                            visited.add(node);
                            recStack.add(node);

                            const deps = tempAdjacency[node] || [];
                            for (const dep of deps) {
                                if (hasCycle(dep)) return true;
                            }

                            recStack.delete(node);
                            return false;
                        };

                        if (hasCycle(newName)) {
                            throw new Error(`Circular dependency detected involving '${newName}'`);
                        }
                    }

                    // Dry-run
                    const testSteps = [...steps, ...newSteps];
                    try {
                        const queryParts = testSteps.filter(s => s.enabled).map(s => `    ${s.expression} AS "${s.name}"`);
                        const testQuery = `SELECT *${queryParts.length > 0 ? ', \n' + queryParts.join(',\n') : ''}\nFROM "${tableName}"`;
                        const { conn } = get();
                        if (conn) {
                            await conn.query(`PREPARE _test_multi_ai AS ${testQuery} LIMIT 0; DEALLOCATE PREPARE _test_multi_ai;`);
                        }
                    } catch (dbErr: any) {
                        throw new Error(`Dry-run failed: ${dbErr.message}`);
                    }

                    // Apply
                    set((state) => {
                        const currentSteps = state.pipeline[tableName] || [];
                        return {
                            pipeline: {
                                ...state.pipeline,
                                [tableName]: [...currentSteps, ...newSteps]
                            }
                        };
                    });

                    // Update query
                    try {
                        const baseQuery = `SELECT * FROM "${tableName}"`;
                        const newQuery = get().rebuildPipelineQuery(tableName, baseQuery);
                        set({ lastSQL: newQuery });
                    } catch (e) { }

                    // History
                    globalHistory.push({
                        type: 'UPDATE_CELL',
                        undo: async () => {
                            set((state) => {
                                const currentSteps = state.pipeline[tableName] || [];
                                const newIds = new Set(newSteps.map(s => s.id));
                                return {
                                    pipeline: {
                                        ...state.pipeline,
                                        [tableName]: currentSteps.filter(s => !newIds.has(s.id))
                                    }
                                };
                            });
                            try {
                                const baseQuery = `SELECT * FROM "${tableName}"`;
                                const newQuery = get().rebuildPipelineQuery(tableName, baseQuery);
                                set({ lastSQL: newQuery });
                            } catch (e) { }
                        },
                        redo: async () => {
                            set((state) => {
                                const currentSteps = state.pipeline[tableName] || [];
                                return {
                                    pipeline: {
                                        ...state.pipeline,
                                        [tableName]: [...currentSteps, ...newSteps]
                                    }
                                };
                            });
                            try {
                                const baseQuery = `SELECT * FROM "${tableName}"`;
                                const newQuery = get().rebuildPipelineQuery(tableName, baseQuery);
                                set({ lastSQL: newQuery });
                            } catch (e) { }
                        }
                    });

                    showToast(`${newSteps.length} steps applied successfully.`, "success");
                    return true;

                } catch (err: any) {
                    console.error("AI Multi-Step Apply error:", err);
                    showToast(err.message || "Failed to apply multiple steps", "error");
                    return false;
                }
            },

            explainPipeline: async (tableName: string) => {
                const { pipeline, schema, showToast, rebuildPipelineQuery } = get();

                const apiKey = getAIKey();
                if (!apiKey) {
                    showToast("Please configure an Anthropic AI key in settings first.", "error");
                    return null;
                }

                const steps = pipeline[tableName] || [];
                const activeSteps = steps.filter(s => s.enabled);

                if (activeSteps.length === 0) {
                    showToast("No active pipeline steps to explain.", "info");
                    return null;
                }

                const baseColumns = schema.columns[tableName]?.map(c => c.name) || [];

                let finalSQL = "";
                try {
                    const baseQuery = `SELECT * FROM "${tableName}"`;
                    finalSQL = rebuildPipelineQuery(tableName, baseQuery);
                } catch (e) {
                    finalSQL = "Error generating SQL";
                }

                const explainPayload = {
                    tableName,
                    baseColumns,
                    steps: activeSteps.map(s => ({ name: s.name, expression: s.expression })),
                    finalSQL
                };

                showToast("Generating explanation...", "info");
                try {
                    const response = await fetch('/ai/explain', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            payload: explainPayload,
                            apiKey: apiKey
                        })
                    });

                    if (!response.ok) {
                        const errData = await response.json().catch(() => ({}));
                        throw new Error(errData.error?.message || errData.error || "AI explain request failed");
                    }

                    const data = await response.json();
                    let text = data.text || '';

                    // Clean code blocks if returned as markdown json
                    const startIndex = text.indexOf('{');
                    const endIndex = text.lastIndexOf('}');
                    if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
                        text = text.substring(startIndex, endIndex + 1);
                    }

                    const parsed = JSON.parse(text);
                    return parsed;

                } catch (err: any) {
                    console.error("AI Explain error:", err);
                    showToast(err.message || "Failed to generate explanation", "error");
                    return null;
                }
            },

            optimizePipeline: async (tableName: string) => {
                const { pipeline, schema, showToast, rebuildPipelineQuery } = get();

                const apiKey = getAIKey();
                if (!apiKey) {
                    showToast("Please configure an Anthropic AI key in settings first.", "error");
                    return null;
                }

                const steps = pipeline[tableName] || [];
                const activeSteps = steps.filter(s => s.enabled);

                if (activeSteps.length === 0) {
                    showToast("No active pipeline steps to optimize.", "info");
                    return null;
                }

                const baseColumns = schema.columns[tableName]?.map(c => c.name) || [];

                let finalSQL = "";
                try {
                    const baseQuery = `SELECT * FROM "${tableName}"`;
                    finalSQL = rebuildPipelineQuery(tableName, baseQuery);
                } catch (e) {
                    finalSQL = "Error generating SQL";
                }

                const optimizePayload = {
                    tableName,
                    baseColumns,
                    steps: activeSteps.map(s => ({ name: s.name, expression: s.expression })),
                    finalSQL
                };

                showToast("Analyzing pipeline for optimizations...", "info");
                try {
                    const response = await fetch('/ai/optimize', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            payload: optimizePayload,
                            apiKey: apiKey
                        })
                    });

                    if (!response.ok) {
                        const errData = await response.json().catch(() => ({}));
                        throw new Error(errData.error?.message || errData.error || "AI optimize request failed");
                    }

                    const data = await response.json();
                    let text = data.text || '';

                    // Clean code blocks if returned as markdown json
                    const startIndex = text.indexOf('{');
                    const endIndex = text.lastIndexOf('}');
                    if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
                        text = text.substring(startIndex, endIndex + 1);
                    }

                    const parsed = JSON.parse(text);
                    return parsed;

                } catch (err: any) {
                    console.error("AI Optimize error:", err);
                    showToast(err.message || "Failed to generate optimizations", "error");
                    return null;
                }
            },

            applyOptimization: async (tableName: string, optimization: any) => {
                const { pipeline, schema, showToast, rebuildPipelineQuery } = get();

                // 1. Risk optimizations require manual review
                if (optimization.type === 'risk') {
                    showToast("Risk optimizations require manual review and cannot be auto-applied.", "info");
                    return false;
                }

                const steps = pipeline[tableName] || [];
                const baseColumns = schema.columns[tableName]?.map(c => c.name) || [];

                // 2. Find target step
                const targetIdx = steps.findIndex(s => s.name === optimization.target || s.id === optimization.target);
                if (targetIdx === -1) {
                    showToast(`Could not find target step: ${optimization.target}`, "error");
                    return false;
                }

                const originalStep = steps[targetIdx];
                const newSteps = [...steps];

                // 3. Process optimization types
                if (
                    optimization.type === 'duplicate_expression' ||
                    optimization.type === 'unused_column' ||
                    optimization.type === 'redundant_transform'
                ) {
                    // Check dependency integrity: Ensure no subsequent step depends on the one we're removing
                    const isDependedOn = steps.slice(targetIdx + 1).some(s => s.dependencies.includes(originalStep.name));

                    if (isDependedOn) {
                        showToast(`Cannot remove '${originalStep.name}': subsequent steps depend on it.`, "error");
                        return false;
                    }
                    // Safely remove the target step
                    newSteps.splice(targetIdx, 1);

                } else if (optimization.type === 'simplifiable_expression') {
                    const newExpression = optimization.suggestion;

                    // Validate new expression safety
                    const upperExp = newExpression.toUpperCase();
                    const blockedKeywords = ['SELECT ', 'DROP ', 'INSERT ', 'UPDATE ', 'DELETE ', 'ALTER ', 'TRUNCATE ', 'REPLACE INTO', 'GRANT ', 'REVOKE ', 'COMMIT', 'ROLLBACK', 'EXEC ', 'EXECUTE '];
                    if (blockedKeywords.some(kw => upperExp.includes(kw))) {
                        showToast(`Unauthorized SQL in optimization suggestion`, "error");
                        return false;
                    }
                    if (newExpression.includes(';')) {
                        showToast(`Semicolons are not allowed in expressions`, "error");
                        return false;
                    }

                    // Extract dependencies to preserve strict validation
                    const stepDeps: string[] = [];
                    const sqlBuiltins = new Set(['CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'CAST', 'ROUND', 'FLOOR', 'CEIL', 'ABS', 'COALESCE', 'NULLIF', 'AND', 'OR', 'NOT', 'IS', 'NULL', 'TRUE', 'FALSE', 'LIKE', 'ILIKE', 'IN', 'BETWEEN', 'AS']);
                    const tempColumnNames = [...baseColumns, ...steps.slice(0, targetIdx).map(s => s.name)];

                    const tokens = newExpression.split(/[\s,()=;!<>+/*%"'-]+/);
                    tokens.forEach((t: string) => {
                        const token = t.replace(/['"]/g, '');
                        if (!token || /^\d/.test(token)) return;
                        if (sqlBuiltins.has(token.toUpperCase())) return;
                        if (tempColumnNames.includes(token)) {
                            stepDeps.push(token);
                        }
                    });

                    newSteps[targetIdx] = {
                        ...originalStep,
                        expression: newExpression,
                        dependencies: [...new Set(stepDeps)]
                    };
                } else {
                    showToast(`Unknown optimization type: ${optimization.type}`, "error");
                    return false;
                }

                // 4. Dry-run the rebuilt pipeline
                try {
                    const queryParts = newSteps.filter(s => s.enabled).map(s => `    ${s.expression} AS "${s.name}"`);
                    const testQuery = `SELECT *${queryParts.length > 0 ? ', \n' + queryParts.join(',\n') : ''}\nFROM "${tableName}"`;

                    const { conn } = get();
                    if (conn) {
                        await conn.query(`PREPARE _test_opt AS ${testQuery} LIMIT 0; DEALLOCATE PREPARE _test_opt;`);
                    }
                } catch (dbErr: any) {
                    showToast(`Optimization validation failed: ${dbErr.message}`, "error");
                    return false;
                }

                // 5. Apply the approved changes safely
                set((state) => ({
                    pipeline: {
                        ...state.pipeline,
                        [tableName]: newSteps
                    }
                }));

                // 6. Rebuild and publish SQL string
                try {
                    const baseQuery = `SELECT * FROM "${tableName}"`;
                    const newQuery = get().rebuildPipelineQuery(tableName, baseQuery);
                    set({ lastSQL: newQuery });
                } catch (e) { }

                // 7. Integrate with global undo/redo stack
                globalHistory.push({
                    type: 'UPDATE_CELL',
                    undo: async () => {
                        set((state) => ({
                            pipeline: {
                                ...state.pipeline,
                                [tableName]: steps
                            }
                        }));
                        try {
                            const baseQuery = `SELECT * FROM "${tableName}"`;
                            set({ lastSQL: get().rebuildPipelineQuery(tableName, baseQuery) });
                        } catch (e) { }
                    },
                    redo: async () => {
                        set((state) => ({
                            pipeline: {
                                ...state.pipeline,
                                [tableName]: newSteps
                            }
                        }));
                        try {
                            const baseQuery = `SELECT * FROM "${tableName}"`;
                            set({ lastSQL: get().rebuildPipelineQuery(tableName, baseQuery) });
                        } catch (e) { }
                    }
                });

                showToast("Optimization applied successfully.", "success");
                return true;
            },
        }),
        {
            name: 'canvas-storage',
            partialize: (state) => ({
                files: state.files,
                scale: state.scale,
                offset: state.offset,
                queryHistory: state.queryHistory,
                anthropicKey: state.anthropicKey,
                appTheme: state.appTheme,
                pipeline: state.pipeline,
                columnGraph: state.columnGraph,
                lastSQL: state.lastSQL,
                viewMode: state.viewMode
            }),
        }
    )
);
