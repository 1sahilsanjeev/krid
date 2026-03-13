import React, { useEffect, useState, useRef, useMemo, memo } from 'react';
import { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import { getDB } from '../data/duckdb';
import { useAppStore } from '../store';
import {
    X,
    Search,
    Plus,
    Table,
    ChevronDown,
    FileDown,
    Type,
    Undo2,
    Redo2,
    MoreVertical,
    ArrowUp,
    ArrowDown,
    Hash,
    Calendar,
    Clock,
    CircleDot,
    Check,
    RotateCcw,
    Settings,
    ChevronLeft,
    ChevronRight,
    CornerDownLeft,
    ArrowRightToLine,
    Command,
    MousePointer2,
    AlertCircle
} from 'lucide-react';
import {
    normalizeRange,
    isCellInRange,
    getDataRegion,
    getJumpCoordinate,
    expandRangeWithShift
} from '../utils/selectionEngine';
import TableAssistant from './TableAssistant';
import SaveTableModal from './SaveTableModal';
import ColumnProfilePanel from './ColumnProfilePanel';
import PipelinePanel from './PipelinePanel';
import { useStore } from '../store/useStore';
import { parseCellValue } from '../utils/tableUtils';
import type { CellModel } from '../utils/tableUtils';
import { evaluateFormula } from '../utils/formulaEvaluator';
import type { GridContext, EvaluationResult } from '../utils/formulaEvaluator';
import { parseFormula, addressToCoords, coordsToAddress, extractReferencesFromAST, shiftFormula } from '../utils/formulaParser';
import { globalDependencyGraph } from '../utils/dependencyGraph';
import { globalHistory } from '../utils/historyManager';

interface GridCellProps {
    rowId: number;
    colKey: string;
    colIdx: number;
    cell: CellModel;
    isEditing: boolean;
    isSelected: boolean;
    isMultiSelected?: boolean;
    width: number;
    onMouseDown: (rowId: number, colKey: string, e: React.MouseEvent, colIdx: number) => void;
    onMouseEnter: (rowId: number, colKey: string, colIdx: number) => void;
    onDoubleClick: (rowId: number, colKey: string, val: any) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onSave: () => void;
    tempValue: string;
    setTempValue: (v: string) => void;
    context: GridContext;
    colors: any;
    colType?: string;
}

const GridCell = memo(({
    rowId,
    colKey,
    colIdx,
    cell,
    isEditing,
    isSelected,
    isMultiSelected,
    width,
    onMouseDown,
    onMouseEnter,
    onDoubleClick,
    onKeyDown,
    onSave,
    tempValue,
    setTempValue,
    context,
    colors,
    colType
}: GridCellProps) => {
    const { value, formula } = cell;
    const isFormula = formula !== null;
    const cellAddr = coordsToAddress(rowId, colIdx);

    // Prevent double-save bug
    const isSavedRef = useRef(false);

    useEffect(() => {
        if (isEditing) {
            isSavedRef.current = false;
        }
    }, [isEditing]);

    const handleLocalKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === 'Tab') {
            isSavedRef.current = true;
        }
        onKeyDown(e);
    };

    const handleLocalBlur = () => {
        if (!isSavedRef.current) {
            onSave();
        }
    };

    let displayVal = value;
    let evalError: string | null = null;

    if (isFormula && !isEditing) {
        // Use cache if available, otherwise fallback to on-demand
        const cached = context.computedCache?.[cellAddr];
        if (cached) {
            displayVal = cached.value;
            evalError = cached.error;
        } else {
            const result = evaluateFormula('=' + formula, context);
            displayVal = result.value;
            evalError = result.error;
        }
    }

    const formatValue = (val: any) => {
        if (val === null || val === undefined) return "";
        
        // Handle timestamps (could be Date object or numeric milliseconds/microseconds)
        if (colType && (colType.includes('TIMESTAMP') || colType.includes('DATETIME'))) {
            let date: Date;
            if (val instanceof Date) {
                date = val;
            } else if (typeof val === 'number') {
                // DuckDB-WASM returns BIGINT for TIMESTAMP, often in milliseconds or microseconds
                // If it's a huge number, it's probably microseconds
                date = new Date(val > 1e14 ? val / 1000 : val);
            } else {
                date = new Date(val);
            }

            if (!isNaN(date.getTime())) {
                return date.toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                }).replace(' at ', ', ');
            }
        }
        
        if (val instanceof Date) {
            return val.toISOString();
        }
        
        return String(val);
    };

    const isTimestamp = colType && (colType.includes('TIMESTAMP') || colType.includes('DATETIME'));
    const isNumeric = typeof displayVal === 'number' && !isTimestamp;

    return (
        <td
            onMouseDown={e => { e.stopPropagation(); onMouseDown(rowId, colKey, e, colIdx); }}
            onMouseEnter={() => onMouseEnter(rowId, colKey, colIdx)}
            onDoubleClick={() => onDoubleClick(rowId, colKey, isFormula ? '=' + formula : displayVal)}
            className={`px-4 py-2 border-r border-stone-100 dark:border-white/5 relative ${isEditing ? 'cell-editing' : 'truncate'} ${isSelected ? colors.selectionBg : ''} ${isSelected && !isMultiSelected ? 'cell-selected' : ''} ${isNumeric ? 'text-right font-mono text-blue-600 dark:text-blue-400' : 'text-stone-700 dark:text-stone-300'} transition-colors duration-100`}
            style={{
                width,
                '--selection-border-color': colors.selectionBorder
            } as any}
        >
            {isEditing ? (
                <input
                    autoFocus
                    title="Cell editor"
                    placeholder="Enter value..."
                    className={`absolute inset-[-1px] w-[calc(100%+2px)] h-[calc(100%+2px)] px-4 py-2 outline-none bg-white dark:bg-[#1a1a1a] z-50 ${isNumeric ? 'text-right font-mono text-blue-600 dark:text-blue-400' : 'text-stone-700 dark:text-stone-300'}`}
                    value={tempValue}
                    onChange={e => setTempValue(e.target.value)}
                    onKeyDown={handleLocalKeyDown}
                    onBlur={handleLocalBlur}
                />
            ) : (
                displayVal === null && !isFormula ? (
                    <span className="text-stone-300 dark:text-stone-600 italic text-xs">{evalError || 'null'}</span>
                ) : (
                    <span className={isFormula ? 'text-purple-600 dark:text-purple-400 font-medium' : ''}>
                        {isFormula ? (evalError ? `⚠️ ${evalError}` : `ƒ ${formatValue(displayVal)}`) : formatValue(displayVal)}
                    </span>
                )
            )}
        </td>
    );
});
GridCell.displayName = 'GridCell';

interface TableViewProps {
    tableName: string;
    rows?: any[];
    columns?: string[];
}

export default function TableView({ tableName: fileName, rows: externalRows, columns: externalColumns }: TableViewProps) {
    const { setActiveFile, activeStats, setActiveStats, files } = useAppStore();
    const {
        clearSQLResult,
        lastSQL,
        exportTable,
        saveQueryAsTable,
        setSelectedColumn,
        createComputedColumn,
        getColumnProfile,
        pipeline,
        sortConfig,
        filterConfig,
        groupConfig,
        columnProfile,
        changeColumnType,
        showToast,
        setSettingsOpen,
        viewMode,
        setViewMode,
        queryResult,
        onboardingStep,
        nextOnboardingStep,
        completeOnboarding
    } = useStore();
    const [data, setData] = useState<any[]>([]);
    const [grid, setGrid] = useState<CellModel[][]>([]);
    const [columns, setColumns] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [selection, setSelection] = useState<{
        type: 'row' | 'column' | 'range',
        ranges: {
            anchor: { row: number, col: number },
            focus: { row: number, col: number }
        }[],
        activeRangeIndex: number,
        rowId?: number,
        colKey?: string
    } | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<{ row: number, col: number } | null>(null);
    const [stagedChanges, setStagedChanges] = useState<Record<string, { newValue: CellModel, oldValue: any }>>({}); // key: rowid_colKey
    const [computedCache, setComputedCache] = useState<Record<string, EvaluationResult>>({});
    const [isColumnProfileOpen, setIsColumnProfileOpen] = useState(false);
    const [clipboard, setClipboard] = useState<{
        data: { relR: number, relC: number, raw: string }[],
        anchorRow: number,
        anchorCol: number
    } | null>(null);
    const [historyTick, setHistoryTick] = useState(0); // Forcing re-render on history changes
    const [showReviewPanel, setShowReviewPanel] = useState(false);
    const [expandedReviewRows, setExpandedReviewRows] = useState<Set<string>>(new Set());
    const [selectedReviewIndex, setSelectedReviewIndex] = useState<number>(-1);
    const [showPipelinePanel, setShowPipelinePanel] = useState(false);
    const connRef = useRef<AsyncDuckDBConnection | null>(null);
    const lastActionRef = useRef<string | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const isExternal = !!externalRows;
    const isSQLResults = fileName === "SQL Results";
    const isExportSupported = !isExternal || isSQLResults;

    // Pagination / Limits
    const [limit, setLimit] = useState(50);
    const [offset, setOffset] = useState(0);
    const [showLimitMenu, setShowLimitMenu] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);

    // Column Creation
    const [showAddColMenu, setShowAddColMenu] = useState(false);
    const [newColName, setNewColName] = useState("");
    const [newColExpression, setNewColExpression] = useState("");

    // UI Toggle States
    const [isFormulaBarExpanded, setIsFormulaBarExpanded] = useState(true);
    const [showAssistant, setShowAssistant] = useState(false);
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

    // Resizing State
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
    const [rowHeights, setRowHeights] = useState<Record<number, number>>({});

    // Handle Onboarding Step 2 completion via CMD+K
    useEffect(() => {
        const handleCmdK = (e: KeyboardEvent) => {
            if (onboardingStep === 2 && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                nextOnboardingStep();
                setShowAssistant(true);
            }
        };
        window.addEventListener('keydown', handleCmdK);
        return () => window.removeEventListener('keydown', handleCmdK);
    }, [onboardingStep, nextOnboardingStep]);

    // Auto-dismiss onboarding step 3 after 5 seconds
    useEffect(() => {
        if (onboardingStep === 3) {
            const timer = setTimeout(() => {
                completeOnboarding();
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [onboardingStep, completeOnboarding]);
    const [resizing, setResizing] = useState<{
        type: 'col' | 'row',
        id: string | number,
        startPos: number,
        startSize: number
    } | null>(null);

    const handleResizeStart = (e: React.MouseEvent, type: 'col' | 'row', id: string | number, startSize: number) => {
        e.preventDefault();
        e.stopPropagation();
        setResizing({
            type,
            id,
            startPos: type === 'col' ? e.clientX : e.clientY,
            startSize
        });
    };

    const columnOffsets = useMemo(() => {
        let current = 0;
        const offsets = [0];
        columns.forEach(col => {
            current += columnWidths[col] || 150;
            offsets.push(current);
        });
        return offsets;
    }, [columns, columnWidths]);

    const rowOffsets = useMemo(() => {
        let current = 0;
        const offsets = [0];
        data.forEach((_, i) => {
            current += rowHeights[i] || 40;
            offsets.push(current);
        });
        return offsets;
    }, [data, rowHeights]);

    const tableWidth = useMemo(() => {
        return 48 + (columnOffsets[columnOffsets.length - 1] || 0) + 40;
    }, [columnOffsets]);

    useEffect(() => {
        const handleGlobalMouseUp = () => {
            if (isDragging) {
                setIsDragging(false);
                setDragStart(null);
            }
        };

        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, [isDragging]);

    useEffect(() => {
        if (!resizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (resizing.type === 'col') {
                const delta = e.clientX - resizing.startPos;
                const newWidth = Math.max(100, resizing.startSize + delta);
                setColumnWidths(prev => ({ ...prev, [resizing.id]: newWidth }));
            } else {
                const delta = e.clientY - resizing.startPos;
                const newHeight = Math.max(32, resizing.startSize + delta);
                setRowHeights(prev => ({ ...prev, [resizing.id]: newHeight }));
            }
        };

        const handleMouseUp = () => {
            setResizing(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizing]);

    const handleSaveAsTable = async (name: string) => {
        if (!lastSQL) return;
        try {
            await saveQueryAsTable(lastSQL, name);
            clearSQLResult();
        } catch (err: any) {
            console.error("Failed to save table:", err);
        }
    };

    const handleExport = async (format: 'csv' | 'json' | 'parquet' | 'xlsx') => {
        if (!actualTableName) return;
        try {
            const data = await exportTable(actualTableName, format);
            const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${actualTableName}.${format === 'xlsx' ? 'xlsx' : format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setShowExportMenu(false);
        } catch (err) {
            console.error("Export failed:", err);
            alert(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    const fileEntry = files.find(f => f.name === fileName);
    const actualTableName = fileEntry?.tableName || fileName;



    // Also look up the visual canvas FileItem for the color hint (fallback for old persisted files)
    const canvasFiles = useStore.getState().files;
    const canvasFileItem = canvasFiles.flatMap(f =>
        f.type === 'folder' && f.children ? f.children : [f]
    ).find(f => f.tableName === fileName || f.name === fileName);

    // Determine file type from multiple sources
    const resolvedFileType = (() => {
        // 1. Prefer type from useAppStore (most reliable for new files)
        if (fileEntry?.type) return fileEntry.type.toLowerCase();
        // 2. Infer from canvas FileItem type field
        if (canvasFileItem?.type && canvasFileItem.type !== 'folder') return canvasFileItem.type.toLowerCase();
        // 3. Infer from filename extension
        const ext = fileName?.split('.').pop()?.toLowerCase();
        if (ext === 'csv' || ext === 'json' || ext === 'parquet') return ext;
        // 4. Infer from canvas FileItem color class (legacy fallback)
        if (canvasFileItem?.color?.includes('emerald')) return 'csv';
        if (canvasFileItem?.color?.includes('amber')) return 'json';
        if (canvasFileItem?.color?.includes('purple')) return 'parquet';
        return undefined;
    })();

    const getColorClasses = () => {
        if (isExternal) {
            // SQL query results → indigo
            return {
                pill: 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-100/50 dark:border-indigo-700/50 transition-colors',
                icon: 'text-indigo-500 dark:text-indigo-400',
                selection: 'bg-indigo-50 text-indigo-700 border-indigo-200/50',
                selectionRing: '#4f46e5',
                selectionBg: 'bg-indigo-100/30 dark:bg-indigo-900/40',
                headerSelected: 'bg-indigo-600',
                selectionBorder: '#4f46e5',
                actionBtn: 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 border-indigo-100 dark:border-indigo-700/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60',
                actionText: 'text-indigo-600',
                quickActionActive: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-800 dark:text-indigo-400',
                quickActionIcon: 'text-indigo-700',
                secondaryBtn: 'hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400',
                secondaryText: 'text-indigo-500 dark:text-indigo-400'
            };
        }
        switch (resolvedFileType) {
            case 'csv':
                return {
                    pill: 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-100/50 dark:border-emerald-700/50 transition-colors',
                    icon: 'text-emerald-500 dark:text-emerald-400',
                    selection: 'bg-emerald-50 text-emerald-700 border-emerald-200/50',
                    selectionRing: '#059669',
                    selectionBg: 'bg-emerald-100/30 dark:bg-emerald-900/40',
                    headerSelected: 'bg-emerald-600',
                    selectionBorder: '#059669',
                    actionBtn: 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300 border-emerald-100 dark:border-emerald-700/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60',
                    actionText: 'text-emerald-600',
                    quickActionActive: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400',
                    quickActionIcon: 'text-emerald-700',
                    secondaryBtn: 'hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-emerald-500 dark:text-emerald-400',
                    secondaryText: 'text-emerald-500 dark:text-emerald-400'
                };
            case 'json':
                return {
                    pill: 'bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-100/50 dark:border-amber-700/50 transition-colors',
                    icon: 'text-amber-500 dark:text-amber-400',
                    selection: 'bg-amber-50 text-amber-700 border-amber-200/50',
                    selectionRing: '#d97706',
                    selectionBg: 'bg-amber-100/30 dark:bg-amber-900/40',
                    headerSelected: 'bg-amber-600',
                    selectionBorder: '#d97706',
                    actionBtn: 'bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300 border-amber-100 dark:border-amber-700/50 hover:bg-amber-100 dark:hover:bg-amber-900/60',
                    actionText: 'text-amber-600',
                    quickActionActive: 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-400',
                    quickActionIcon: 'text-amber-700',
                    secondaryBtn: 'hover:bg-amber-50 dark:hover:bg-amber-900/30 text-amber-500 dark:text-amber-400',
                    secondaryText: 'text-amber-500 dark:text-amber-400'
                };
            case 'parquet':
                return {
                    pill: 'bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-100/50 dark:border-purple-700/50 transition-colors',
                    icon: 'text-purple-500 dark:text-purple-400',
                    selection: 'bg-purple-50 text-purple-700 border-purple-200/50',
                    selectionRing: '#7c3aed',
                    selectionBg: 'bg-purple-100/30 dark:bg-purple-900/40',
                    headerSelected: 'bg-purple-600',
                    selectionBorder: '#7c3aed',
                    actionBtn: 'bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 border-purple-100 dark:border-purple-700/50 hover:bg-purple-100 dark:hover:bg-purple-900/60',
                    actionText: 'text-purple-600',
                    quickActionActive: 'bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-400',
                    quickActionIcon: 'text-purple-700',
                    secondaryBtn: 'hover:bg-purple-50 dark:hover:bg-purple-900/30 text-purple-500 dark:text-purple-400',
                    secondaryText: 'text-purple-500 dark:text-purple-400'
                };
            default:
                // Fallback / saved query tables → violet
                return {
                    pill: 'bg-violet-50 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border-violet-100/50 dark:border-violet-700/50 transition-colors',
                    icon: 'text-violet-500 dark:text-violet-400',
                    selection: 'bg-violet-50 text-violet-700 border-violet-200/50',
                    selectionRing: '#7c3aed',
                    selectionBg: 'bg-violet-100/30 dark:bg-violet-900/40',
                    headerSelected: 'bg-violet-600',
                    selectionBorder: '#7c3aed',
                    actionBtn: 'bg-violet-50 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300 border-violet-100 dark:border-violet-700/50 hover:bg-violet-100 dark:hover:bg-violet-900/60',
                    actionText: 'text-violet-600',
                    quickActionActive: 'bg-violet-100 dark:bg-violet-500/20 text-violet-800 dark:text-violet-400',
                    quickActionIcon: 'text-violet-700',
                    secondaryBtn: 'hover:bg-violet-50 dark:hover:bg-violet-900/30 text-violet-500 dark:text-violet-400',
                    secondaryText: 'text-violet-500 dark:text-violet-400'
                };
        }
    };

    const colors = getColorClasses();


    useEffect(() => {
        if (isExternal) {
            if (externalRows && externalRows.length > 0) {
                const cols = externalColumns || Object.keys(externalRows[0]);
                setColumns(cols);
                const initialGrid: CellModel[][] = externalRows.map(row =>
                    cols.map(col => parseCellValue(String(row[col] ?? "")))
                );
                setGrid(initialGrid);
                setActiveStats({ rowCount: externalRows.length, colCount: cols.length });
                setOffset(0);
            }

            setError(null);
            return;
        }

        let active = true;
        setOffset(0);
        const initConnection = async () => {
            if (!actualTableName) return;
            try {
                const db = await getDB();
                const conn = await db.connect();
                if (active) {
                    connRef.current = conn;
                    fetchData();
                } else {
                    await conn.close();
                }
            } catch (err) {
                console.error("Failed to initialize connection:", err);
            }
        };

        if (connRef.current) {
            connRef.current.close().then(() => {
                connRef.current = null;
                if (active) initConnection();
            });
        } else {
            initConnection();
        }

        return () => {
            active = false;
            if (connRef.current) {
                connRef.current.close();
                connRef.current = null;
            }
        };
    }, [actualTableName]);

    const fetchData = async () => {
        const conn = connRef.current;
        if (isExternal || !actualTableName || !conn) return;

        setError(null);
        try {
            const { rebuildPipelineQuery } = useStore.getState();
            let baseQuery = `SELECT rowid, * FROM "${actualTableName}"`;

            let finalQuery = rebuildPipelineQuery(actualTableName, baseQuery);

            if (filterConfig && filterConfig.colKey && filterConfig.value !== undefined) {
                finalQuery = `SELECT * FROM (${finalQuery}) WHERE "${filterConfig.colKey}" ${filterConfig.operator} '${String(filterConfig.value).replace(/'/g, "''")}'`;
            }

            if (groupConfig && groupConfig.colKey) {
                finalQuery = `SELECT "${groupConfig.colKey}", COUNT(*) as count FROM (${finalQuery}) GROUP BY "${groupConfig.colKey}"`;
            }

            if (sortConfig && sortConfig.colKey) {
                finalQuery = `SELECT * FROM (${finalQuery}) ORDER BY "${sortConfig.colKey}" ${sortConfig.direction}`;
            }

            finalQuery += ` LIMIT ${limit} OFFSET ${offset}`;
            const result = await conn.query(finalQuery);
            const rows = result.toArray().map(r => r.toJSON());
            setData(rows);
            if (rows.length > 0) {
                const cols = Object.keys(rows[0]).filter(c => c !== 'rowid');
                setColumns(cols);
                const initialGrid: CellModel[][] = rows.map(row =>
                    cols.map(col => parseCellValue(String(row[col] ?? "")))
                );
                setGrid(initialGrid);

                // Fetch overall stats (using the filtered pipeline SQL, but without LIMIT/OFFSET)
                const countQuery = `SELECT COUNT(*) as total FROM (${rebuildPipelineQuery(actualTableName, baseQuery)})`;
                const countRes = await conn.query(countQuery);
                const totalRows = Number(countRes.toArray()[0].toJSON().total);

                // Get column count from a simple describe
                const colsRes = await conn.query(`DESCRIBE "${actualTableName}"`);
                const totalCols = colsRes.toArray().length;
                setActiveStats({ rowCount: totalRows, colCount: totalCols });
            } else {
                setColumns([]);
                setGrid([]);
                setActiveStats(null);
            }
        } catch (err: any) {
            console.error("Error fetching table data:", err);
            setError(err.message || "Failed to load table data");
        } finally {

        }
    };

    useEffect(() => {
        fetchData();
    }, [limit, offset, pipeline[actualTableName || ''], sortConfig, filterConfig, groupConfig]);




    const [editingCell, setEditingCell] = useState<{ rowId: number, colKey: string } | null>(null);
    const [typePopoverCol, setTypePopoverCol] = useState<string | null>(null);
    const [selectedNewType, setSelectedNewType] = useState<string | null>(null);
    const [tempValue, setTempValue] = useState<string>("");

    const handleCellMouseDown = (rowId: number, colKey: string, e: React.MouseEvent, colIdx?: number) => {
        lastActionRef.current = 'mouse_down';
        const cIdx = colIdx !== undefined ? colIdx : columns.indexOf(colKey);
        const isCtrl = e.ctrlKey || e.metaKey;
        const isShift = e.shiftKey;

        if (isShift && selection && selection.type === 'range') {
            setSelection(prev => {
                if (!prev) return null;
                const newRanges = [...prev.ranges];
                const activeRange = newRanges[prev.activeRangeIndex];
                newRanges[prev.activeRangeIndex] = { ...activeRange, focus: { row: rowId, col: cIdx } };
                return { ...prev, ranges: newRanges };
            });
        } else if (isCtrl && selection && selection.type === 'range') {
            const existingIdx = selection.ranges.findIndex(range => isCellInRange(rowId, cIdx, range));
            if (existingIdx !== -1) {
                // Toggle: Remove the range if it already exists
                const newRanges = selection.ranges.filter((_, i) => i !== existingIdx);
                if (newRanges.length === 0) {
                    setSelection(null);
                } else {
                    setSelection({ ...selection, ranges: newRanges, activeRangeIndex: Math.max(0, newRanges.length - 1) });
                }
            } else {
                const newRange = { anchor: { row: rowId, col: cIdx }, focus: { row: rowId, col: cIdx } };
                setDragStart({ row: rowId, col: cIdx });
                setIsDragging(true);
                setSelection({ ...selection, ranges: [...selection.ranges, newRange], activeRangeIndex: selection.ranges.length });
            }
        } else {
            setDragStart({ row: rowId, col: cIdx });
            setIsDragging(true);
            setSelection({ type: 'range', ranges: [{ anchor: { row: rowId, col: cIdx }, focus: { row: rowId, col: cIdx } }], activeRangeIndex: 0 });
        }
    };

    const handleCellMouseEnter = (rowId: number, colKey: string, colIdx?: number) => {
        if (!isDragging || !dragStart) return;
        const cIdx = colIdx !== undefined ? colIdx : columns.indexOf(colKey);
        setSelection(prev => {
            if (!prev || prev.type !== 'range') return prev;
            const newRanges = [...prev.ranges];
            newRanges[prev.activeRangeIndex] = { ...newRanges[prev.activeRangeIndex], focus: { row: rowId, col: cIdx } };
            return { ...prev, ranges: newRanges };
        });
    };

    const handleRowSelection = (rowId: number) => {
        if (editingCell) return;
        setSelection({ type: 'row', rowId, ranges: [], activeRangeIndex: -1 });
    };
    const handleColumnSelection = (colKey: string) => {
        if (editingCell) return;
        setSelection({ type: 'column', colKey, ranges: [], activeRangeIndex: -1 });
    };

    const handleHeaderClick = (colKey: string) => {
        handleColumnSelection(colKey);
        setSelectedColumn(colKey);

        // Three-state sort toggle: ASC -> DESC -> None
        const { setSortConfig } = useStore.getState();
        if (sortConfig?.colKey === colKey) {
            if (sortConfig.direction === 'ASC') {
                setSortConfig({ colKey, direction: 'DESC' });
            } else {
                setSortConfig(null);
            }
        } else {
            setSortConfig({ colKey, direction: 'ASC' });
        }

        if (actualTableName) {
            getColumnProfile(actualTableName, colKey);
        }
        setIsColumnProfileOpen(true);

        setTimeout(() => {
            const container = scrollContainerRef.current;
            const headerEl = document.getElementById(`col-header-${colKey}`);

            if (container && headerEl) {
                const containerRect = container.getBoundingClientRect();
                const headerRect = headerEl.getBoundingClientRect();

                // If the column header's right edge is forced under the right panel
                if (headerRect.right > containerRect.right) {
                    const overlap = headerRect.right - containerRect.right;
                    container.scrollBy({ left: overlap + 40, behavior: 'smooth' }); // Add 40px to safely clear the UI
                }
                // If the column header's left edge is hidden on the left side
                else if (headerRect.left < containerRect.left) {
                    const overlap = containerRect.left - headerRect.left;
                    container.scrollBy({ left: -(overlap + 40), behavior: 'smooth' });
                }
            }
        }, 150); // wait for flex layout to fully compute the smaller container width
    };

    const handleCellDoubleClick = (rowId: number, colKey: string, val: any) => {
        if (isExternal) return;
        setEditingCell({ rowId, colKey });
        setTempValue(val !== null && val !== undefined ? String(val) : "");
    };

    const handleSave = async (moveDirection?: 'down' | 'right') => {
        if (!editingCell || !actualTableName) return;
        const { rowId, colKey } = editingCell;
        const colIdx = columns.indexOf(colKey);
        const previousVal = grid[rowId][colIdx];

        if (tempValue === (previousVal?.raw ?? "")) {
            setEditingCell(null);
            setTempValue("");

            if (moveDirection) {
                let nextR = rowId;
                let nextC = columns.indexOf(colKey);

                if (moveDirection === 'down') nextR = Math.min(data.length - 1, rowId + 1);
                else if (moveDirection === 'right') nextC = Math.min(columns.length - 1, nextC + 1);

                setSelection({
                    type: 'range',
                    ranges: [{
                        anchor: { row: nextR, col: nextC },
                        focus: { row: nextR, col: nextC }
                    }],
                    activeRangeIndex: 0
                });
            }
            return;
        }

        const parsedModel = parseCellValue(tempValue);
        const cellAddr = coordsToAddress(rowId, colIdx);

        // Record history
        globalHistory.push({
            type: 'UPDATE_CELL',
            changes: [{
                rowId,
                colKey,
                oldValue: previousVal,
                newValue: parsedModel
            }]
        });
        setHistoryTick(t => t + 1);

        if (parsedModel.formula !== null) {
            try {
                const ast = parseFormula('=' + parsedModel.formula);
                const refs = extractReferencesFromAST(ast);
                globalDependencyGraph.register(cellAddr, refs);
                parsedModel.dependencies = refs;

                // Immediate evaluation
                const evalResult = evaluateFormula('=' + parsedModel.formula, { data, grid, columns, stagedChanges });
                parsedModel.value = evalResult.value;
            } catch (e: any) {
                console.error("Formula error:", e);
                parsedModel.value = "#ERROR";
            }
        } else {
            globalDependencyGraph.register(cellAddr, []);
        }

        const nextGrid = [...grid];
        nextGrid[rowId] = [...nextGrid[rowId]];
        nextGrid[rowId][colIdx] = parsedModel;

        const rowid = data[rowId].rowid;
        if (rowid !== undefined) {
            const changeKey = `${rowid}_${colKey}`;
            const previousCell = grid[rowId][colIdx];

            setStagedChanges(prev => ({
                ...prev,
                [changeKey]: {
                    newValue: parsedModel,
                    oldValue: previousCell.raw
                }
            }));
        }

        // Recalculate dependents in correct order
        const { order: affectedOrder, circular } = globalDependencyGraph.getRecalculationOrder(cellAddr);
        if (circular.length > 0 || affectedOrder.length > 0) {
            circular.forEach(addr => {
                const coords = addressToCoords(addr);
                if (!coords) return;
                const cell = nextGrid[coords.row][coords.col];
                if (cell.formula !== null) {
                    nextGrid[coords.row][coords.col] = { ...cell, value: "#CIRCULAR" };
                }
            });

            affectedOrder.forEach(addr => {
                if (circular.includes(addr)) return;
                const coords = addressToCoords(addr);
                if (!coords) return;
                const cell = nextGrid[coords.row][coords.col];
                if (cell.formula !== null) {
                    const res = evaluateFormula('=' + cell.formula, { data, grid: nextGrid, columns, stagedChanges });
                    nextGrid[coords.row][coords.col] = { ...cell, value: res.value };
                }
            });
        }
        setGrid([...nextGrid]);
        setEditingCell(null);
        setTempValue("");

        if (moveDirection) {
            let nextR = rowId;
            let nextC = columns.indexOf(colKey);

            if (moveDirection === 'down') nextR = Math.min(data.length - 1, rowId + 1);
            else if (moveDirection === 'right') nextC = Math.min(columns.length - 1, nextC + 1);

            setSelection({
                type: 'range',
                ranges: [{
                    anchor: { row: nextR, col: nextC },
                    focus: { row: nextR, col: nextC }
                }],
                activeRangeIndex: 0
            });
        }
    };


    const handleCommitChanges = async () => {
        if (Object.keys(stagedChanges).length === 0 || !actualTableName || !connRef.current) return;

        try {
            const conn = connRef.current;
            for (const [key, change] of Object.entries(stagedChanges)) {
                const [rowid, colKey] = [key.split('_')[0], key.split('_').slice(1).join('_')];
                const finalValue = change.newValue.value;
                const sqlValue = finalValue === null ? "NULL" :
                    typeof finalValue === 'number' ? finalValue :
                        `'${String(finalValue).replace(/'/g, "''")}'`;
                await conn.query(`UPDATE "${actualTableName}" SET "${colKey}" = ${sqlValue} WHERE rowid = ${rowid}`);
            }
            await conn.query("CHECKPOINT;");
            await fetchData();
            setStagedChanges({});
            setShowReviewPanel(false);
            // Committed changes are now permanent in DB — clear history so undo/redo don't operate on stale data
            globalHistory.clear();
            setHistoryTick(t => t + 1);
        } catch (err) {
            console.error("Commit failed:", err);
            alert("Failed to commit changes");
        } finally {

        }
    };


    const handleBatchClear = () => {
        if (!selection || isExternal || !actualTableName) return;
        if (selection.type === 'range') {
            const clearEntries: { changeKey: string; clearedCell: CellModel; originalVal: any }[] = [];

            selection.ranges.forEach(range => {
                const { minRow, maxRow, minCol, maxCol } = normalizeRange(range);
                for (let r = minRow; r <= maxRow; r++) {
                    const row = data[r];
                    if (row?.rowid === undefined) continue;
                    const rowid = row.rowid;
                    for (let c = minCol; c <= maxCol; c++) {
                        const ck = columns[c];
                        const changeKey = `${rowid}_${ck}`;
                        const originalVal = row[ck];
                        const previousCell = grid[r][c];

                        const isNumeric = typeof originalVal === 'number' ||
                            (previousCell && typeof previousCell.value === 'number') ||
                            (originalVal === null && previousCell?.raw === 'null');
                        const clearedCell: CellModel = isNumeric
                            ? { raw: 'null', value: null, formula: null, dependencies: [] }
                            : parseCellValue("");

                        clearEntries.push({ changeKey, clearedCell, originalVal });
                    }
                }
            });

            if (clearEntries.length === 0) return;

            // Apply: add staged changes
            setStagedChanges(prev => {
                const next = { ...prev };
                clearEntries.forEach(({ changeKey, clearedCell, originalVal }) => {
                    next[changeKey] = { newValue: clearedCell, oldValue: originalVal };
                });
                return next;
            });

            // Push to history with undo/redo callbacks
            globalHistory.push({
                type: 'CLEAR_BATCH',
                undo: () => {
                    setStagedChanges(prev => {
                        const next = { ...prev };
                        clearEntries.forEach(({ changeKey }) => delete next[changeKey]);
                        return next;
                    });
                },
                redo: () => {
                    setStagedChanges(prev => {
                        const next = { ...prev };
                        clearEntries.forEach(({ changeKey, clearedCell, originalVal }) => {
                            next[changeKey] = { newValue: clearedCell, oldValue: originalVal };
                        });
                        return next;
                    });
                }
            });
            setHistoryTick(t => t + 1);
        }
    };

    const applyActionChanges = (changes: any[], isReverse: boolean, currentStaged: any, currentCache: any) => {
        const nextStaged = { ...currentStaged };
        const nextCache = { ...currentCache };
        const nextGrid = [...grid.map(row => [...row])]; // Deep copy grid for modifications
        const affectedAddresses = new Set<string>();

        changes.forEach(change => {
            const { rowId, colKey, oldValue, newValue } = change;
            const targetVal = isReverse ? oldValue : newValue;
            const colIdx = columns.indexOf(colKey);

            const parsedModel = (typeof targetVal === 'object' && targetVal !== null && 'raw' in targetVal)
                ? targetVal as CellModel
                : parseCellValue(String(targetVal ?? ""));

            nextGrid[rowId] = [...nextGrid[rowId]];
            nextGrid[rowId][colIdx] = parsedModel;

            const addr = coordsToAddress(rowId, colIdx);

            if (parsedModel.formula !== null) {
                try {
                    const ast = parseFormula('=' + parsedModel.formula);
                    const refs = extractReferencesFromAST(ast);
                    globalDependencyGraph.register(addr, refs);
                    parsedModel.dependencies = refs;
                } catch (err: any) {
                    console.error(err);
                    parsedModel.value = "#ERROR";
                }
            } else {
                globalDependencyGraph.register(addr, []);
            }

            affectedAddresses.add(addr);
        });

        // Batch Re-evaluation
        const { order: affectedOrder, circular } = globalDependencyGraph.getBatchRecalculationOrder(Array.from(affectedAddresses));

        circular.forEach(addr => {
            const coords = addressToCoords(addr);
            if (!coords) return;
            const cell = nextGrid[coords.row][coords.col];
            if (cell.formula !== null) {
                nextGrid[coords.row][coords.col] = { ...cell, value: "#CIRCULAR" };
                nextCache[addr] = { value: "#CIRCULAR", error: "CIRCULAR_REFERENCE" };
            }
        });

        affectedOrder.forEach(addr => {
            if (circular.includes(addr)) return;
            const coords = addressToCoords(addr);
            if (!coords) return;
            const cell = nextGrid[coords.row][coords.col];
            if (cell.formula !== null) {
                const res = evaluateFormula('=' + cell.formula, { data, grid: nextGrid, columns, stagedChanges: nextStaged });
                nextGrid[coords.row][coords.col] = { ...cell, value: res.value };
                nextCache[addr] = res;
            }
        });

        setGrid([...nextGrid]);
        setStagedChanges(nextStaged);
        setComputedCache(nextCache);
    };

    const flatOrderedChanges = useMemo(() => {
        const grouped: Record<string, { rowid: string; changes: { key: string; colName: string; oldValue: any; newValue: any }[] }> = {};
        Object.entries(stagedChanges).forEach(([key, change]) => {
            const parts = key.split('_');
            const rowid = parts[0];
            const colName = parts.slice(1).join('_');
            if (!grouped[rowid]) grouped[rowid] = { rowid, changes: [] };
            grouped[rowid].changes.push({ key, colName, oldValue: change.oldValue, newValue: change.newValue });
        });
        return Object.values(grouped).flatMap(g => g.changes);
    }, [stagedChanges]);

    const handleUndo = () => {
        const action = globalHistory.undo();
        if (action) {
            // New pipeline actions use undo/redo callbacks
            if (action.undo) {
                action.undo();
            } else if (action.changes) {
                applyActionChanges(action.changes, true, stagedChanges, computedCache);
            }
            setHistoryTick(t => t + 1);
        }
    };

    const handleRedo = () => {
        const action = globalHistory.redo();
        if (action) {
            if (action.redo) {
                action.redo();
            } else if (action.changes) {
                applyActionChanges(action.changes, false, stagedChanges, computedCache);
            }
            setHistoryTick(t => t + 1);
        }
    };

    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (showReviewPanel) {
                const isCtrl = e.ctrlKey || e.metaKey;

                // Ctrl+S (Commit)
                if (isCtrl && e.key.toLowerCase() === 's') {
                    e.preventDefault();
                    handleCommitChanges();
                    return;
                }

                // Escape (Close)
                if (e.key === 'Escape') {
                    e.preventDefault();
                    setShowReviewPanel(false);
                    return;
                }

                // Navigation
                const count = flatOrderedChanges.length;
                if (count > 0) {
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setSelectedReviewIndex(prev => (prev + 1) % count);
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setSelectedReviewIndex(prev => (prev - 1 + count) % count);
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (selectedReviewIndex >= 0 && selectedReviewIndex < count) {
                            const change = flatOrderedChanges[selectedReviewIndex];
                            setStagedChanges(prev => {
                                const next = { ...prev };
                                delete next[change.key];
                                return next;
                            });
                        }
                    }
                }
            }

            if (!selection || editingCell || showAddColMenu || showLimitMenu || showExportMenu) return;

            const isCtrl = e.ctrlKey || e.metaKey;
            const isShift = e.shiftKey;

            // Ctrl+C (Copy)
            if (isCtrl && e.key.toLowerCase() === 'c') {
                e.preventDefault();
                if (selection.type !== 'range') return;
                const activeRange = selection.ranges[selection.activeRangeIndex];
                if (!activeRange) return;
                const { minRow, maxRow, minCol, maxCol } = normalizeRange(activeRange);

                const copiedData: { relR: number, relC: number, raw: string }[] = [];
                for (let r = minRow; r <= maxRow; r++) {
                    for (let c = minCol; c <= maxCol; c++) {
                        const cell = grid[r]?.[c];
                        const raw = cell ? cell.raw : '';
                        copiedData.push({ relR: r - minRow, relC: c - minCol, raw });
                    }
                }
                setClipboard({ data: copiedData, anchorRow: minRow, anchorCol: minCol });
                lastActionRef.current = 'ctrl+c';
                return;
            }

            // Ctrl+V (Paste)
            if (isCtrl && e.key.toLowerCase() === 'v') {
                e.preventDefault();
                if (!clipboard || selection.type !== 'range') return;
                const activeRange = selection.ranges[selection.activeRangeIndex];
                if (!activeRange) return;
                const targetRow = activeRange.focus.row;
                const targetCol = activeRange.focus.col;
                const rowOffset = targetRow - clipboard.anchorRow;
                const colOffset = targetCol - clipboard.anchorCol;

                const newStaged = { ...stagedChanges };
                const nextCache = { ...computedCache };
                const newGrid = [...grid.map(row => [...row])]; // Deep copy grid for modifications
                const pastedAddresses: string[] = [];
                const batchChanges: any[] = [];

                clipboard.data.forEach(item => {
                    const r = targetRow + item.relR;
                    const c = targetCol + item.relC;
                    if (r >= data.length || c >= columns.length) return;

                    const colKey = columns[c];
                    const cellAddr = coordsToAddress(r, c);
                    const previousVal = grid[r][c];

                    let raw = item.raw;
                    if (raw.startsWith('=')) {
                        raw = shiftFormula(raw, rowOffset, colOffset);
                    }

                    const parsedModel = parseCellValue(raw);
                    batchChanges.push({ rowId: r, colKey, oldValue: previousVal, newValue: parsedModel });

                    if (parsedModel.formula !== null) {
                        try {
                            const ast = parseFormula('=' + parsedModel.formula);
                            const refs = extractReferencesFromAST(ast);
                            globalDependencyGraph.register(cellAddr, refs);
                            parsedModel.dependencies = refs;

                            // Immediate evaluation
                            const evalResult = evaluateFormula('=' + parsedModel.formula, { data, grid: newGrid, columns, stagedChanges: newStaged });
                            parsedModel.value = evalResult.value;
                        } catch (err: any) {
                            console.error(err);
                            parsedModel.value = "#ERROR";
                        }
                    } else {
                        globalDependencyGraph.register(cellAddr, []);
                    }

                    newGrid[r] = [...newGrid[r]];
                    newGrid[r][c] = parsedModel;
                    pastedAddresses.push(cellAddr);
                });

                // Batch Re-evaluation
                const { order: affectedOrder, circular } = globalDependencyGraph.getBatchRecalculationOrder(pastedAddresses);

                circular.forEach(addr => {
                    const coords = addressToCoords(addr);
                    if (!coords) return;
                    const cell = newGrid[coords.row][coords.col];
                    if (cell.formula !== null) {
                        newGrid[coords.row][coords.col] = { ...cell, value: "#CIRCULAR" };
                        nextCache[addr] = { value: "#CIRCULAR", error: "CIRCULAR_REFERENCE" };
                    }
                });

                affectedOrder.forEach(addr => {
                    if (circular.includes(addr)) return;
                    const coords = addressToCoords(addr);
                    if (!coords) return;
                    const cell = newGrid[coords.row][coords.col];
                    if (cell.formula !== null) {
                        const res = evaluateFormula('=' + cell.formula, { data, grid: newGrid, columns, stagedChanges: newStaged });
                        newGrid[coords.row][coords.col] = { ...cell, value: res.value };
                        nextCache[addr] = res;
                    }
                });

                setGrid([...newGrid]);
                globalHistory.push({ type: 'PASTE_BATCH', changes: batchChanges });
                setHistoryTick(t => t + 1);
                setComputedCache(nextCache);
                lastActionRef.current = 'ctrl+v';
                return;
            }

            // Delete / Backspace
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                handleBatchClear();
                lastActionRef.current = 'clear';
                return;
            }

            // Undo / Redo
            if (isCtrl && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (isShift) handleRedo();
                else handleUndo();
                return;
            }
            if (isCtrl && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                handleRedo();
                return;
            }

            if (isCtrl && e.key === 'ArrowRight') {
                e.preventDefault();
                const total = activeStats?.rowCount || 0;
                if ((offset + limit) < total) {
                    setOffset(offset + limit);
                }
                return;
            }
            if (isCtrl && e.key === 'ArrowLeft') {
                e.preventDefault();
                setOffset(Math.max(0, offset - limit));
                return;
            }

            // Ctrl + A
            if (isCtrl && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                const isSheetSelected = selection.type === 'range' && selection.ranges.length === 1 &&
                    selection.ranges[0].anchor.row === 0 &&
                    selection.ranges[0].anchor.col === 0 &&
                    selection.ranges[0].focus.row === data.length - 1 &&
                    selection.ranges[0].focus.col === columns.length - 1;

                if (lastActionRef.current === 'ctrl+a' && !isSheetSelected) {
                    setSelection({
                        type: 'range',
                        ranges: [{
                            anchor: { row: 0, col: 0 },
                            focus: { row: Math.max(0, data.length - 1), col: Math.max(0, columns.length - 1) }
                        }],
                        activeRangeIndex: 0
                    });
                } else {
                    let activeRow = 0;
                    let activeCol = 0;
                    if (selection.type === 'range' && selection.ranges.length > 0) {
                        activeRow = selection.ranges[selection.activeRangeIndex].focus.row;
                        activeCol = selection.ranges[selection.activeRangeIndex].focus.col;
                    } else if (selection.type === 'row' && selection.rowId !== undefined) {
                        activeRow = selection.rowId;
                    } else if (selection.type === 'column' && selection.colKey) {
                        activeCol = columns.indexOf(selection.colKey);
                    }

                    const region = getDataRegion({ row: activeRow, col: activeCol }, data, columns);
                    setSelection({
                        type: 'range',
                        ranges: [{
                            anchor: { row: region.minRow, col: region.minCol },
                            focus: { row: region.maxRow, col: region.maxCol }
                        }],
                        activeRangeIndex: 0
                    });
                }
                lastActionRef.current = 'ctrl+a';
                return;
            }

            // Arrows, Enter, Tab
            if (e.key.startsWith('Arrow') || e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();

                let activeRange = selection.type === 'range' ? selection.ranges[selection.activeRangeIndex] : null;
                let r = 0;
                let c = 0;

                if (activeRange) {
                    r = activeRange.focus.row;
                    c = activeRange.focus.col;
                } else if (selection.type === 'row' && selection.rowId !== undefined) {
                    r = selection.rowId;
                    c = 0;
                } else if (selection.type === 'column' && selection.colKey) {
                    r = 0;
                    c = columns.indexOf(selection.colKey);
                }

                if (e.key === 'Enter') {
                    const colKey = columns[c];
                    const cell = grid[r]?.[c] || parseCellValue("");
                    setEditingCell({ rowId: r, colKey });
                    setTempValue(String(cell.raw ?? ""));
                    return;
                }

                let nextR = r;
                let nextC = c;

                if (e.key === 'ArrowUp') nextR = Math.max(0, r - 1);
                else if (e.key === 'ArrowDown') nextR = Math.min(data.length - 1, r + 1);
                else if (e.key === 'ArrowLeft') nextC = Math.max(0, c - 1);
                else if (e.key === 'ArrowRight' || e.key === 'Tab') nextC = Math.min(columns.length - 1, c + 1);

                if (isCtrl && e.key.startsWith('Arrow')) {
                    const dir = e.key.slice(5) as 'Up' | 'Down' | 'Left' | 'Right';
                    const jump = getJumpCoordinate({ row: r, col: c }, data, columns, grid, dir);
                    nextR = jump.row;
                    nextC = jump.col;
                }

                if (isShift && selection.type === 'range') {
                    // Expand Range
                    const newRanges = [...selection.ranges];
                    const dir = e.key.startsWith('Arrow') ? e.key.slice(5) as any : null;
                    const newFocus = dir ? expandRangeWithShift(activeRange!.focus, dir, data.length, columns.length) : { row: nextR, col: nextC };

                    newRanges[selection.activeRangeIndex] = { ...activeRange!, focus: newFocus };
                    setSelection({ ...selection, ranges: newRanges });
                    lastActionRef.current = 'expand';
                } else {
                    // Move/Collapse to single cell
                    setSelection({
                        type: 'range',
                        ranges: [{
                            anchor: { row: nextR, col: nextC },
                            focus: { row: nextR, col: nextC }
                        }],
                        activeRangeIndex: 0
                    });
                    lastActionRef.current = 'move';
                }
                return;
            }

            // F2 to Edit or Typing to Edit
            if (selection.type === 'range' || selection.type === 'row' || selection.type === 'column') {
                let r = 0;
                let c = 0;
                let activeRange = selection.type === 'range' ? selection.ranges[selection.activeRangeIndex] : null;

                if (activeRange) {
                    r = activeRange.focus.row;
                    c = activeRange.focus.col;
                } else if (selection.type === 'row' && selection.rowId !== undefined) {
                    r = selection.rowId;
                    c = 0;
                } else if (selection.type === 'column' && selection.colKey) {
                    r = 0;
                    c = columns.indexOf(selection.colKey);
                }

                if (e.key === 'F2') {
                    e.preventDefault();
                    const colKey = columns[c];
                    const cell = grid[r]?.[c] || parseCellValue("");
                    setEditingCell({ rowId: r, colKey });
                    setTempValue(String(cell.raw ?? ""));
                    return;
                }
            }

            lastActionRef.current = null;
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [selection, editingCell, showAddColMenu, showLimitMenu, showExportMenu, data, columns, grid, stagedChanges, clipboard]);

    const evalContext = useMemo(() => ({
        data,
        grid,
        columns,
        stagedChanges,
        computedCache,
        historyTick
    }), [data, grid, columns, stagedChanges, computedCache, historyTick]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            handleSave();
        } else if (e.key === 'Tab') {
            e.preventDefault();
            e.stopPropagation();
            handleSave('right');
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            setEditingCell(null);
        }
    };

    const handleAddColumn = async () => {
        const conn = connRef.current;
        if (!newColName.trim() || !actualTableName || !conn) return;

        if (newColExpression.trim()) {
            createComputedColumn(actualTableName, newColName, newColExpression);
            setShowAddColMenu(false);
            setNewColName("");
            setNewColExpression("");
            return;
        }

        try {
            await conn.query(`ALTER TABLE "${actualTableName}" ADD COLUMN "${newColName.replace(/"/g, '""')}" VARCHAR`);
            await conn.query("CHECKPOINT;");
            await fetchData();
            setShowAddColMenu(false);
            setNewColName("");
            setNewColExpression("");
        } catch (err) {
            console.error("Failed to add column:", err);
        }
    };



    return (
        <div className="fixed inset-0 bg-white dark:bg-[#111111] z-[9999] flex flex-col w-full h-full overflow-hidden font-sans transition-colors duration-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 dark:border-white/10 bg-white dark:bg-[#141414] shadow-sm z-[100] shrink-0 transition-colors duration-200">
                <div className="flex items-center gap-3">
                    <button title="Close Table" onClick={() => (isExternal ? clearSQLResult() : setActiveFile(null))} className={`p-2 ${colors.secondaryBtn} rounded-md transition-colors`}><X size={16} /></button>

                    <div className={`flex items-center gap-2 px-2 py-1 ${colors.pill} rounded-md text-sm font-medium border animate-in slide-in-from-left-2 duration-300`}>
                        <Table size={14} className={colors.icon} />
                        <span>{isExternal ? 'SQL Results' : fileName}</span>
                    </div>
                    <div className="h-6 w-[0.5px] bg-stone-200 dark:bg-white/10 mx-1"></div>
                    <div className="relative group cursor-pointer" onClick={() => {
                        if (onboardingStep === 2) nextOnboardingStep();
                        setShowAssistant(true);
                    }}>
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500" />

                        {/* The Search Bar Input Lookalike */}
                        <div
                            title="Open Assistant"
                            className={`flex items-center justify-between bg-stone-50 dark:bg-white/5 hover:bg-stone-100 dark:hover:bg-white/10 rounded-lg py-1.5 pl-8 pr-2 text-sm w-72 text-stone-400 dark:text-stone-500 select-none transition-all duration-300 border ${onboardingStep === 2
                                ? 'border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)] dark:shadow-[0_0_15px_rgba(99,102,241,0.3)] z-50'
                                : 'border-transparent dark:border-white/5'
                                }`}
                        >
                            <span>Sort, filter, or ask anything...</span>
                            <div className="flex items-center gap-1 opacity-60">
                                <kbd className="font-sans px-1.5 py-0.5 text-[10px] rounded bg-stone-200 dark:bg-stone-700 text-stone-500 dark:text-stone-300">⌘</kbd>
                                <kbd className="font-sans px-1.5 py-0.5 text-[10px] rounded bg-stone-200 dark:bg-stone-700 text-stone-500 dark:text-stone-300">K</kbd>
                            </div>
                        </div>

                        {/* Onboarding Step 2 Tooltip */}
                        {onboardingStep === 2 && (
                            <div className="absolute top-1/2 left-0 translate-x-[42px] -translate-y-[calc(50%-34px)] flex items-center z-[11000] pointer-events-none animate-in fade-in zoom-in duration-500">
                                {/* Pulsing Background Shade (Bottom Layer) */}
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[52px] h-[52px] rounded-full bg-indigo-300/40 animate-pulse z-0" style={{ animationDuration: '1s' }} />

                                {/* Static Cursor Icon (Top Layer) */}
                                <div className="relative z-20 flex-shrink-0 w-[52px] h-[52px] flex items-center justify-center">
                                    <MousePointer2 className="w-[20px] h-[20px] text-[#222] fill-[#222] stroke-white stroke-[2px] ml-0.5 mt-0.5" />
                                </div>

                                {/* Tooltip Text Bar (Middle Layer) */}
                                <div className="relative z-10 bg-white dark:bg-slate-900 pl-[16px] pr-[10px] h-[40px] rounded-[10px] shadow-[0_4px_16px_rgba(0,0,0,0.06)] border border-slate-200/60 dark:border-slate-800/60 ml-[2px] whitespace-nowrap flex items-center justify-center">
                                    <p className="text-[#334155] dark:text-slate-100 font-normal text-[15px] tracking-[0.015em] ml-1">
                                        Press CMD+K to search or ask AI
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Navigation Buttons */}
                    {queryResult && (
                        <div className="flex items-center gap-0.5 border border-stone-200 dark:border-white/10 rounded-md shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-0.5 bg-stone-50/50 dark:bg-white/5">
                            <button
                                title="Back to Original Table"
                                onClick={() => setViewMode('table')}
                                disabled={viewMode === 'table'}
                                className={`p-1 ${colors.secondaryBtn} hover:bg-white dark:hover:bg-white/10 hover:shadow-sm dark:hover:shadow-none rounded disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none transition-all duration-200`}
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button
                                title="Forward to SQL Results"
                                onClick={() => setViewMode('query')}
                                disabled={viewMode === 'query' || !queryResult}
                                className={`p-1 ${colors.secondaryBtn} hover:bg-white dark:hover:bg-white/10 hover:shadow-sm dark:hover:shadow-none rounded disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none transition-all duration-200`}
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    )}

                </div>
                <div className="flex items-center gap-4 text-xs font-medium text-stone-500">
                    <div className="flex items-center gap-1 border-r border-stone-200 pr-4 mr-1">
                        <button
                            title="Undo (Ctrl+Z)"
                            onClick={handleUndo}
                            disabled={!globalHistory.canUndo()}
                            className={`p-1.5 ${colors.secondaryBtn} rounded disabled:opacity-30 transition-colors`}
                        >
                            <Undo2 size={16} />
                        </button>
                        <button
                            title="Redo (Ctrl+Y)"
                            onClick={handleRedo}
                            disabled={!globalHistory.canRedo()}
                            className={`p-1.5 ${colors.secondaryBtn} rounded disabled:opacity-30 transition-colors`}
                        >
                            <Redo2 size={16} />
                        </button>
                    </div>
                    <button title="Undo All Changes" onClick={() => setStagedChanges({})} disabled={Object.keys(stagedChanges).length === 0} className="text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-300 px-2 py-1.5 font-bold disabled:opacity-30 transition-colors">Undo</button>
                    <button title="Commit Staged Changes" onClick={handleCommitChanges} disabled={Object.keys(stagedChanges).length === 0} className={`${colors.actionBtn} px-4 py-1.5 rounded-md font-bold disabled:opacity-30 transition-colors`}>Commit {Object.keys(stagedChanges).length}</button>
                    <div className="h-4 w-px bg-stone-200 dark:bg-stone-700"></div>
                    {isExportSupported && actualTableName && !isExternal && (
                        <button
                            title="Toggle Pipeline Panel"
                            onClick={() => setShowPipelinePanel(!showPipelinePanel)}
                            className={`px-2 py-1.5 font-bold transition-colors ${showPipelinePanel ? colors.actionText : 'text-stone-500 hover:text-stone-700'}`}
                        >
                            Pipeline
                        </button>
                    )}
                    <div className="h-4 w-[0.5px] bg-stone-200 dark:bg-white/10 mx-2"></div>
                    <div className="flex items-center gap-5 px-4 text-[11px] font-medium text-stone-400 whitespace-nowrap select-none">
                        <button
                            onClick={() => setSettingsOpen(true)}
                            className="p-1 hover:bg-stone-100 rounded text-stone-400 hover:text-stone-600 transition-colors -ml-1 transition-transform hover:rotate-45 duration-300"
                            title="Table Settings"
                        >
                            <Settings size={14} />
                        </button>
                        {activeStats ? (
                            <>
                                <span><span className="text-stone-600 font-semibold">{activeStats.rowCount.toLocaleString()}</span> rows</span>
                                <span><span className="text-stone-600 font-semibold">{activeStats.colCount.toLocaleString()}</span> cols</span>
                            </>
                        ) : (
                            <>
                                <span>{data.length} rows</span>
                                <span>{columns.length} cols</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-row flex-nowrap min-w-0 min-h-0 overflow-hidden relative">
                <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-white dark:bg-[#141414] transition-colors">
                    <div className={`overflow-hidden transition-all duration-700 ease-in-out ${selection ? 'h-10 border-b border-stone-200 dark:border-white/10' : 'h-0 border-b-0'} bg-white dark:bg-[#141414] flex items-center px-3 z-20 shrink-0`}>
                        <div className={`flex items-center gap-3 w-full transition-opacity duration-700 ${isFormulaBarExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'}`}>
                            {/* = toggle */}
                            <button
                                onClick={() => setIsFormulaBarExpanded(!isFormulaBarExpanded)}
                                title={isFormulaBarExpanded ? "Collapse Formula Bar" : "Expand Formula Bar"}
                                className="shrink-0 w-5 text-center text-stone-400 hover:text-stone-600 text-[13px] font-medium transition-colors select-none"
                            >
                                =
                            </button>
                            {/* Content area */}
                            <div className={`flex items-center gap-2 flex-1 min-w-0 transition-all duration-700 ${isFormulaBarExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'}`}>
                                {selection && (() => {
                                    let r = -1, c = -1;

                                    if (selection.type === 'range' && selection.ranges.length > 0) {
                                        const activeRange = selection.ranges[selection.activeRangeIndex] || selection.ranges[0];
                                        r = activeRange.focus.row;
                                        c = activeRange.focus.col;
                                    } else if (selection.type === 'row' && selection.rowId !== undefined) {
                                        r = selection.rowId;
                                        c = 0;
                                    } else if (selection.type === 'column' && selection.colKey) {
                                        r = 0;
                                        c = columns.indexOf(selection.colKey);
                                    }

                                    if (r === -1 || c === -1) return null;

                                    const colKey = columns[c];
                                    const cell = grid[r]?.[c] || parseCellValue("");
                                    const rawVal = cell.raw;
                                    const computedVal = cell.value;
                                    const isFormula = cell.formula !== null;
                                    const isEditing = editingCell?.rowId === r && editingCell?.colKey === colKey;
                                    const cellAddr = coordsToAddress(r, c);
                                    const cached = evalContext.computedCache?.[cellAddr];
                                    const displayVal = isFormula ? (cached?.value ?? computedVal) : rawVal;

                                    const label = selection.type === 'row'
                                        ? `row ${r + 1}`
                                        : selection.type === 'column'
                                            ? colKey
                                            : `${colKey} @ row ${r + 1}`;

                                    return (
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            {/* Tag — exactly like reference: "stories @ row 190" */}
                                            <span className="shrink-0 px-1.5 py-[1px] rounded-[3px] bg-stone-100 dark:bg-white/10 text-violet-600 dark:text-violet-300 text-[11.5px] font-mono whitespace-nowrap leading-[18px]">
                                                {label}
                                            </span>
                                            <span className="shrink-0 text-stone-300 dark:text-stone-600 text-[11px] select-none">|</span>
                                            {/* Value area */}
                                            {isEditing ? (
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    title="Cell value editor"
                                                    className="flex-1 min-w-0 bg-transparent border-none outline-none text-stone-800 dark:text-stone-200 text-[13px]"
                                                    value={tempValue}
                                                    onChange={e => setTempValue(e.target.value)}
                                                    onKeyDown={handleKeyDown}
                                                    placeholder=""
                                                />
                                            ) : (
                                                <span
                                                    className="flex-1 min-w-0 truncate text-stone-700 dark:text-stone-300 text-[13px] cursor-text select-text"
                                                    onClick={() => {
                                                        setEditingCell({ rowId: r, colKey });
                                                        setTempValue(String(rawVal ?? ""));
                                                    }}
                                                >
                                                    {isFormula
                                                        ? <><span className="text-violet-500 font-mono">=&thinsp;{cell.formula}</span>&ensp;<span className="text-stone-300 dark:text-stone-600">→</span>&ensp;<span className="text-stone-500">{String(displayVal ?? '')}</span></>
                                                        : <span>{String(displayVal ?? '\u00a0')}</span>
                                                    }
                                                </span>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>

                    <div ref={scrollContainerRef} className="flex-1 overflow-auto relative select-none no-scrollbar" onMouseDown={e => e.target === e.currentTarget && setSelection(null)}>
                        {error && (
                            <div className="absolute inset-x-0 top-32 flex flex-col items-center justify-center p-6 text-center z-[60] animate-in fade-in slide-in-from-top-4 duration-300">
                                <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl mb-4 max-w-md border border-red-100 dark:border-red-900/20 shadow-sm">
                                    <AlertCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
                                    <p className="text-red-600 dark:text-red-400 font-medium text-sm">{error}</p>
                                </div>
                            </div>
                        )}
                        {selection && (
                            <div className="absolute top-[31px] left-0 pointer-events-none z-10">
                                {selection.type === 'range' && selection.ranges.map((range, idx) => {
                                    const { minRow, maxRow, minCol, maxCol } = normalizeRange(range);
                                    // Skip single cell ranges to avoid double borders (GridCell uses cell-selected class)
                                    if (minRow === maxRow && minCol === maxCol) return null;

                                    const top = rowOffsets[minRow];
                                    const left = columnOffsets[minCol] + 48;
                                    const width = columnOffsets[maxCol + 1] - columnOffsets[minCol];
                                    const height = rowOffsets[maxRow + 1] - rowOffsets[minRow];
                                    return (
                                        <div
                                            key={`range-${idx}`}
                                            style={{
                                                position: 'absolute',
                                                top: top - 1,
                                                left: left - 1,
                                                width: width + 2,
                                                height: height + 2,
                                                backgroundColor: `${colors.selectionRing}14`, // ~8% opacity
                                                border: `2px solid ${colors.selectionRing}`,
                                                boxSizing: 'border-box',
                                                zIndex: 40
                                            }}
                                        />
                                    );
                                })}
                                {selection.type === 'row' && selection.rowId !== undefined && (
                                    <div
                                        style={{
                                            position: 'absolute',
                                            top: rowOffsets[selection.rowId] - 1,
                                            left: 47,
                                            width: columnOffsets[columnOffsets.length - 1] + 2,
                                            height: (rowHeights[selection.rowId] || 40) + 2,
                                            backgroundColor: `${colors.selectionRing}14`,
                                            border: `2px solid ${colors.selectionRing}`,
                                            boxSizing: 'border-box',
                                            zIndex: 40
                                        }}
                                    />
                                )}
                                {selection.type === 'column' && selection.colKey && (
                                    <div
                                        style={{
                                            position: 'absolute',
                                            top: -1,
                                            left: columnOffsets[columns.indexOf(selection.colKey)] + 47,
                                            width: (columnWidths[selection.colKey] || 150) + 2,
                                            height: rowOffsets[rowOffsets.length - 1] + 2,
                                            backgroundColor: `${colors.selectionRing}0D`, // ~5% opacity
                                            border: `2px solid ${colors.selectionRing}`,
                                            boxSizing: 'border-box',
                                            zIndex: 40
                                        }}
                                    />
                                )}
                            </div>
                        )}
                        <table className="border-collapse text-sm text-left table-fixed dark:text-stone-300" style={{ width: tableWidth, minWidth: tableWidth }}>
                            <thead className="text-xs text-stone-500 dark:text-stone-400 font-medium bg-stone-50 dark:bg-[#1a1a1a] sticky top-0 z-30 border-b border-stone-200 dark:border-white/10 transition-colors">
                                <tr>
                                    <th className="w-12 px-3 py-2 bg-stone-50 dark:bg-[#1a1a1a] border-r border-stone-200 dark:border-white/10 sticky left-0 z-40 transition-colors">#</th>
                                    {columns.map(col => {
                                        const isColSelected = selection?.type === 'column' && selection.colKey === col;
                                        return (
                                            <th
                                                key={col}
                                                id={`col-header-${col}`}
                                                onClick={e => { e.stopPropagation(); handleHeaderClick(col); }}
                                                style={{ width: columnWidths[col] || 150 }}
                                                className={`pl-4 pr-2 py-2 border-r border-stone-200 dark:border-white/10 cursor-pointer relative transition-colors group ${isColSelected ? `${colors.headerSelected} text-white` : 'hover:bg-stone-100 dark:hover:bg-white/5'}`}
                                            >
                                                <div className="flex items-center overflow-hidden truncate">
                                                    {(() => {
                                                        const storeSchema = useStore.getState().schema;
                                                        const colSchema = storeSchema?.columns?.[actualTableName]?.find((c: any) => c.name === col);
                                                        const t = (colSchema?.type || '').toUpperCase();
                                                        const cls = isColSelected ? 'text-violet-100' : 'text-stone-400';
                                                        if (t.includes('INT') || t.includes('BIGINT') || t.includes('SMALLINT') || t.includes('TINYINT')) return <Hash size={14} className={cls} />;
                                                        if (t.includes('DOUBLE') || t.includes('FLOAT') || t.includes('DECIMAL') || t.includes('NUMERIC') || t.includes('REAL')) return <Hash size={14} className={cls} />;
                                                        if (t.includes('TIMESTAMP') || t.includes('DATETIME')) return <Clock size={14} className={cls} />;
                                                        if (t.includes('DATE')) return <Calendar size={14} className={cls} />;
                                                        if (t.includes('BOOL')) return <CircleDot size={14} className={cls} />;
                                                        return <Type size={14} className={cls} />;
                                                    })()}
                                                    <span className="flex-1 truncate ml-2 font-medium">{col}</span>
                                                    {sortConfig?.colKey === col && (
                                                        <span className="ml-1 shrink-0">
                                                            {sortConfig.direction === 'ASC' ? (
                                                                <ArrowUp size={14} className={isColSelected ? 'text-white' : 'text-stone-500'} />
                                                            ) : (
                                                                <ArrowDown size={14} className={isColSelected ? 'text-white' : 'text-stone-500'} />
                                                            )}
                                                        </span>
                                                    )}
                                                    <div className={`opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded shrink-0 ml-1 ${isColSelected ? 'hover:bg-white/20' : 'hover:bg-stone-200/50'}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (typePopoverCol === col) {
                                                                setTypePopoverCol(null);
                                                            } else {
                                                                setTypePopoverCol(col);
                                                                getColumnProfile(actualTableName!, col);
                                                                setSelectedNewType(null);
                                                            }
                                                        }}
                                                    >
                                                        <MoreVertical size={14} className={isColSelected ? 'text-white' : 'text-stone-500'} />
                                                    </div>

                                                    {typePopoverCol === col && (
                                                        <div className="absolute top-full left-[120px] mt-1 w-[360px] bg-white dark:bg-[#1a1a1a] border border-stone-200 dark:border-white/10 rounded-2xl shadow-xl dark:shadow-black/50 z-[100] overflow-hidden flex flex-col text-stone-800 dark:text-stone-200 whitespace-normal text-left transition-colors" onClick={e => e.stopPropagation()}>
                                                            <div className="px-5 py-5 pb-2 border-b-0 flex items-center justify-between">
                                                                <h3 className="text-[14px] flex items-center gap-1.5">
                                                                    <span className="text-[#4b5563] dark:text-stone-400">Column Type:</span> <span className="font-semibold font-mono">{col}</span>
                                                                </h3>
                                                                <button
                                                                    onClick={() => setTypePopoverCol(null)}
                                                                    className="p-1.5 hover:bg-stone-100 dark:hover:bg-white/10 rounded-lg transition-colors text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300"
                                                                    aria-label="Close"
                                                                    title="Close"
                                                                >
                                                                    <X size={16} />
                                                                </button>
                                                            </div>

                                                            <div className="p-2 flex flex-col gap-0.5">
                                                                {(() => {
                                                                    const rawType = (columnProfile?.name === col ? columnProfile.type : '').toUpperCase();
                                                                    const isNumericType = rawType.includes('INT') || rawType.includes('DOUBLE') || rawType.includes('FLOAT') || rawType.includes('DECIMAL') || rawType.includes('NUMERIC') || rawType.includes('REAL');
                                                                    const isTemporalType = rawType.includes('DATE') || rawType.includes('TIMESTAMP') || rawType.includes('TIME');
                                                                    const isBoolType = rawType.includes('BOOL');

                                                                    const validTargets: Record<string, boolean> = {
                                                                        'Text': true,
                                                                        'Integer': !isTemporalType && !isBoolType,
                                                                        'Decimal': !isTemporalType && !isBoolType,
                                                                        'Boolean': !isNumericType && !isTemporalType,
                                                                        'Date': !isNumericType && !isBoolType,
                                                                        'Timestamp': !isNumericType && !isBoolType,
                                                                    };

                                                                    return [
                                                                        { id: 'Text', icon: <span className="text-[11px] font-bold">Aa</span>, desc: 'Preserves leading zeros, special characters', color: 'stone' },
                                                                        { id: 'Integer', icon: <Hash size={16} />, desc: 'Whole numbers only', color: 'blue' },
                                                                        { id: 'Decimal', icon: <span className="text-[11px] font-bold">#.#</span>, desc: 'Numbers with decimals', color: 'blue' },
                                                                        { id: 'Boolean', icon: <CircleDot size={16} />, desc: 'True/false values', color: 'purple' },
                                                                        { id: 'Date', icon: <Calendar size={16} />, desc: 'Date values (YYYY-MM-DD)', color: 'amber' },
                                                                        { id: 'Timestamp', icon: <Clock size={16} />, desc: 'Date and time', color: 'amber' },
                                                                    ].map((t) => {
                                                                        const isCurrent = columnProfile?.name === col && (
                                                                            (t.id === 'Text' && (columnProfile.type.includes('VARCHAR') || columnProfile.type.includes('TEXT'))) ||
                                                                            (t.id === 'Integer' && (columnProfile.type.includes('INT') || columnProfile.type.includes('BIGINT'))) ||
                                                                            (t.id === 'Decimal' && (columnProfile.type.includes('DOUBLE') || columnProfile.type.includes('FLOAT') || columnProfile.type.includes('DECIMAL'))) ||
                                                                            (t.id === 'Boolean' && columnProfile.type.includes('BOOL')) ||
                                                                            (t.id === 'Date' && columnProfile.type === 'DATE') ||
                                                                            (t.id === 'Timestamp' && (columnProfile.type.includes('TIMESTAMP') || columnProfile.type.includes('DATETIME')))
                                                                        );

                                                                        const isSelected = selectedNewType === t.id;
                                                                        const isDisabled = isCurrent || validTargets[t.id] === false;

                                                                        const colorMap: any = {
                                                                            stone: 'bg-[#f0f2f5] dark:bg-white/5 text-[#4b5563] dark:text-stone-400',
                                                                            blue: 'bg-[#eef2ff] dark:bg-blue-500/10 text-[#3b82f6] dark:text-blue-400',
                                                                            purple: 'bg-[#f3e8ff] dark:bg-purple-500/10 text-[#8b5cf6] dark:text-purple-400',
                                                                            amber: 'bg-[#fff7ed] dark:bg-amber-500/10 text-[#f59e0b] dark:text-amber-400'
                                                                        };

                                                                        return (
                                                                            <button
                                                                                key={t.id}
                                                                                disabled={isDisabled}
                                                                                onClick={() => !isDisabled && setSelectedNewType(t.id)}
                                                                                className={`flex items-start gap-3 p-2 rounded-xl text-left transition-colors relative ${isDisabled ? 'opacity-40 cursor-not-allowed' : isSelected ? 'bg-[#f4f6fa] dark:bg-white/5' : 'hover:bg-stone-50 dark:hover:bg-white/5'}`}
                                                                            >
                                                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${colorMap[t.color]}`}>
                                                                                    {t.icon}
                                                                                </div>
                                                                                <div className="flex-1 min-w-0 pr-6 pt-1">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className={`text-[13px] font-medium text-[#1f2937] dark:text-stone-200`}>{t.id}</span>
                                                                                        {isCurrent && <span className="text-[10px] font-bold text-[#d1d5db] dark:text-stone-500 uppercase tracking-wider">current</span>}
                                                                                    </div>
                                                                                    <div className="text-[12px] text-[#9ca3af] dark:text-stone-400 mt-0.5 leading-snug">{t.desc}</div>
                                                                                </div>
                                                                                {isSelected && (
                                                                                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                                                                        <Check size={18} className="text-[#8b5cf6] dark:text-purple-400" strokeWidth={2} />
                                                                                    </div>
                                                                                )}
                                                                            </button>
                                                                        );
                                                                    });
                                                                })()}
                                                            </div>

                                                            {selectedNewType && !(
                                                                columnProfile?.name === col && (
                                                                    (selectedNewType === 'Text' && (columnProfile.type.includes('VARCHAR') || columnProfile.type.includes('TEXT'))) ||
                                                                    (selectedNewType === 'Integer' && (columnProfile.type.includes('INT') || columnProfile.type.includes('BIGINT'))) ||
                                                                    (selectedNewType === 'Decimal' && (columnProfile.type.includes('DOUBLE') || columnProfile.type.includes('FLOAT') || columnProfile.type.includes('DECIMAL'))) ||
                                                                    (selectedNewType === 'Boolean' && columnProfile.type.includes('BOOL')) ||
                                                                    (selectedNewType === 'Date' && columnProfile.type === 'DATE') ||
                                                                    (selectedNewType === 'Timestamp' && (columnProfile.type.includes('TIMESTAMP') || columnProfile.type.includes('DATETIME')))
                                                                )
                                                            ) && (
                                                                    <div className="px-4 py-2 pt-0">
                                                                        <div className="bg-[#f9fafb] dark:bg-white/5 p-3 rounded-xl border border-stone-100 dark:border-white/10 transition-colors">
                                                                            <h4 className="text-[13px] font-semibold text-[#334155] dark:text-stone-300 mb-1">Type conversion</h4>
                                                                            <p className="text-[12px] text-[#64748b] dark:text-stone-400 leading-relaxed">
                                                                                Values will be converted to the new type.<br />Invalid values become null.
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                            <div className="px-5 py-3 pb-4 flex items-center justify-end gap-6 bg-white dark:bg-[#1a1a1a] border-t-0 transition-colors">
                                                                <button
                                                                    onClick={() => setTypePopoverCol(null)}
                                                                    className="text-[13px] font-medium text-[#4b5563] dark:text-stone-400 hover:text-[#111827] dark:hover:text-stone-200 transition-colors"
                                                                >
                                                                    Cancel
                                                                </button>
                                                                <button
                                                                    disabled={!selectedNewType}
                                                                    onClick={async () => {
                                                                        if (selectedNewType && actualTableName) {
                                                                            const result = await changeColumnType(actualTableName, col, selectedNewType);
                                                                            if (result.success) {
                                                                                showToast(`Column "${col}" type changed to ${selectedNewType}`, 'success');
                                                                                setTypePopoverCol(null);
                                                                            } else {
                                                                                showToast(`Type conversion not allowed: ${result.error}`, 'error');
                                                                            }
                                                                        }
                                                                    }}
                                                                    className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-all ${selectedNewType ? 'bg-[#8b5cf6] dark:bg-purple-600 text-white hover:bg-[#7c3aed] dark:hover:bg-purple-500 active:scale-95 shadow-sm' : 'bg-stone-100 dark:bg-white/5 text-stone-400 dark:text-stone-500 cursor-not-allowed'}`}
                                                                >
                                                                    Change Type
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div onMouseDown={e => handleResizeStart(e, 'col', col, columnWidths[col] || 150)} className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-emerald-400/50 ${isColSelected ? 'opacity-0' : ''}`} />
                                            </th>
                                        );
                                    })}
                                    <th className="w-10 bg-stone-50 dark:bg-[#1a1a1a] border-l border-stone-200 dark:border-white/10 text-center cursor-pointer relative hover:bg-stone-100 dark:hover:bg-white/5 transition-colors" onClick={() => setShowAddColMenu(!showAddColMenu)}>
                                        <Plus size={14} className="mx-auto text-stone-400 dark:text-stone-500" />
                                        {showAddColMenu && (
                                            <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-[#1a1a1a] border border-stone-200 dark:border-white/10 rounded-lg shadow-xl dark:shadow-black/50 p-3 z-50 flex flex-col gap-3 transition-colors" onClick={e => e.stopPropagation()}>
                                                <div className="flex flex-col gap-1 text-left">
                                                    <label className="text-[10px] text-stone-400 dark:text-stone-500 font-bold uppercase tracking-wider">Name</label>
                                                    <input
                                                        autoFocus
                                                        title="Column Name"
                                                        className="bg-transparent dark:bg-[#141414] border border-stone-200 dark:border-white/10 p-1.5 text-xs rounded text-stone-800 dark:text-stone-200 placeholder:text-stone-400 dark:placeholder:text-stone-600 focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-500/50 focus:border-emerald-500 dark:focus:border-emerald-500/50 outline-none transition-colors"
                                                        value={newColName}
                                                        onChange={e => setNewColName(e.target.value)}
                                                        placeholder="e.g. total"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1 text-left">
                                                    <label className="text-[10px] text-stone-400 dark:text-stone-500 font-bold uppercase tracking-wider">Expression (optional)</label>
                                                    <input
                                                        title="Column Expression"
                                                        className="bg-transparent dark:bg-[#141414] border border-stone-200 dark:border-white/10 p-1.5 text-xs rounded text-stone-800 dark:text-stone-200 placeholder:text-stone-400 dark:placeholder:text-stone-600 focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-500/50 focus:border-emerald-500 dark:focus:border-emerald-500/50 outline-none transition-colors"
                                                        value={newColExpression}
                                                        onChange={e => setNewColExpression(e.target.value)}
                                                        onKeyDown={e => e.key === 'Enter' && handleAddColumn()}
                                                        placeholder="e.g. price * quantity"
                                                    />
                                                </div>
                                                <div className="flex justify-end gap-2 text-[10px] font-bold pt-1">
                                                    <button
                                                        title="Cancel Add Column"
                                                        onClick={() => { setShowAddColMenu(false); setNewColName(""); setNewColExpression(""); }}
                                                        className="text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 px-2 py-1 transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        title="Confirm Add Column"
                                                        onClick={handleAddColumn}
                                                        className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 px-3 py-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                                                    >
                                                        Create Column
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 dark:divide-white/5 relative">
                                {grid.map((_, rowIndex) => (
                                    <tr key={rowIndex} className="group hover:bg-stone-50/50 dark:hover:bg-white/5 transition-colors" style={{ height: rowHeights[rowIndex] || 40 }}>
                                        <td onClick={e => { e.stopPropagation(); handleRowSelection(rowIndex); }} className={`px-3 py-2 text-xs border-r border-stone-100 dark:border-white/5 sticky left-0 z-20 cursor-pointer font-mono text-center transition-colors duration-100 ${selection?.type === 'row' && selection.rowId === rowIndex ? `${colors.selectionBg} font-bold text-stone-900 dark:text-white` : 'bg-stone-50 dark:bg-[#1a1a1a] text-stone-400 dark:text-stone-500'}`}>
                                            {offset + rowIndex + 1}
                                            <div onMouseDown={e => handleResizeStart(e, 'row', rowIndex, rowHeights[rowIndex] || 40)} className="absolute bottom-0 left-0 w-full h-1 cursor-row-resize hover:bg-emerald-400/50" />
                                        </td>
                                        {columns.map((col, cIdx) => {
                                            const isEditing = editingCell?.rowId === rowIndex && editingCell?.colKey === col;
                                            const isSelected = selection?.type === 'range' && selection.ranges.some(range => isCellInRange(rowIndex, cIdx, range));

                                            const isMultiSelected = selection?.type === 'range' && selection.ranges.some(range => {
                                                const { minRow, maxRow, minCol, maxCol } = normalizeRange(range);
                                                return isCellInRange(rowIndex, cIdx, range) && (minRow !== maxRow || minCol !== maxCol);
                                            });

                                            return (
                                                <GridCell
                                                    key={col}
                                                    rowId={rowIndex}
                                                    colKey={col}
                                                    colIdx={cIdx}
                                                    cell={(() => {
                                                        const rowid = data[rowIndex]?.rowid;
                                                        const changeKey = `${rowid}_${col}`;
                                                        const staged = stagedChanges[changeKey];
                                                        return staged ? staged.newValue : (grid[rowIndex]?.[cIdx] || parseCellValue(""));
                                                    })()}
                                                    isEditing={isEditing}
                                                    isSelected={!!isSelected}
                                                    isMultiSelected={!!isMultiSelected}
                                                    width={columnWidths[col] || 150}
                                                    onMouseDown={handleCellMouseDown}
                                                    onMouseEnter={handleCellMouseEnter}
                                                    onDoubleClick={handleCellDoubleClick}
                                                    onKeyDown={handleKeyDown}
                                                    onSave={() => handleSave()}
                                                    tempValue={tempValue}
                                                    setTempValue={setTempValue}
                                                    context={evalContext}
                                                    colors={colors}
                                                    colType={useStore.getState().schema?.columns?.[actualTableName!]?.find((c: any) => c.name === col)?.type}
                                                />
                                            );
                                        })}
                                        <td className="border-l border-stone-100" />
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="border-t border-stone-200 dark:border-white/10 bg-white dark:bg-[#141414] px-4 py-2.5 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 z-20 shrink-0 select-none transition-colors">
                        {/* Left Side: Summary & Limit */}
                        <div className="flex items-center gap-3">
                            <div className="flex items-center">
                                <span className="text-slate-600 font-medium">
                                    Showing {Math.min(offset + 1, activeStats?.rowCount || 0)}-{Math.min(offset + limit, activeStats?.rowCount || 0)} of {(activeStats?.rowCount || 0).toLocaleString()} rows
                                </span>
                            </div>

                            <div className="relative flex items-center">
                                <button
                                    title="Change Row Limit"
                                    onClick={() => setShowLimitMenu(!showLimitMenu)}
                                    className="flex items-center gap-2 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 px-4 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-stone-300 font-medium transition-colors shadow-sm"
                                >
                                    {limit} / page <ChevronDown size={14} className="text-slate-400 dark:text-stone-500" />
                                </button>
                                {showLimitMenu && (
                                    <div className="absolute bottom-full left-0 mb-2 w-28 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl dark:shadow-black/50 p-1.5 z-50 transition-colors">
                                        {[25, 50, 100, 250, 500].map(v => (
                                            <button
                                                key={v}
                                                title={`Set limit to ${v} rows`}
                                                onClick={() => { setLimit(v); setOffset(0); setShowLimitMenu(false); }}
                                                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${limit === v ? 'bg-violet-50 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400' : 'hover:bg-slate-50 dark:hover:bg-white/10 text-slate-600 dark:text-stone-400'}`}
                                            >
                                                {v} / page
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {((activeStats?.rowCount || 0) > limit) ? (
                            <div className="flex items-center gap-6 text-[13px] font-medium text-slate-500 select-none">
                                <button
                                    title="First Page"
                                    onClick={() => setOffset(0)}
                                    disabled={offset === 0}
                                    className="hover:text-blue-600 disabled:opacity-30 transition-colors px-1"
                                >
                                    «
                                </button>
                                <button
                                    title="Previous Page"
                                    onClick={() => setOffset(Math.max(0, offset - limit))}
                                    disabled={offset === 0}
                                    className="flex items-center gap-2 hover:text-blue-600 disabled:opacity-30 transition-colors"
                                >
                                    <span>←</span> Prev
                                </button>

                                <div className="flex items-center gap-1.5 mx-2 text-slate-600">
                                    <span className="font-semibold">{Math.floor(offset / limit) + 1}</span>
                                    <span className="text-slate-300">/</span>
                                    <span className="font-medium">{Math.ceil((activeStats?.rowCount || 0) / limit) || 1}</span>
                                </div>

                                <button
                                    title="Next Page"
                                    onClick={() => setOffset(offset + limit)}
                                    disabled={(offset + limit) >= (activeStats?.rowCount || 0)}
                                    className="flex items-center gap-2 hover:text-blue-600 disabled:opacity-30 transition-colors"
                                >
                                    Next <span>→</span>
                                </button>
                                <button
                                    title="Last Page"
                                    onClick={() => {
                                        const total = activeStats?.rowCount || 0;
                                        const lastOffset = Math.max(0, Math.floor((total - 1) / limit) * limit);
                                        setOffset(lastOffset);
                                    }}
                                    disabled={(offset + limit) >= (activeStats?.rowCount || 0)}
                                    className="hover:text-blue-600 disabled:opacity-30 transition-colors px-1"
                                >
                                    »
                                </button>
                            </div>
                        ) : null}

                        {/* Right Side: Actions & Shortcuts */}
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-3">
                                {/* Edit Shortcut */}
                                <div className="flex items-center gap-2.5 px-1 py-1 rounded-full bg-slate-50/50 dark:bg-white/5 border border-slate-100/50 dark:border-white/10 select-none group hover:bg-slate-50 dark:hover:bg-white/10 transition-colors">
                                    <div className="flex items-center justify-center h-6 w-6 rounded-full bg-white dark:bg-white/10 shadow-[0_1px_3px_rgba(0,0,0,0.05)] dark:shadow-none text-slate-400 dark:text-stone-400 group-hover:text-slate-500 dark:group-hover:text-stone-200 transition-colors">
                                        <CornerDownLeft size={12} strokeWidth={2.5} />
                                    </div>
                                    <span className="text-[13px] font-medium text-slate-500/90 dark:text-stone-400 pr-2 tracking-tight">edit</span>
                                </div>

                                {/* Next Shortcut */}
                                <div className="flex items-center gap-2.5 px-1 py-1 rounded-full bg-slate-50/50 dark:bg-white/5 border border-slate-100/50 dark:border-white/10 select-none group hover:bg-slate-50 dark:hover:bg-white/10 transition-colors">
                                    <div className="flex items-center justify-center h-6 w-6 rounded-full bg-white dark:bg-white/10 shadow-[0_1px_3px_rgba(0,0,0,0.05)] dark:shadow-none text-slate-400 dark:text-stone-400 group-hover:text-slate-500 dark:group-hover:text-stone-200 transition-colors">
                                        <ArrowRightToLine size={12} strokeWidth={2.5} />
                                    </div>
                                    <span className="text-[13px] font-medium text-slate-500/90 dark:text-stone-400 pr-2 tracking-tight">next</span>
                                </div>

                                {/* Copy Shortcut */}
                                <div className="flex items-center gap-2.5 px-1 py-1 rounded-full bg-slate-50/50 dark:bg-white/5 border border-slate-100/50 dark:border-white/10 select-none group hover:bg-slate-50 dark:hover:bg-white/10 transition-colors">
                                    <div className="flex items-center justify-center h-6 px-2 rounded-full bg-white dark:bg-white/10 shadow-[0_1px_3px_rgba(0,0,0,0.05)] dark:shadow-none text-slate-400 dark:text-stone-400 group-hover:text-slate-500 dark:group-hover:text-stone-200 transition-colors">
                                        <Command size={11} strokeWidth={3} />
                                        <span className="text-[12px] font-bold font-sans ml-0.5 leading-none">C</span>
                                    </div>
                                    <span className="text-[13px] font-medium text-slate-500/90 dark:text-stone-400 pr-2 tracking-tight">copy</span>
                                </div>
                            </div>

                            <div className="h-4 w-px bg-slate-200 dark:bg-white/10 mx-2"></div>

                            <div className="relative">
                                <button
                                    title="Export Table Data"
                                    onClick={() => isExportSupported && setShowExportMenu(!showExportMenu)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 hover:bg-stone-50 dark:hover:bg-white/5 rounded-lg border border-transparent hover:border-stone-200 dark:hover:border-white/10 transition-colors font-semibold ${!isExportSupported ? 'opacity-30 cursor-not-allowed' : 'text-stone-600 dark:text-stone-300'}`}
                                    disabled={!isExportSupported}
                                >
                                    <FileDown size={14} /> Export <ChevronDown size={12} className="text-stone-400 dark:text-stone-500" />
                                </button>
                                {showExportMenu && (
                                    <div className="absolute bottom-full right-0 mb-2 w-32 bg-white dark:bg-[#1a1a1a] border border-stone-200 dark:border-white/10 rounded-xl shadow-xl dark:shadow-black/50 p-1.5 z-[100] transition-colors">
                                        {(['csv', 'xlsx', 'json', 'parquet'] as const).map(fmt => (
                                            <button
                                                key={fmt}
                                                title={`Export as ${fmt.toUpperCase()}`}
                                                onClick={() => handleExport(fmt)}
                                                className="w-full text-left px-2.5 py-1.5 hover:bg-stone-50 dark:hover:bg-white/5 rounded-lg uppercase text-[10px] font-bold text-stone-500 dark:text-stone-400 transition-colors"
                                            >
                                                {fmt}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>


                {showPipelinePanel && actualTableName && (
                    <PipelinePanel tableName={actualTableName} />
                )}

                {isColumnProfileOpen && actualTableName && (
                    <ColumnProfilePanel isOpen={isColumnProfileOpen} onClose={() => setIsColumnProfileOpen(false)} colors={colors} />
                )}

                {
                    showReviewPanel && (
                        <div className="fixed bottom-6 right-6 w-[420px] bg-white dark:bg-[#1a1a1a] border border-stone-200 dark:border-white/10 rounded-2xl shadow-2xl dark:shadow-black/60 flex flex-col z-[110] overflow-hidden max-h-[520px] transition-colors">
                            {/* Header */}
                            <div className="px-5 pt-4 pb-3 flex items-start justify-between bg-white dark:bg-[#1a1a1a] transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 bg-amber-400 dark:bg-amber-500 rounded-full mt-0.5 shrink-0"></div>
                                    <div>
                                        <h3 className="text-[17px] font-bold text-stone-800 dark:text-stone-200 leading-tight">{Object.keys(stagedChanges).length} Changes</h3>
                                        <p className="text-[12px] text-stone-400 dark:text-stone-500 mt-0.5">in {new Set(Object.keys(stagedChanges).map(k => k.split('_')[0])).size} rows</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button title="Refresh" onClick={() => { setStagedChanges({}); setShowReviewPanel(false); }} className="p-1.5 hover:bg-stone-100 dark:hover:bg-white/10 rounded-lg text-stone-400 dark:text-stone-500 transition-colors"><RotateCcw size={15} /></button>
                                    <button title="Close" onClick={() => setShowReviewPanel(false)} className="p-1.5 hover:bg-stone-100 dark:hover:bg-white/10 rounded-lg text-stone-400 dark:text-stone-500 transition-colors"><X size={16} /></button>
                                </div>
                            </div>

                            {/* Undo by column chips */}
                            <div className="px-5 pb-3 flex flex-wrap items-center gap-1.5 bg-white dark:bg-[#1a1a1a] transition-colors">
                                <span className="text-[11px] text-stone-400 dark:text-stone-500 mr-1">Undo by column:</span>
                                {[...new Set(Object.keys(stagedChanges).map(k => k.split('_').slice(1).join('_')))].map(colName => (
                                    <button
                                        key={colName}
                                        title={`Undo all changes in ${colName}`}
                                        onClick={() => {
                                            setStagedChanges(prev => {
                                                const next = { ...prev };
                                                Object.keys(next).forEach(k => { if (k.split('_').slice(1).join('_') === colName) delete next[k]; });
                                                return next;
                                            });
                                        }}
                                        className="px-2 py-0.5 text-[11px] text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 rounded transition-colors"
                                    >
                                        {colName}
                                    </button>
                                ))}
                            </div>

                            {/* Divider */}
                            <div className="border-t border-stone-100 dark:border-white/10"></div>

                            {/* Changes list — grouped by row */}
                            <div className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-4">
                                {(() => {
                                    // Group changes by rowid
                                    const grouped: Record<string, { rowid: string; changes: { key: string; colName: string; oldValue: any; newValue: any }[] }> = {};
                                    Object.entries(stagedChanges).forEach(([key, change]) => {
                                        const parts = key.split('_');
                                        const rowid = parts[0];
                                        const colName = parts.slice(1).join('_');
                                        if (!grouped[rowid]) grouped[rowid] = { rowid, changes: [] };
                                        grouped[rowid].changes.push({ key, colName, oldValue: change.oldValue, newValue: change.newValue });
                                    });

                                    const formatOld = (ch: { oldValue: any; newValue: any }) => {
                                        const isNum = typeof ch.oldValue === 'number';
                                        return isNum ? String(ch.oldValue).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : `\u201c${String(ch.oldValue)}\u201d`;
                                    };
                                    const formatNew = (ch: { newValue: any }) => {
                                        if (ch.newValue.raw === 'null') return 'null';
                                        if (ch.newValue.raw === '') return '\u201c\u201d';
                                        if (ch.newValue.formula !== null) return `=${ch.newValue.formula}`;
                                        return `\u201c${ch.newValue.raw}\u201d`;
                                    };
                                    const newColor = (ch: { newValue: any }) => {
                                        if (ch.newValue.raw === 'null') return 'text-emerald-500 font-medium';
                                        if (ch.newValue.raw === '') return 'text-stone-500';
                                        return 'text-emerald-500 font-medium';
                                    };

                                    return Object.values(grouped).map(group => {
                                        const isExpanded = expandedReviewRows.has(group.rowid);
                                        const maxVisible = 2;
                                        const visible = isExpanded ? group.changes : group.changes.slice(0, maxVisible);
                                        const hidden = group.changes.length - maxVisible;

                                        return (
                                            <div key={group.rowid} className="flex items-start gap-3">
                                                {/* Row tag */}
                                                <div className="shrink-0 mt-0.5 w-[52px]">
                                                    <span className="inline-block px-2 py-[2px] rounded-[4px] bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[11px] font-bold whitespace-nowrap border border-amber-200 dark:border-amber-700/50">Row {Number(group.rowid) + 1}</span>
                                                    {group.changes.length > 1 && <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-0.5 text-center">{group.changes.length} cells</p>}
                                                </div>
                                                {/* Change details */}
                                                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                                    {visible.map(ch => {
                                                        const isSelected = selectedReviewIndex >= 0 && flatOrderedChanges[selectedReviewIndex]?.key === ch.key;

                                                        // Auto-expand if selected via keyboard but hidden
                                                        if (isSelected && !isExpanded && group.changes.length > maxVisible) {
                                                            setExpandedReviewRows(prev => { const n = new Set(prev); n.add(group.rowid); return n; });
                                                        }

                                                        return (
                                                            <div
                                                                key={ch.key}
                                                                onClick={() => setSelectedReviewIndex(flatOrderedChanges.findIndex(f => f.key === ch.key))}
                                                                className={`text-[12.5px] leading-relaxed px-2 py-0.5 rounded cursor-pointer transition-colors border border-transparent ${isSelected ? 'bg-violet-50 dark:bg-violet-900/30 border-violet-100 dark:border-violet-700/50' : 'text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-white/5'}`}
                                                            >
                                                                <span className={`font-semibold ${isSelected ? 'text-violet-700 dark:text-violet-400' : 'text-stone-800 dark:text-stone-200'}`}>{ch.colName}:</span>{' '}
                                                                <span className="line-through text-stone-400 dark:text-stone-500">{formatOld(ch)}</span>
                                                                <span className="text-stone-300 dark:text-stone-600 mx-1">→</span>
                                                                <span className={newColor(ch)}>{formatNew(ch)}</span>
                                                            </div>
                                                        );
                                                    })}
                                                    {!isExpanded && hidden > 0 && (
                                                        <button
                                                            onClick={() => setExpandedReviewRows(prev => { const n = new Set(prev); n.add(group.rowid); return n; })}
                                                            className="text-[11px] text-violet-500 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 flex items-center gap-1 mt-0.5 ml-2 transition-colors"
                                                        >
                                                            <span>▼</span> +{hidden} more
                                                        </button>
                                                    )}
                                                    {isExpanded && hidden > 0 && (
                                                        <button
                                                            onClick={() => setExpandedReviewRows(prev => { const n = new Set(prev); n.delete(group.rowid); return n; })}
                                                            className="text-[11px] text-violet-500 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 flex items-center gap-1 mt-0.5 ml-2 transition-colors"
                                                        >
                                                            <span>▲</span> show less
                                                        </button>
                                                    )}
                                                </div>
                                                {/* Undo button */}
                                                <button
                                                    title={`Undo changes in row ${Number(group.rowid) + 1}`}
                                                    onClick={() => {
                                                        setStagedChanges(prev => {
                                                            const next = { ...prev };
                                                            group.changes.forEach(ch => delete next[ch.key]);
                                                            return next;
                                                        });
                                                    }}
                                                    className="shrink-0 text-[12px] text-stone-400 hover:text-amber-500 font-medium transition-colors mt-0.5"
                                                >
                                                    Undo
                                                </button>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>

                            {/* Footer */}
                            <div className="border-t border-stone-100 dark:border-white/10 px-5 py-3 flex items-center gap-2 bg-white dark:bg-[#1a1a1a] transition-colors">
                                <button title="Commit Changes" onClick={handleCommitChanges} className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-[13px] font-bold shadow-sm hover:bg-blue-700 dark:hover:bg-blue-500 transition-colors flex items-center justify-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                                    <span>✓</span> Commit {Object.keys(stagedChanges).length} Changes
                                </button>
                                <button title="Discard All Changes" onClick={() => { setStagedChanges({}); setShowReviewPanel(false); }} className="px-4 py-2.5 border border-stone-200 dark:border-white/10 rounded-xl text-[13px] font-bold text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-stone-500/50">Discard</button>
                            </div>

                            {/* Bottom shortcuts bar */}
                            <div className="border-t border-stone-100 dark:border-white/10 bg-stone-50 dark:bg-black/20 px-5 py-2 flex items-center gap-5 text-[11px] text-stone-400 dark:text-stone-500 transition-colors">
                                <span className="flex items-center gap-1.5"><span className="text-stone-300 dark:text-stone-600">↑↓</span> Navigate</span>
                                <span className="flex items-center gap-1.5"><span className="text-stone-300 dark:text-stone-600">⏎</span> Undo selected</span>
                                <span className="flex items-center gap-1.5"><span className="text-stone-300 dark:text-stone-600">⌘S</span> Commit</span>
                            </div>
                        </div>
                    )
                }
                {
                    Object.keys(stagedChanges).length > 0 && !showReviewPanel && (
                        <button
                            title="Review Staged Changes"
                            onClick={() => { setShowReviewPanel(true); setSelectedReviewIndex(0); }}
                            className="fixed bottom-6 right-6 flex items-center gap-2 px-5 py-2.5 bg-amber-400 hover:bg-amber-500 text-white rounded-full shadow-lg font-semibold z-[100] transition-colors cursor-pointer"
                        >
                            <span className="w-2.5 h-2.5 bg-white rounded-full shrink-0 opacity-90"></span>
                            <span className="text-[14px] font-bold tracking-tight">{Object.keys(stagedChanges).length} Changes</span>
                            <span className="text-[13px] font-medium opacity-90">Click to review</span>
                        </button>
                    )
                }

                <TableAssistant isOpen={showAssistant} onClose={() => setShowAssistant(false)} rowCount={data.length} activeTableName={actualTableName} />

                {/* Onboarding Step 3: Completion Popup */}
                {onboardingStep === 3 && (
                    <div className="fixed bottom-[12vh] left-1/2 -translate-x-1/2 z-[10001] pointer-events-none">
                        <div className="bg-[#2dd4a8] rounded-xl px-7 py-3.5 shadow-lg animate-in fade-in zoom-in-95 duration-500 text-center pointer-events-auto">
                            <h2 className="text-white text-[15px] font-bold tracking-tight leading-tight">You're all set!</h2>
                            <p className="text-white/90 text-[13px] font-medium mt-0.5">Now explore your data</p>
                        </div>
                    </div>
                )}
                <SaveTableModal isOpen={isSaveModalOpen} onClose={() => setIsSaveModalOpen(false)} onSave={handleSaveAsTable} />
                <style dangerouslySetInnerHTML={{ __html: `.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }` }} />
            </div>
        </div>
    );
}
