import { useState } from 'react';
import { useStore } from '../store/useStore';
import SQLPreviewModal from './SQLPreviewModal';
import EditStepAIModal from './EditStepAIModal';
import AddColumnAIModal from './AddColumnAIModal';
import MultiStepAIModal from './MultiStepAIModal';
import SnapshotModal from './SnapshotModal';
import { PipelineExplanationPanel, type ExplanationData } from './PipelineExplanationPanel';
import { OptimizationPanel } from './OptimizationPanel';
import { Trash2, Check, X, GripVertical, Save, Download, History, Copy, Code2, Sparkles, Info, Loader2, Zap } from 'lucide-react';
import type { PipelineStep } from '../store/useStore';

interface PipelinePanelProps {
    tableName: string;
}

export default function PipelinePanel({ tableName }: PipelinePanelProps) {
    const {
        pipeline,
        togglePipelineStep,
        removePipelineStep,
        reorderPipelineStep,
        snapshots,
        savePipelineSnapshot,
        loadPipelineSnapshot,
        deletePipelineSnapshot,
        exportPipelineSQL,
        copyPipelineSQL,
        editPipelineStepWithAI,
        addComputedColumnWithAI,
        explainPipeline,
        optimizePipeline,
        applyOptimization
    } = useStore();

    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
    const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);
    const [isSQLModalOpen, setIsSQLModalOpen] = useState(false);
    const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
    const [isMultiStepModalOpen, setIsMultiStepModalOpen] = useState(false);
    const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);
    const [isExplainModalOpen, setIsExplainModalOpen] = useState(false);
    const [explanationData, setExplanationData] = useState<ExplanationData | null>(null);
    const [isExplaining, setIsExplaining] = useState(false);
    const [isOptimizeModalOpen, setIsOptimizeModalOpen] = useState(false);
    const [optimizationData, setOptimizationData] = useState<any | null>(null);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [editingStep, setEditingStep] = useState<PipelineStep | null>(null);

    const steps = pipeline[tableName] || [];

    const handleDragStart = (e: React.DragEvent, idx: number) => {
        setDraggedIdx(idx);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.currentTarget as any);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDragEnter = (e: React.DragEvent, idx: number) => {
        e.preventDefault();
        if (draggedIdx !== null && draggedIdx !== idx) {
            setDropTargetIdx(idx);
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDropTargetIdx(null);
        }
    };

    const handleDrop = (e: React.DragEvent, targetIdx: number) => {
        e.preventDefault();
        setDropTargetIdx(null);
        if (draggedIdx !== null && draggedIdx !== targetIdx) {
            reorderPipelineStep(tableName, draggedIdx, targetIdx);
        }
        setDraggedIdx(null);
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#111111] border-l border-stone-200 dark:border-white/10 w-80 shrink-0 transition-colors">
            <div className="p-4 border-b border-stone-200 dark:border-white/10 transition-colors">
                <h2 className="text-sm font-semibold text-stone-800 dark:text-stone-200">Transform Pipeline</h2>
                <div className="mt-2 text-xs text-stone-500 dark:text-stone-400 font-mono flex items-center justify-between">
                    <div><span className="text-stone-400 dark:text-stone-500">Base:</span> {tableName}</div>
                    <div className="flex gap-1">
                        <button
                            onClick={() => setIsSQLModalOpen(true)}
                            className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-sans font-medium flex items-center gap-1 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 px-2 py-1 rounded transition-colors"
                            title="Preview generated SQL"
                        >
                            <Code2 size={10} />
                            Preview
                        </button>
                        <button
                            onClick={() => copyPipelineSQL(tableName)}
                            className="text-[10px] text-stone-600 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-300 font-sans font-medium flex items-center gap-1 bg-stone-100 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 px-2 py-1 rounded transition-colors"
                            title="Copy SQL to clipboard"
                        >
                            <Copy size={10} />
                            Copy
                        </button>
                        <button
                            onClick={async () => {
                                setIsExplainModalOpen(true);
                                setIsExplaining(true);
                                try {
                                    const data = await explainPipeline(tableName);
                                    if (data) setExplanationData(data);
                                } finally {
                                    setIsExplaining(false);
                                }
                            }}
                            className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-sans font-medium flex items-center gap-1 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 px-2 py-1 rounded transition-colors"
                            title="Explain pipeline logic with AI"
                        >
                            <Info size={10} />
                            Explain
                        </button>
                        <button
                            onClick={async () => {
                                setIsOptimizeModalOpen(true);
                                setIsOptimizing(true);
                                try {
                                    const data = await optimizePipeline(tableName);
                                    if (data) setOptimizationData(data);
                                } finally {
                                    setIsOptimizing(false);
                                }
                            }}
                            className="text-[10px] text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 font-sans font-medium flex items-center gap-1 bg-orange-50 dark:bg-orange-500/10 hover:bg-orange-100 dark:hover:bg-orange-500/20 px-2 py-1 rounded transition-colors"
                            title="Optimize pipeline with AI"
                        >
                            <Zap size={10} />
                            Optimize
                        </button>
                        <button
                            onClick={() => exportPipelineSQL(tableName)}
                            className="text-[10px] text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-sans font-medium flex items-center gap-1 bg-blue-50 dark:bg-blue-500/10 px-2 py-1 rounded transition-colors"
                        >
                            <Download size={10} />
                            Export SQL
                        </button>
                    </div>
                </div>
            </div>

            <div className="px-4 py-3 border-b border-stone-200 dark:border-white/10 bg-stone-50/30 dark:bg-white/5 space-y-2 transition-colors">
                <button
                    onClick={() => setIsAddColumnModalOpen(true)}
                    className="w-full py-2 px-3 bg-white dark:bg-[#141414] border border-stone-200 dark:border-white/10 rounded-lg text-xs font-semibold text-stone-700 dark:text-stone-300 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 transition-all flex items-center justify-center gap-2 shadow-sm group"
                >
                    Add Column with AI
                </button>

                <button
                    onClick={() => setIsMultiStepModalOpen(true)}
                    className="w-full py-2 px-3 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/30 rounded-lg text-xs font-semibold text-indigo-700 dark:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-500/50 hover:bg-indigo-100/50 dark:hover:bg-indigo-500/20 transition-all flex items-center justify-center gap-2 shadow-sm group"
                >
                    Generate Multiple Steps
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {steps.length === 0 ? (
                    <div className="text-sm text-stone-400 dark:text-stone-500 text-center mt-8">
                        No pipeline steps defined.
                    </div>
                ) : (
                    steps.map((step, idx) => (
                        <div
                            key={step.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, idx)}
                            onDragOver={handleDragOver}
                            onDragEnter={(e) => handleDragEnter(e, idx)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, idx)}
                            className={`p-3 rounded-md border text-sm relative group transition-all duration-200 ease-in-out
                                ${step.enabled ? 'border-blue-200 dark:border-blue-500/30 bg-blue-50/30 dark:bg-blue-500/5' : 'border-stone-200 dark:border-white/10 bg-stone-50/50 dark:bg-[#141414] opacity-75'}
                                ${draggedIdx === idx ? 'opacity-40 scale-95 shadow-inner border-dashed' : 'hover:shadow-sm dark:hover:shadow-black/20'}
                                ${dropTargetIdx === idx ? 'border-blue-500 dark:border-blue-500 bg-blue-100/50 dark:bg-blue-500/20 scale-[1.02] z-10' : ''}
                            `}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex gap-2">
                                    <div className="mt-0.5 text-stone-300 dark:text-stone-600 cursor-grab active:cursor-grabbing hover:text-stone-500 dark:hover:text-stone-400 transition-colors">
                                        <GripVertical size={16} />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="font-medium text-stone-700 dark:text-stone-300 flex items-center gap-2">
                                            <span className="text-xs text-stone-400 dark:text-stone-500 font-mono">{idx + 1}.</span>
                                            {step.name}
                                        </div>
                                        <div className="font-mono text-xs text-blue-600 dark:text-blue-400 bg-white/50 dark:bg-black/20 px-1 py-0.5 rounded break-all transition-colors">
                                            {step.expression}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setEditingStep(step)}
                                        className="p-1 rounded-md text-purple-400 dark:text-purple-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors opacity-0 group-hover:opacity-100"
                                        title="Edit step with AI"
                                    >
                                        <Sparkles size={14} />
                                    </button>
                                    <button
                                        onClick={() => togglePipelineStep(tableName, step.id)}
                                        className={`p-1 rounded-md transition-colors ${step.enabled ? 'text-emerald-600 dark:text-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-500/20' : 'text-stone-400 dark:text-stone-500 hover:bg-stone-200 dark:hover:bg-white/10'
                                            }`}
                                        title={step.enabled ? "Disable step" : "Enable step"}
                                    >
                                        {step.enabled ? <Check size={14} /> : <X size={14} />}
                                    </button>
                                    <button
                                        onClick={() => removePipelineStep(tableName, step.id)}
                                        className="p-1 rounded-md text-stone-400 dark:text-stone-500 hover:text-red-600 dark:hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                                        title="Delete step"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Snapshots Section */}
            <div className="p-4 border-t border-stone-200 dark:border-white/10 bg-stone-50/50 dark:bg-black/20 transition-colors">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-stone-600 dark:text-stone-300">
                        <History size={14} />
                        Snapshots
                    </div>
                    <button
                        onClick={() => setIsSnapshotModalOpen(true)}
                        className="p-1.5 text-stone-500 dark:text-stone-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-white/10 rounded-md transition-all shadow-sm border border-stone-200 dark:border-white/10"
                        title="Save current pipeline as snapshot"
                    >
                        <Save size={14} />
                    </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {snapshots.filter(s => s.tableName === tableName).length === 0 ? (
                        <div className="text-[10px] text-stone-400 dark:text-stone-500 text-center py-2 italic font-sans">
                            No snapshots for this table.
                        </div>
                    ) : (
                        snapshots
                            .filter(s => s.tableName === tableName)
                            .map(snapshot => (
                                <div key={snapshot.id} className="group flex items-center justify-between bg-white dark:bg-[#1a1a1a] p-2 rounded border border-stone-200 dark:border-white/10 hover:border-blue-200 dark:hover:border-blue-500/50 transition-colors">
                                    <div
                                        className="text-[11px] font-medium text-stone-700 dark:text-stone-300 truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 flex-1 transition-colors"
                                        onClick={() => loadPipelineSnapshot(snapshot.id)}
                                        title={`Load snapshot (Created: ${new Date(snapshot.createdAt).toLocaleString()})`}
                                    >
                                        {snapshot.name}
                                    </div>
                                    <button
                                        onClick={() => deletePipelineSnapshot(snapshot.id)}
                                        className="text-stone-300 dark:text-stone-500 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Delete snapshot"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))
                    )}
                </div>
            </div>

            <SQLPreviewModal
                isOpen={isSQLModalOpen}
                onClose={() => setIsSQLModalOpen(false)}
                tableName={tableName}
            />

            <EditStepAIModal
                isOpen={editingStep !== null}
                onClose={() => setEditingStep(null)}
                step={editingStep}
                onSubmit={(stepId, instruction) => {
                    editPipelineStepWithAI(tableName, stepId, instruction);
                }}
            />

            <AddColumnAIModal
                isOpen={isAddColumnModalOpen}
                onClose={() => setIsAddColumnModalOpen(false)}
                onSubmit={(instruction) => {
                    addComputedColumnWithAI(tableName, instruction);
                }}
            />

            <MultiStepAIModal
                isOpen={isMultiStepModalOpen}
                onClose={() => setIsMultiStepModalOpen(false)}
                tableName={tableName}
            />

            <SnapshotModal
                isOpen={isSnapshotModalOpen}
                onClose={() => setIsSnapshotModalOpen(false)}
                onSave={(name) => savePipelineSnapshot(tableName, name)}
            />

            {/* Optimize Pipeline Modal */}
            {isOptimizeModalOpen && (
                <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-stone-900/40 dark:bg-black/60 backdrop-blur-[2px]" onClick={() => setIsOptimizeModalOpen(false)} />
                    <div className="relative w-full max-w-2xl bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl border border-stone-200 dark:border-white/10 overflow-hidden flex flex-col max-h-[90vh] transition-colors">
                        <div className="px-6 py-4 border-b border-stone-200 dark:border-white/10 flex items-center justify-between bg-stone-50/50 dark:bg-[#141414] transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                                    <Zap size={18} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-stone-800 dark:text-stone-200 tracking-tight">Pipeline Optimization</h2>
                                    <p className="text-xs text-stone-500 dark:text-stone-400 font-medium font-mono uppercase tracking-wider">{tableName}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOptimizeModalOpen(false)}
                                className="p-2 hover:bg-stone-200 dark:hover:bg-white/10 rounded-full text-stone-400 dark:text-stone-500 transition-colors"
                                title="Close Optimization Modal"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 bg-stone-50/30 dark:bg-[#111111] transition-colors">
                            {isOptimizing ? (
                                <div className="flex flex-col items-center justify-center p-12 text-stone-500 dark:text-stone-400 animate-pulse">
                                    <Loader2 className="animate-spin mb-4" size={32} />
                                    <p className="font-bold text-lg dark:text-stone-300">Analyzing Pipeline</p>
                                    <p className="text-sm">Claude is looking for redundant transforms and risks...</p>
                                </div>
                            ) : (
                                <OptimizationPanel
                                    optimizations={optimizationData?.optimizations || []}
                                    onApply={async (opt: any) => {
                                        setIsOptimizing(true);
                                        try {
                                            await applyOptimization(tableName, opt);
                                            // Refresh optimizations after applying
                                            const newData = await optimizePipeline(tableName);
                                            if (newData) setOptimizationData(newData);
                                        } finally {
                                            setIsOptimizing(false);
                                        }
                                    }}
                                    onIgnore={(opt: any) => {
                                        setOptimizationData((prev: any) => ({
                                            ...prev,
                                            optimizations: prev.optimizations.filter((o: any) => o.target !== opt.target || o.type !== opt.type)
                                        }));
                                    }}
                                />
                            )}
                        </div>
                        <div className="px-6 py-4 border-t border-stone-200 dark:border-white/10 bg-stone-50/50 dark:bg-[#141414] flex justify-end transition-colors">
                            <button
                                onClick={() => setIsOptimizeModalOpen(false)}
                                className="px-6 py-2 bg-stone-800 dark:bg-stone-700 text-white rounded-xl text-sm font-bold hover:bg-stone-900 dark:hover:bg-stone-600 transition-all shadow-md active:scale-[0.98]"
                                title="Close optimizations"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Explain Pipeline Modal */}
            {isExplainModalOpen && (
                <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-stone-900/40 dark:bg-black/60 backdrop-blur-[2px]" onClick={() => setIsExplainModalOpen(false)} />
                    <div className="relative w-full max-w-2xl bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl border border-stone-200 dark:border-white/10 overflow-hidden flex flex-col max-h-[90vh] transition-colors">
                        <div className="px-6 py-4 border-b border-stone-200 dark:border-white/10 flex items-center justify-between bg-stone-50/50 dark:bg-[#141414] transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                    <Info size={18} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-stone-800 dark:text-stone-200 tracking-tight">Pipeline Explanation</h2>
                                    <p className="text-xs text-stone-500 dark:text-stone-400 font-medium font-mono uppercase tracking-wider">{tableName}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsExplainModalOpen(false)}
                                className="p-2 hover:bg-stone-200 dark:hover:bg-white/10 rounded-full text-stone-400 dark:text-stone-500 transition-colors"
                                title="Close Explanation Modal"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            <PipelineExplanationPanel data={explanationData} isLoading={isExplaining} />
                        </div>
                        <div className="px-6 py-4 border-t border-stone-200 dark:border-white/10 bg-stone-50/50 dark:bg-[#141414] flex justify-end transition-colors">
                            <button
                                onClick={() => setIsExplainModalOpen(false)}
                                className="px-6 py-2 bg-stone-800 dark:bg-stone-700 text-white rounded-xl text-sm font-bold hover:bg-stone-900 dark:hover:bg-stone-600 transition-all shadow-md active:scale-[0.98]"
                                title="Close explanation"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
