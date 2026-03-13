import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import {
    ArrowUp,
    ArrowDown,

    Loader2,
    AlertCircle,
    CheckCircle2,
    Play,
    Save,
    FileDown,
    ChevronDown,
    Clock,
    Settings,
    Lightbulb,
} from 'lucide-react';
import { getAIKey, saveAIKey } from '../utils/aiKeyStorage';
import { useStore } from '../store/useStore';
import { useAppStore } from '../store';
import { runAI, explainResult } from '../lib/runAI';
import { generateTrySuggestions } from '../lib/aiSuggestions';
import SaveTableModal from './SaveTableModal';
import QueryHistoryPanel from './QueryHistoryPanel';
import InsightPanel from './InsightPanel';
import { getPresetSQL } from '../lib/presetQueries';

interface TableAssistantProps {
    isOpen: boolean;
    onClose: () => void;
    rowCount: number;
    activeTableName?: string;
}

export default function TableAssistant({ isOpen, onClose, rowCount, activeTableName }: TableAssistantProps) {
    const {
        runSQL, validateSQL, isQueryRunning, queryError, queryResult,
        schema, loadSchema, saveQueryAsTable, lastSQL, exportTable,
        loadQueryFromHistory, setSettingsOpen, showToast, setLastAIQuery, appTheme
    } = useStore();
    const [inputValue, setInputValue] = useState('');
    const [sqlValue, setSqlValue] = useState('');
    const [activeTab, setActiveTab] = useState<'ai' | 'sql'>('ai');
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiResult, setAiResult] = useState<{ query: string; sql: string } | null>(null);
    const [insightText, setInsightText] = useState<string | null>(null);
    const [isInsightLoading, setIsInsightLoading] = useState(false);
    const [focusedSuggestionIndex, setFocusedSuggestionIndex] = useState(-1);

    const [hasKey, setHasKey] = useState(() => !!getAIKey());
    const [keyInput, setKeyInput] = useState('');

    const handleSaveKey = useCallback(() => {
        if (!keyInput.trim()) return;
        saveAIKey(keyInput.trim());
        setHasKey(true);
        setKeyInput('');
        showToast('API key saved!', 'success');
    }, [keyInput, showToast]);

    const editorRef = useRef<any>(null);
    const monacoRef = useRef<any>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    const { activeFile } = useAppStore();

    // Listen to activeFile changes to reset state and ensure schema is fresh
    useEffect(() => {
        setAiResult(null);
        setInsightText(null);
        setInputValue('');
        setAiError(null);

        if (activeFile && !schema.columns[activeFile]) {
            loadSchema();
        }
    }, [activeFile, loadSchema]);

    const suggestions = useMemo(() => {
        setFocusedSuggestionIndex(-1); // Reset focus when suggestions update
        if (!activeTableName || !schema.columns[activeTableName]) {
            // Fallback if no specific table is active or schema for it isn't loaded
            return generateTrySuggestions(activeTableName || 'data', [], rowCount);
        }
        return generateTrySuggestions(activeTableName, schema.columns[activeTableName], rowCount);
    }, [activeTableName, schema, rowCount]);

    const handleAIQuery = async (query: string) => {
        if (!query.trim() || isAiLoading) return;

        setIsAiLoading(true);
        setAiError(null);

        try {
            const context = undefined;

            // Check for preset queries first to bypass AI (works without API key)
            const presetSQL = getPresetSQL(query);
            const cleanedSQL = presetSQL || await runAI(query, schema, context);

            console.log("Cleaned SQL from AI:", cleanedSQL);

            if (cleanedSQL) {
                setLastAIQuery(cleanedSQL);
                // setActiveTab('sql'); // Don't switch tab automatically
                setSqlValue(cleanedSQL);
                setAiResult({ query, sql: cleanedSQL });

                // Execute immediately
                runSQL(cleanedSQL, true);
            }
            // If it's SQL, we could run it:
            // runSQL(aiResponse);
        } catch (err: any) {
            console.error("AI Assistant Error:", err);
            if (err.message === "NO_AI_KEY") {
                setAiError("API key missing. Please configure it in settings.");
                showToast("Add your AI key in Settings to use Natural Language queries", "error");
            } else if (err.message && (err.message.includes("AI generated") || err.message.includes("references invalid"))) {
                // Pass through specific validation errors
                setAiError(err.message);
            } else {
                setAiError("AI request failed — check API key or server");
            }
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleExplainResult = async () => {
        if (!aiResult || isInsightLoading || !queryResult) return;

        setIsInsightLoading(true);
        try {
            // Get column schema for the result
            const columns = Object.keys(queryResult[0] || {}).map(col => ({
                name: col,
                type: 'UNKNOWN' // Type is less critical for insights than name/sample
            }));

            const result = await explainResult({
                sql: aiResult.sql,
                columns,
                rows: queryResult.slice(0, 20), // First 20 rows
                rowCount: queryResult.length
            });
            setInsightText(result);
        } catch (err: any) {
            console.error("Explain failed:", err);
            showToast("Failed to generate insights", "error");
        } finally {
            setIsInsightLoading(false);
        }
    };

    const handleEditorChange = (value: string | undefined) => {
        // ... (rest of the handleEditorChange implementation)
        setSqlValue(value || '');

        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(async () => {
            const query = value || '';
            const error = await validateSQL(query);

            if (editorRef.current && monacoRef.current) {
                const model = editorRef.current.getModel();
                if (model) {
                    if (error && query.trim()) {
                        // Attempt to parse line/column from DuckDB error
                        const lineColMatch = error.match(/line\s+(\d+),\s+column\s+(\d+)/i);

                        let startLineNumber = 1;
                        let startColumn = 1;
                        let endLineNumber = model.getLineCount();
                        let endColumn = model.getLineMaxColumn(model.getLineCount());

                        if (lineColMatch) {
                            startLineNumber = parseInt(lineColMatch[1], 10);
                            startColumn = parseInt(lineColMatch[2], 10);
                            // Set end to end of line or next few characters for visibility
                            endLineNumber = startLineNumber;
                            endColumn = startColumn + 1;
                        }

                        monacoRef.current.editor.setModelMarkers(model, 'sql', [{
                            startLineNumber,
                            startColumn,
                            endLineNumber,
                            endColumn,
                            message: error,
                            severity: monacoRef.current.MarkerSeverity.Error
                        }]);
                    } else {
                        monacoRef.current.editor.setModelMarkers(model, 'sql', []);
                    }
                }
            }
        }, 400);
    };

    const handleEditorDidMount = (editor: any, monaco: any) => {
        editorRef.current = editor;
        monacoRef.current = monaco;

        // Register SQL Auto-complete
        monaco.languages.registerCompletionItemProvider('sql', {
            triggerCharacters: ['.', ' '],
            provideCompletionItems: (model: any, position: any) => {
                const schema = useStore.getState().schema;
                const textUntilPosition = model.getValueInRange({
                    startLineNumber: 1,
                    startColumn: 1,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column
                });

                const word = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn
                };

                const suggestions: any[] = [];

                // 1. Keywords
                const keywords = ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'JOIN', 'LIMIT', 'ORDER BY', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP'];
                keywords.forEach(k => {
                    suggestions.push({
                        label: k.padEnd(14),
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: k,
                        range: range
                    });
                });

                if (!schema) return { suggestions };

                // 2. Table Context Detection
                const isAfterFromOrJoin = /\b(FROM|JOIN)\s+([a-zA-Z0-9_]*)$/i.test(textUntilPosition);
                const isAfterWhere = /\bWHERE\s+([a-zA-Z0-9_]*)$/i.test(textUntilPosition);

                // 3. Column Context Detection (detecting "tableName.")
                const lineContent = model.getLineContent(position.lineNumber);
                const textBeforeCursorColumn = lineContent.substring(0, position.column - 1);
                const tableDotMatch = textBeforeCursorColumn.match(/([a-zA-Z0-9_]+)\.$/);

                if (tableDotMatch) {
                    const tableName = tableDotMatch[1];
                    const tableColumns = schema.columns[tableName];
                    if (tableColumns) {
                        tableColumns.forEach(col => {
                            suggestions.push({
                                label: col.name.padEnd(14),
                                kind: monaco.languages.CompletionItemKind.Field,
                                insertText: col.name,
                                detail: col.type,
                                documentation: `${col.name} (${col.type})`,
                                range: range
                            });
                        });
                        return { suggestions }; // Prioritize columns if a dot is found
                    }
                }

                // 3.5 WHERE Context Columns (Suggest active table columns)
                if (isAfterWhere && !tableDotMatch) {
                    // Try to get from schema first for types
                    const schemaCols = activeTableName ? schema.columns[activeTableName] : null;

                    if (schemaCols) {
                        schemaCols.forEach(col => {
                            suggestions.push({
                                label: col.name.padEnd(14),
                                kind: monaco.languages.CompletionItemKind.Field,
                                insertText: col.name,
                                detail: col.type,
                                documentation: `${col.name} (${col.type})`,
                                range: range,
                                sortText: '0' + col.name
                            });
                        });
                    }
                }

                // 4. Suggest Tables (Prioritize if after FROM/JOIN)
                schema.tables.forEach(table => {
                    suggestions.push({
                        label: table.padEnd(14),
                        kind: monaco.languages.CompletionItemKind.Struct,
                        insertText: table,
                        range: range,
                        detail: 'Table',
                        sortText: isAfterFromOrJoin ? '0' + table : '1' + table
                    });
                });

                return { suggestions };
            }
        });

        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
            const val = editor.getValue();
            if (val.trim()) {
                runSQL(val);
            }
        });
    };

    const handleSaveAsTable = async (name: string) => {
        const queryToSave = lastSQL || sqlValue;
        if (!queryToSave.trim() || isSaving) return;
        setIsSaving(true);
        try {
            await saveQueryAsTable(queryToSave, name);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } finally {
            setIsSaving(false);
        }
    };

    const handleExport = async (format: 'csv' | 'json' | 'parquet' | 'xlsx') => {
        try {
            const buffer = await exportTable("SQL Results", format);
            const blob = new Blob([buffer as any], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `query_results.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setShowExportMenu(false);
        } catch (err) {
            console.error("Export failed:", err);
        }
    };

    const handleEditorBeforeMount = (monaco: any) => {
        monaco.editor.defineTheme('sql-light', {
            base: 'vs',
            inherit: true,
            rules: [],
            colors: {
                'editor.lineHighlightBackground': '#f3f4f6',
                'editor.lineHighlightBorder': '#f3f4f6',
                'editor.background': '#fbfbfb',
            }
        });
        monaco.editor.defineTheme('sql-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
                'editor.lineHighlightBackground': '#ffffff0a',
                'editor.lineHighlightBorder': '#ffffff0a',
                'editor.background': '#111111',
            }
        });
    };

    useEffect(() => {
        if (isOpen) {
            loadSchema();
        }
    }, [isOpen, loadSchema]);

    // Sync lastSQL to editor (important for AI queries or history loads)
    useEffect(() => {
        if (lastSQL && lastSQL !== sqlValue) {
            setSqlValue(lastSQL);
        }
    }, [lastSQL]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Tab') {
                e.preventDefault();
                setActiveTab(prev => prev === 'ai' ? 'sql' : 'ai');
            }
            if (e.key === 'Enter') {
                if (activeTab === 'ai' && inputValue.trim()) {
                    e.preventDefault();
                    handleAIQuery(inputValue);
                    setInputValue('');
                } else if (activeTab === 'sql' && e.ctrlKey && sqlValue.trim()) {

                    runSQL(sqlValue);
                }
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, activeTab, inputValue, sqlValue, runSQL, handleAIQuery]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10000] flex items-start justify-center pt-[8vh] px-4 font-sans">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-stone-900/30 transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-[680px] max-h-[80vh] bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl dark:shadow-black/50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col border border-transparent dark:border-white/10 transition-colors">

                {/* Query Status Bar (Progressive) */}
                {(isQueryRunning || isAiLoading) && (
                    <div className="absolute top-0 left-0 w-full h-1 bg-stone-100 overflow-hidden z-[60]">
                        <div className="h-full bg-emerald-500 animate-[progress_1.5s_infinite_linear]" style={{ width: '40%' }} />
                    </div>
                )}

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {activeTab === 'ai' ? (
                        <>
                            {/* AI Input Section */}
                            <div className="px-6 pt-3 pb-1">
                                <div className="relative flex items-center">
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder={isAiLoading ? "Thinking..." : "Ask anything about your data..."}
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'ArrowDown') {
                                                e.preventDefault();
                                                setFocusedSuggestionIndex(prev => (prev + 1) % (suggestions.length || 1));
                                            } else if (e.key === 'ArrowUp') {
                                                e.preventDefault();
                                                setFocusedSuggestionIndex(prev => (prev - 1 + (suggestions.length || 1)) % (suggestions.length || 1));
                                            } else if (e.key === 'Enter' && focusedSuggestionIndex >= 0) {
                                                e.preventDefault();
                                                const suggestion = suggestions[focusedSuggestionIndex];
                                                if (suggestion) {
                                                    setInputValue(suggestion.text);
                                                    handleAIQuery(suggestion.text);
                                                }
                                            } else if (e.key === 'Enter') {
                                                handleAIQuery(inputValue);
                                            }
                                        }}
                                        className="w-full text-lg text-stone-700 dark:text-stone-200 placeholder:text-stone-300 dark:placeholder:text-stone-600 outline-none bg-transparent"
                                        disabled={isAiLoading}
                                    />
                                    {isAiLoading && (
                                        <Loader2 size={18} className="text-stone-300 animate-spin" />
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        // ... (rest of the SQL section)
                        <>
                            {/* SQL Editor Header */}
                            <div className="flex items-center justify-between px-6 pt-3 pb-1.5 border-b border-stone-50 dark:border-white/10">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-stone-600 dark:text-stone-300">SQL Editor</span>
                                    {isQueryRunning && (
                                        <div className="flex items-center gap-2 text-[10px] text-stone-400 font-medium animate-pulse">
                                            <Loader2 size={12} className="animate-spin" />
                                            RUNNING...
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setShowHistory(!showHistory)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                                        ${showHistory ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-white/5'}`}
                                        title="Query History"
                                    >
                                        <Clock size={12} />
                                        <span>History</span>
                                    </button>
                                    <button
                                        onClick={() => {

                                            runSQL(sqlValue);
                                        }}
                                        disabled={isQueryRunning || !sqlValue.trim()}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                                        ${isQueryRunning || !sqlValue.trim()
                                                ? 'bg-stone-100 dark:bg-white/5 text-stone-400 dark:text-stone-500 cursor-not-allowed'
                                                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm active:transform active:scale-95'
                                            }`}
                                    >
                                        {isQueryRunning ? <Loader2 className="animate-spin" size={12} /> : <Play size={12} />}
                                        {isQueryRunning ? 'Running...' : 'Run Query'}
                                    </button>
                                </div>
                            </div>

                            {/* SQL Editor Area */}
                            <div className="border-y border-stone-100 dark:border-white/10 bg-[#fbfbfb] dark:bg-[#111111] relative overflow-hidden flex h-[220px] transition-colors">
                                <div className={`flex-1 transition-all duration-300 ${showHistory ? 'opacity-40 pointer-events-none' : ''}`}>
                                    <Editor
                                        height="220px"
                                        language="sql"
                                        theme={appTheme === 'dark' ? 'sql-dark' : 'sql-light'}
                                        value={sqlValue}
                                        onChange={handleEditorChange}
                                        onMount={handleEditorDidMount}
                                        beforeMount={handleEditorBeforeMount}
                                        options={{
                                            minimap: { enabled: false },
                                            fontSize: 14,
                                            lineHeight: 1.5,
                                            lineNumbers: 'on',
                                            scrollBeyondLastLine: false,
                                            automaticLayout: true,
                                            padding: { top: 16, bottom: 16 },
                                            readOnly: isQueryRunning,
                                            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                                            fontLigatures: true,
                                            glyphMargin: false,
                                            folding: false,
                                            lineDecorationsWidth: 10,
                                            lineNumbersMinChars: 2,
                                            renderLineHighlight: 'line',
                                            cursorStyle: 'line',
                                            cursorWidth: 2,
                                            scrollbar: {
                                                vertical: 'hidden',
                                                horizontal: 'hidden',
                                                useShadows: false
                                            },
                                            overviewRulerLanes: 0,
                                            hideCursorInOverviewRuler: true,
                                            renderLineHighlightOnlyWhenFocus: false
                                        }}
                                    />
                                </div>

                                {/* History Overlay Panel */}
                                {showHistory && (
                                    <QueryHistoryPanel
                                        onClose={() => setShowHistory(false)}
                                        onSelectQuery={(id) => {
                                            loadQueryFromHistory(id);
                                            setShowHistory(false);
                                        }}
                                    />
                                )}
                            </div>
                        </>
                    )}



                    {/* Status Messages */}
                    {queryError && (
                        <div className="px-6 py-2 bg-red-50/50 border-b border-red-100 flex items-center gap-2 text-red-600 text-xs animate-in slide-in-from-top-1 duration-200">
                            <AlertCircle size={14} />
                            <span className="font-medium">{queryError}</span>
                        </div>
                    )}

                    {aiError && (
                        <div className="px-6 py-2 bg-amber-50/50 border-b border-amber-100 flex items-center justify-between animate-in slide-in-from-top-1 duration-200">
                            <div className="flex items-center gap-2 text-amber-700 text-xs">
                                <AlertCircle size={14} />
                                <span className="font-medium">{aiError}</span>
                            </div>
                            {aiError.includes("missing") && (
                                <button
                                    onClick={() => {
                                        setSettingsOpen(true);
                                        setAiError(null);
                                    }}
                                    className="flex items-center gap-1.5 px-2 py-1 rounded bg-white border border-amber-200 text-amber-700 text-[10px] font-bold uppercase hover:bg-amber-50 transition-colors"
                                >
                                    <Settings size={10} />
                                    Fix in Settings
                                </button>
                            )}
                        </div>
                    )}

                    {!isQueryRunning && !isAiLoading && queryResult && !queryError && (
                        <div className="px-6 py-2 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between animate-in slide-in-from-top-1 duration-200">
                            <div className="flex items-center gap-2 text-emerald-700 text-xs text-nowrap">
                                {saveSuccess ? (
                                    <>
                                        <CheckCircle2 size={14} className="text-emerald-500" />
                                        <span className="font-semibold italic">Table saved successfully!</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={14} />
                                        <span className="font-medium">Query executed successfully! {queryResult.length} rows.</span>
                                    </>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <button
                                        onClick={() => setShowExportMenu(!showExportMenu)}
                                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all bg-white dark:bg-white/5 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-white/10 border border-stone-200 dark:border-white/10 shadow-sm active:scale-95"
                                    >
                                        <FileDown size={10} />
                                        <span>Export</span>
                                        <ChevronDown size={10} className={`transition-transform duration-200 ${showExportMenu ? 'rotate-180' : ''}`} />
                                    </button>

                                    {showExportMenu && (
                                        <div className="absolute top-full right-0 mt-1 w-40 bg-white dark:bg-[#1a1a1a] rounded-lg shadow-xl border border-stone-200 dark:border-white/10 py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                                            <div className="px-3 py-1.5 text-[9px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest border-b border-stone-50 dark:border-white/5 mb-1">
                                                Format
                                            </div>
                                            {(['xlsx', 'csv', 'json', 'parquet'] as const).map((format) => (
                                                <button
                                                    key={format}
                                                    onClick={() => handleExport(format)}
                                                    className="w-full text-left px-3 py-2 text-xs text-stone-600 dark:text-stone-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors flex items-center justify-between group"
                                                >
                                                    <span className="capitalize">{format === 'xlsx' ? 'Excel (.xlsx)' : format === 'csv' ? 'CSV (Google Sheets)' : format}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => setIsSaveModalOpen(true)}
                                    disabled={isSaving}
                                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all
                                    ${isSaving
                                            ? 'bg-stone-100 dark:bg-white/5 text-stone-400 dark:text-stone-500 cursor-not-allowed border border-stone-200 dark:border-white/10'
                                            : 'bg-white dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 dark:hover:bg-emerald-600 hover:text-white dark:hover:text-white border border-emerald-200 dark:border-emerald-500/30 shadow-sm active:scale-95'
                                        }`}
                                >
                                    {isSaving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                                    {isSaving ? 'Saving...' : 'Save as Table'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Tabs */}
                    <div className="flex items-center px-6 py-1 border-b border-stone-100 dark:border-white/10 bg-[#F9FAFB]/50 dark:bg-[#1a1a1a] gap-4 transition-colors">
                        <button
                            onClick={() => setActiveTab('ai')}
                            className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm transition-colors ${activeTab === 'ai'
                                ? 'bg-white dark:bg-white/10 shadow-sm border border-stone-200 dark:border-white/10 text-stone-900 dark:text-white font-medium'
                                : 'text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300'
                                }`}
                        >
                            <span className="text-sm">🧠</span>
                            AI Assistant
                        </button>
                        <button
                            onClick={() => setActiveTab('sql')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${activeTab === 'sql'
                                ? 'bg-white dark:bg-white/10 shadow-sm border border-stone-200 dark:border-white/10 text-emerald-700 dark:text-emerald-400 font-medium'
                                : 'text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300'
                                }`}
                        >
                            SQL
                        </button>
                        <div className="ml-auto text-[10px] text-stone-400 font-medium tracking-tight">
                            Tab to switch
                        </div>
                    </div>

                    {activeTab === 'ai' ? (
                        /* AI Suggestions Section */
                        <div className="px-6 py-1.5 pb-3">
                            {aiResult ? (
                                <div className="animate-in slide-in-from-bottom-2 duration-300">
                                    <div className="mb-4">
                                        <h3 className="text-[10px] uppercase font-bold text-stone-400 tracking-wider mb-1">
                                            You Asked
                                        </h3>
                                        <div className="text-sm text-stone-700 dark:text-stone-300 font-medium bg-stone-50 dark:bg-white/5 py-2 px-3 rounded-lg border border-stone-100 dark:border-white/10">
                                            {aiResult.query}
                                        </div>
                                    </div>
                                    <div className="mb-4">
                                        <h3 className="text-[10px] uppercase font-bold text-stone-400 tracking-wider mb-1 flex items-center justify-between">
                                            <span>Generated SQL</span>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        setAiResult(null);
                                                        setInputValue('');
                                                    }}
                                                    className="text-[10px] text-stone-400 hover:text-stone-600 transition-colors"
                                                >
                                                    Clear
                                                </button>
                                                <button
                                                    onClick={() => setActiveTab('sql')}
                                                    className="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold transition-colors"
                                                >
                                                    Open in Editor →
                                                </button>
                                            </div>
                                        </h3>
                                        <div className="relative group">
                                            <pre className="text-xs font-mono text-emerald-800 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/20 px-3 py-2 rounded-lg border border-emerald-100 dark:border-emerald-800/50 overflow-x-auto">
                                                {aiResult.sql}
                                            </pre>
                                        </div>
                                    </div>

                                    {/* Explain Result Button */}
                                    <div className="mb-4">
                                        {!insightText && !isInsightLoading ? (
                                            <button
                                                onClick={handleExplainResult}
                                                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-xl border border-indigo-100 dark:border-indigo-700/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all font-medium text-xs shadow-sm active:scale-95 animate-in fade-in slide-in-from-top-2"
                                            >
                                                <Lightbulb size={14} className="text-indigo-500 fill-indigo-500/10" />
                                                Explain Result & Generate Insights
                                            </button>
                                        ) : (
                                            <>
                                                <InsightPanel
                                                    text={insightText}
                                                    isLoading={isInsightLoading}
                                                    onClose={() => {
                                                        setInsightText(null);
                                                    }}
                                                />
                                            </>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {!hasKey && !['sample', 'sales', 'api_logs'].includes(activeTableName || '') && (
                                        /* API Key Entry — shown when no key is configured */
                                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 py-1 px-5 mb-6">
                                            <p className="text-sm text-stone-500 dark:text-stone-400 mb-2">
                                                Enter your Anthropic API key to enable full AI features
                                            </p>
                                            <div className="flex items-center gap-2 mb-2">
                                                <input
                                                    type="password"
                                                    placeholder="sk-ant-..."
                                                    value={keyInput}
                                                    onChange={e => setKeyInput(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); handleSaveKey(); } }}
                                                    className="flex-1 px-4 py-2.5 bg-stone-50 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl text-sm text-stone-700 dark:text-stone-200 placeholder:text-stone-300 dark:placeholder:text-stone-600 outline-none focus:border-violet-300 dark:focus:border-violet-500 focus:ring-2 focus:ring-violet-100 dark:focus:ring-violet-500/20 transition-all"
                                                />
                                                <button
                                                    onClick={handleSaveKey}
                                                    disabled={!keyInput.trim()}
                                                    className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${keyInput.trim()
                                                        ? 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm active:scale-95'
                                                        : 'bg-stone-100 dark:bg-white/5 text-stone-400 dark:text-stone-500 cursor-not-allowed'
                                                        }`}
                                                >
                                                    Save Key
                                                </button>
                                            </div>
                                            <p className="text-xs text-stone-400 dark:text-stone-500">
                                                Get your API key from{' '}
                                                <a
                                                    href="https://console.anthropic.com"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-violet-500 dark:text-violet-400 hover:text-violet-600 dark:hover:text-violet-300 underline underline-offset-2"
                                                >
                                                    console.anthropic.com
                                                </a>
                                                {' · '}
                                                <button
                                                    onClick={() => setSettingsOpen(true)}
                                                    className="text-violet-500 dark:text-violet-400 hover:text-violet-600 dark:hover:text-violet-300 underline underline-offset-2"
                                                >
                                                    open Settings
                                                </button>
                                            </p>
                                        </div>
                                    )}

                                    <h3 className="text-[11px] uppercase font-bold text-stone-400/70 tracking-widest mb-3 px-5">
                                        Try Asking
                                    </h3>
                                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300 px-5">
                                        {suggestions.map((suggestion, i) => (
                                            <button
                                                key={i}
                                                onClick={() => {
                                                    setInputValue(suggestion.text);
                                                    handleAIQuery(suggestion.text);
                                                }}
                                                className="w-full text-left transition-colors text-[15px] font-normal text-slate-600 dark:text-stone-300 hover:text-slate-900 dark:hover:text-white block"
                                            >
                                                {suggestion.text}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        /* SQL Examples & Schema Section */
                        <div className="px-6 py-1.5 pb-3">
                            <h3 className="text-[10px] uppercase font-bold text-stone-400 tracking-wider mb-1">
                                Quick Examples
                            </h3>
                            <div className="space-y-1 mb-3">
                                {[
                                    { label: "Select all", sql: `SELECT * FROM table LIMIT 100` },
                                    { label: "Count rows", sql: `SELECT COUNT(*) FROM table` },
                                    { label: "Group by", sql: `SELECT column, COUNT(*) FROM table GROUP BY column` }
                                ].map((example, i) => (
                                    <div key={i} className="flex items-baseline gap-2 text-sm">
                                        <span className="text-stone-400 font-medium min-w-[80px]">{example.label}:</span>
                                        <code className="bg-emerald-50/50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-lg text-emerald-700 dark:text-emerald-400 flex-1 cursor-pointer hover:bg-emerald-100/50 dark:hover:bg-emerald-900/40 transition-colors font-mono text-xs border border-emerald-100/30 dark:border-emerald-800/50"
                                            onClick={() => setSqlValue(example.sql)}>
                                            {example.sql}
                                        </code>
                                    </div>
                                ))}
                            </div>

                            <div className="flex items-center gap-2 text-xs text-stone-400">
                                <span className="font-medium">Schema columns:</span>
                                <div className="flex flex-wrap gap-2">
                                    {activeTableName && schema.columns[activeTableName] ? (
                                        <>
                                            {schema.columns[activeTableName].slice(0, 5).map((col, i) => (
                                                <span key={i} className="hover:text-stone-600 cursor-pointer">{col.name}</span>
                                            ))}
                                            {schema.columns[activeTableName].length > 5 && (
                                                <span className="text-stone-300">+{schema.columns[activeTableName].length - 5} more</span>
                                            )}
                                        </>
                                    ) : (
                                        <span className="text-stone-300 italic">No columns found</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-3 bg-white dark:bg-[#141414] border-t border-stone-100 dark:border-white/10 rounded-b-2xl transition-colors">
                    <div className="flex items-center gap-6 text-[11px] font-medium text-stone-400">
                        {activeTab === 'ai' ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-0.5 opacity-60">
                                        <ArrowUp size={12} className="stroke-[2.5]" />
                                        <ArrowDown size={12} className="stroke-[2.5]" />
                                    </div>
                                    <span>navigate</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-white/10 px-1 rounded">Enter</span>
                                    <span>send</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-white/10 px-1 rounded">Tab</span>
                                    <span>SQL</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-white/10 px-1 rounded">Esc</span>
                                    <span>close</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex items-center gap-2">
                                    <span className="text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-white/10 px-1 rounded font-mono">Ctrl+Enter</span>
                                    <span>run</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-white/10 px-1 rounded font-mono">Esc</span>
                                    <span>back</span>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="text-[11px] font-medium text-stone-400">
                        {rowCount} rows
                    </div>
                </div>
            </div>
            <style dangerouslySetInnerHTML={{
                __html: `
@keyframes progress {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(250%); }
}
@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}
@keyframes slideInUp {
    from { transform: translateY(8px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}
.animate-in {
    animation: fadeIn 0.3s ease-out fill-mode-forwards, slideInUp 0.3s ease-out fill-mode-forwards;
}
.history-scrollbar::-webkit-scrollbar {
    width: 4px;
}
.history-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}
.history-scrollbar::-webkit-scrollbar-thumb {
    background: #e7e5e4;
    border-radius: 10px;
}
.history-scrollbar::-webkit-scrollbar-thumb:hover, .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #d6d3d1;
}
.custom-scrollbar::-webkit-scrollbar {
    width: 5px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background: #e7e5e4;
    border-radius: 10px;
}
`}} />
            <SaveTableModal
                isOpen={isSaveModalOpen}
                onClose={() => setIsSaveModalOpen(false)}
                onSave={handleSaveAsTable}
            />
        </div>
    );
}
