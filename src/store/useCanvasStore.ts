import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AsyncDuckDB, AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import { initDB } from '../data/duckdb';
import { useAppStore } from '../store';

let isInitialized = false;

export interface FileItem {
    id: number;
    name: string;
    type: 'csv' | 'json' | 'folder' | 'parquet';
    rows: string;
    color: string;
    x: number;
    y: number;
    children?: FileItem[];
}


interface AppState {
    db: AsyncDuckDB | null;
    conn: AsyncDuckDBConnection | null;
    isLoading: boolean;
    error: string | null;
    queryResult: any[];
    files: FileItem[];
    selectedId: number | null;
    isCommandPaletteOpen: boolean;
    scale: number;
    offset: { x: number; y: number };

    initialize: () => Promise<void>;
    runQuery: (query: string) => Promise<void>;
    setCommandPaletteOpen: (open: boolean) => void;
    setFiles: (files: FileItem[]) => void;
    setSelectedId: (id: number | null) => void;
    updateFilePosition: (id: number, x: number, y: number) => void;
    mergeFiles: (sourceId: number, targetId: number) => void;
    removeFileFromFolder: (folderId: number, fileId: number, newX: number, newY: number) => void;
    removeFile: (id: number) => void;
    resetFiles: () => void;
    setScale: (scale: number | ((prev: number) => number)) => void;
    setOffset: (offset: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
}

export const useStore = create<AppState>()(
    persist(
        (set, get) => ({
            db: null,
            conn: null,
            isLoading: false,
            error: null,
            queryResult: [],
            files: [],
            selectedId: null,
            isCommandPaletteOpen: false,
            scale: 1,
            offset: { x: 0, y: 0 },

            setCommandPaletteOpen: (open: boolean) => set({ isCommandPaletteOpen: open }),
            setFiles: (files: FileItem[]) => set({ files }),
            setSelectedId: (id: number | null) => set({ selectedId: id }),
            updateFilePosition: (id: number, x: number, y: number) => set((state) => ({
                files: state.files.map(f => {
                    // Update top-level file
                    if (f.id === id) return { ...f, x, y };
                    // Update file inside folder
                    if (f.type === 'folder' && f.children) {
                        const childIndex = f.children.findIndex(c => c.id === id);
                        if (childIndex !== -1) {
                            const updatedChildren = [...f.children];
                            updatedChildren[childIndex] = { ...updatedChildren[childIndex], x, y };
                            return { ...f, children: updatedChildren };
                        }
                    }
                    return f;
                })
            })),
            mergeFiles: (sourceId: number, targetId: number) => set((state) => {
                const sourceFile = state.files.find(f => f.id === sourceId);
                const targetFile = state.files.find(f => f.id === targetId);

                if (!sourceFile || !targetFile) return state;

                // If target is already a folder, add source to it
                if (targetFile.type === 'folder') {
                    return {
                        files: state.files
                            .filter(f => f.id !== sourceId)
                            .map(f => f.id === targetId
                                ? { ...f, children: [...(f.children || []), sourceFile] }
                                : f
                            )
                    };
                }

                // If target is a file, create a new folder with both
                const newFolder: FileItem = {
                    id: Date.now(),
                    name: 'Folder',
                    type: 'folder',
                    rows: `${(parseInt(sourceFile.rows) || 0) + (parseInt(targetFile.rows) || 0)}`,
                    color: 'bg-blue-100 text-blue-600',
                    x: targetFile.x,
                    y: targetFile.y,
                    children: [targetFile, sourceFile]
                };

                return {
                    files: state.files
                        .filter(f => f.id !== sourceId && f.id !== targetId)
                        .concat(newFolder)
                };
            }),
            removeFileFromFolder: (folderId: number, fileId: number, newX: number, newY: number) => set((state) => {
                const folder = state.files.find(f => f.id === folderId);
                if (!folder || folder.type !== 'folder' || !folder.children) return state;

                const fileToRemove = folder.children.find(f => f.id === fileId);
                if (!fileToRemove) return state;

                // Update the file position
                const updatedFile = { ...fileToRemove, x: newX, y: newY };
                const remainingChildren = folder.children.filter(f => f.id !== fileId);

                // If folder has only 2 files and we're removing one, break up the folder
                if (folder.children.length === 2) {
                    const otherFile = remainingChildren[0];
                    return {
                        files: state.files
                            .filter(f => f.id !== folderId)
                            .concat([
                                { ...otherFile, x: folder.x, y: folder.y },
                                updatedFile
                            ])
                    };
                }

                // Otherwise, just remove the file from the folder
                return {
                    files: state.files
                        .map(f => f.id === folderId
                            ? { ...f, children: remainingChildren }
                            : f
                        )
                        .concat(updatedFile)
                };
            }),
            removeFile: (id: number) => set((state) => ({
                files: state.files.filter(f => f.id !== id)
            })),
            resetFiles: () => set({ files: [], scale: 1, offset: { x: 0, y: 0 } }),
            setScale: (scale) => set((state) => ({
                scale: typeof scale === 'function' ? scale(state.scale) : scale
            })),
            setOffset: (offset) => set((state) => ({
                offset: typeof offset === 'function' ? offset(state.offset) : offset
            })),

            // ... (existing imports)

            initialize: async () => {
                if (isInitialized || get().db) {
                    console.log("[useStore] Initialization skipped (already initialized)");
                    return;
                }
                isInitialized = true;
                set({ isLoading: true, error: null });
                try {
                    const db = await initDB();
                    const conn = await db.connect();

                    set({ db, conn });
                    console.log("DuckDB Ready");

                    // Reset active file on start as requested
                    const appStore = useAppStore.getState();
                    appStore.setActiveFile(null);

                    // Sync store with actual tables in gridless.db
                    let result = await conn.query('SHOW TABLES');
                    let tables = result.toArray().map(row => row.toJSON().name);

                    // --- Seed built-in example tables ---
                    const EXAMPLE_FILES = [
                        { name: 'sales', filePath: '/sales.csv', type: 'csv' as const, rows: '1.2 KB', color: 'bg-emerald-100 text-emerald-600' },
                        { name: 'sample', filePath: '/sample.csv', type: 'csv' as const, rows: '840 B', color: 'bg-emerald-100 text-emerald-600' },
                        { name: 'api_logs', filePath: '/api_logs.json', type: 'json' as const, rows: '420 B', color: 'bg-amber-100 text-amber-600' }
                    ];

                    let freshlySeeded = false;

                    for (let exIdx = 0; exIdx < EXAMPLE_FILES.length; exIdx++) {
                        const example = EXAMPLE_FILES[exIdx];
                        if (!tables.includes(example.name)) {
                            try {
                                console.log(`[Seed] Loading built-in example: ${example.name}`);
                                const resp = await fetch(example.filePath);
                                if (!resp.ok) {
                                    console.warn(`[Seed] Failed to fetch ${example.filePath}: ${resp.status}`);
                                    continue;
                                }
                                const buffer = new Uint8Array(await resp.arrayBuffer());
                                await db.registerFileBuffer(example.name, buffer);
                                const readFn = example.type === 'json' ? 'read_json_auto' : 'read_csv_auto';
                                await conn.query(`CREATE TABLE "${example.name}" AS SELECT * FROM ${readFn}('${example.name}');`);
                                freshlySeeded = true;

                                // Add to app store if not already present
                                const currentFiles = useAppStore.getState().files;
                                if (!currentFiles.some(f => f.name === example.name)) {
                                    useAppStore.getState().addFile({
                                        name: example.name,
                                        tableName: example.name,
                                        type: example.type
                                    }, false);
                                }

                                // Add visual node to canvas if not already present
                                const currentCanvasFiles = get().files;
                                if (!currentCanvasFiles.some(f => f.name === example.name) &&
                                    !currentCanvasFiles.some(f => f.type === 'folder' && f.children?.some(c => c.name === example.name))) {
                                    set({
                                        files: [...get().files, {
                                            id: Date.now() + Math.random() + exIdx,
                                            name: example.name,
                                            type: example.type,
                                            rows: example.rows,
                                            color: example.color,
                                            x: 200 + (exIdx * 20),
                                            y: 120 + (exIdx * 90)
                                        }]
                                    });
                                }

                                console.log(`[Seed] Built-in example '${example.name}' loaded successfully`);
                            } catch (err) {
                                console.warn(`[Seed] Failed to seed example '${example.name}':`, err);
                            }
                        } else {
                            console.log(`[Seed] Example '${example.name}' already exists, skipping`);
                        }
                    }

                    // Re-fetch tables list if we seeded new ones, so URL validation works
                    if (freshlySeeded) {
                        result = await conn.query('SHOW TABLES');
                        tables = result.toArray().map(row => row.toJSON().name);
                    }

                    console.log("[Rehydrate] Tables in DB:", tables);

                    // Rehydrate/Filter files store
                    const existingFiles = appStore.files.filter((f: any) => tables.includes(f.tableName) || EXAMPLE_FILES.some(ex => ex.name === f.tableName));
                    console.log("[Rehydrate] Valid mappings restored:", existingFiles);

                    // Update store with strictly validated files - assuming we need to update the state
                    useAppStore.setState({ files: existingFiles });

                    // Handle initial file from URL securely
                    const params = new URLSearchParams(window.location.search);
                    const fileFromUrl = params.get('file');
                    if (fileFromUrl) {
                        const matchingFile = existingFiles.find((f: any) => f.fileName === fileFromUrl || f.name === fileFromUrl);
                        if (matchingFile) {
                            console.log("[Rehydrate] Setting active file from URL:", matchingFile.fileName || matchingFile.name);
                            appStore.setActiveFile(matchingFile.fileName || matchingFile.name);
                        } else {
                            console.warn("[Rehydrate] URL file not found in valid mappings:", fileFromUrl);
                            appStore.setActiveFile(null);
                        }
                    } else {
                        appStore.setActiveFile(null);
                    }

                    // Only now, after everything is seeded and validated, are we done loading
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
        }),
        {
            name: 'canvas-storage',
            partialize: (state) => ({
                files: state.files,
                scale: state.scale,
                offset: state.offset
            }),
        }
    )
);
