import React, { useState, useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';
import type { PipelineStep } from '../store/useStore';

interface EditStepAIModalProps {
    isOpen: boolean;
    onClose: () => void;
    step: PipelineStep | null;
    onSubmit: (stepId: string, instruction: string) => void;
}

export default function EditStepAIModal({ isOpen, onClose, step, onSubmit }: EditStepAIModalProps) {
    const [instruction, setInstruction] = useState('');

    useEffect(() => {
        if (isOpen) {
            setInstruction('');
        }
    }, [isOpen]);

    if (!isOpen || !step) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (instruction.trim()) {
            onSubmit(step.id, instruction.trim());
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-5 py-4 flex items-center justify-between border-b border-stone-100 bg-stone-50/50">
                    <div className="flex items-center gap-2 text-stone-800 font-semibold text-base">
                        <div className="w-7 h-7 rounded-md bg-purple-100 text-purple-600 flex items-center justify-center">
                            <Sparkles size={16} />
                        </div>
                        Edit Step with AI
                    </div>
                    <button
                        onClick={onClose}
                        title="Close"
                        className="text-stone-400 hover:text-stone-600 p-1 rounded-full hover:bg-stone-100 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
                    <div className="bg-stone-50 rounded-lg p-3 border border-stone-200">
                        <div className="text-xs text-stone-500 font-medium mb-1">Current Expression for "{step.name}"</div>
                        <div className="font-mono text-sm text-stone-800 break-all bg-white p-2 rounded border border-stone-100">
                            {step.expression}
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="ai-edit-prompt" className="text-sm font-medium text-stone-700">
                            Describe how you want to change this step
                        </label>
                        <textarea
                            id="ai-edit-prompt"
                            autoFocus
                            rows={3}
                            value={instruction}
                            onChange={(e) => setInstruction(e.target.value)}
                            placeholder="e.g. Wrap it in a COALESCE to handle nulls, or multiply the result by 100"
                            className="w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all resize-none shadow-sm"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit(e);
                                }
                            }}
                        />
                    </div>

                    <div className="pt-2 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!instruction.trim()}
                            className={`px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg flex items-center gap-2 transition-all shadow-sm
                                ${instruction.trim() ? 'hover:bg-purple-700 active:scale-95' : 'opacity-50 cursor-not-allowed'}`}
                        >
                            <Sparkles size={14} />
                            Generate Edit
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
