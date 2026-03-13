import { useState, useEffect } from 'react';
import { X, Sparkles, MessageSquare, Loader2, ArrowRight } from 'lucide-react';
import { useStore } from '../store/useStore';

interface MultiStepAIModalProps {
    isOpen: boolean;
    onClose: () => void;
    tableName: string;
}

export default function MultiStepAIModal({ isOpen, onClose, tableName }: MultiStepAIModalProps) {
    const { generateMultiStepWithAI, applyMultiStepWithAI } = useStore();
    const [instruction, setInstruction] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [proposedSteps, setProposedSteps] = useState<Array<{ name: string, expression: string }> | null>(null);
    const [isApplying, setIsApplying] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setInstruction('');
            setIsGenerating(false);
            setProposedSteps(null);
            setIsApplying(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!instruction.trim() || isGenerating) return;

        setIsGenerating(true);
        try {
            const steps = await generateMultiStepWithAI(tableName, instruction);
            if (steps && steps.length > 0) {
                setProposedSteps(steps);
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const handleApply = async () => {
        if (!proposedSteps) return;
        setIsApplying(true);
        try {
            const applied = await applyMultiStepWithAI(tableName, proposedSteps);
            if (applied) {
                onClose();
            }
        } finally {
            setIsApplying(false);
        }
    };

    const handleBack = () => {
        setProposedSteps(null);
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-stone-900/40 backdrop-blur-[2px] animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className="relative w-full max-w-[500px] bg-white dark:bg-[#1a1a1a] rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.2)] dark:shadow-black/60 border border-stone-200 dark:border-white/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200 transition-colors">

                {/* Header */}
                <div className="px-6 pt-5 pb-2 flex items-center justify-between z-10 relative">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 dark:text-indigo-400">
                            <Sparkles size={18} fill="currentColor" />
                        </div>
                        <h2 className="text-[17px] font-bold text-stone-800 dark:text-stone-200 tracking-tight">
                            {proposedSteps ? "Review Proposed Steps" : "Generate Multiple Steps"}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 hover:bg-stone-100 dark:hover:bg-white/10 rounded-lg text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-all"
                        title="Close"
                    >
                        <X size={18} strokeWidth={2.5} />
                    </button>
                </div>

                {!proposedSteps ? (
                    <form onSubmit={handleGenerate} className="p-6 space-y-4">
                        <div className="space-y-2">
                            <label className="text-[13px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
                                <MessageSquare size={14} />
                                Your Instructions
                            </label>
                            <textarea
                                autoFocus
                                value={instruction}
                                onChange={(e) => setInstruction(e.target.value)}
                                placeholder="e.g. Create a 'Profit' column as revenue - cost, then create a 'High Profit' boolean if Profit > 100"
                                className="w-full h-32 bg-stone-50 dark:bg-[#141414] border border-stone-200 dark:border-white/10 rounded-[16px] px-4 py-3 text-[14px] font-medium text-stone-800 dark:text-stone-200 placeholder:text-stone-300 dark:placeholder:text-stone-600 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500/50 focus:bg-white dark:focus:bg-[#1a1a1a] transition-all resize-none shadow-sm"
                                disabled={isGenerating}
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-4 py-2.5 rounded-[12px] text-stone-500 dark:text-stone-400 font-bold text-[14px] hover:bg-stone-50 dark:hover:bg-white/5 transition-all active:scale-[0.98]"
                                disabled={isGenerating}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!instruction.trim() || isGenerating}
                                className={`flex-[2] py-2.5 rounded-[12px] text-white font-bold text-[15px] transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2
                                    ${instruction.trim() && !isGenerating ? 'bg-indigo-500 hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-500' : 'bg-stone-200 dark:bg-white/10 text-stone-400 cursor-not-allowed'}`}
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        <span>Generating...</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={18} />
                                        <span>Generate Steps</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="p-6 space-y-4">
                        <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2">
                            {proposedSteps.map((step, idx) => (
                                <div key={idx} className="bg-stone-50 dark:bg-dark-stone border border-stone-200 dark:border-white/10 rounded-[12px] p-3 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 flex items-center justify-center text-[11px] font-bold">
                                            {idx + 1}
                                        </div>
                                        <div className="font-semibold text-[13px] text-stone-700 dark:text-stone-300 font-mono">
                                            {step.name}
                                        </div>
                                    </div>
                                    <div className="pl-7 font-mono text-[12px] text-indigo-600 dark:text-indigo-400 break-all bg-white dark:bg-[#141414] px-2 py-1.5 rounded border border-stone-100 dark:border-white/5">
                                        {step.expression}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-stone-100 dark:border-white/10 mt-4">
                            <button
                                type="button"
                                onClick={handleBack}
                                className="flex-1 px-4 py-2.5 rounded-[12px] text-stone-500 dark:text-stone-400 font-bold text-[14px] hover:bg-stone-50 dark:hover:bg-white/5 transition-all active:scale-[0.98]"
                                disabled={isApplying}
                            >
                                Back
                            </button>
                            <button
                                onClick={handleApply}
                                disabled={isApplying}
                                className={`flex-[2] py-2.5 rounded-[12px] text-white font-bold text-[15px] transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2
                                    ${!isApplying ? 'bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500' : 'bg-stone-200 dark:bg-white/10 text-stone-400 cursor-not-allowed'}`}
                            >
                                {isApplying ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        <span>Applying...</span>
                                    </>
                                ) : (
                                    <>
                                        <ArrowRight size={18} />
                                        <span>Confirm & Apply</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Footer Tip */}
                <div className="px-6 py-4 bg-stone-50/50 dark:bg-white/5 border-t border-stone-100 dark:border-white/10 italic">
                    <p className="text-[12px] text-stone-400 dark:text-stone-500">
                        Tip: You can describe multiple dependencies. AI will ensure steps are created in the correct order.
                    </p>
                </div>
            </div>
        </div>
    );
}
