import React, { useState, useEffect } from 'react';
import { X, Sparkles, Wand2 } from 'lucide-react';

interface AddColumnAIModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (instruction: string) => void;
}

export default function AddColumnAIModal({ isOpen, onClose, onSubmit }: AddColumnAIModalProps) {
    const [instruction, setInstruction] = useState('');

    useEffect(() => {
        if (isOpen) {
            setInstruction('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (instruction.trim()) {
            onSubmit(instruction.trim());
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
                        <div className="w-7 h-7 rounded-md bg-indigo-100 text-indigo-600 flex items-center justify-center">
                            <Wand2 size={16} />
                        </div>
                        Add Column with AI
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
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="ai-add-prompt" className="text-sm font-medium text-stone-700">
                            Describe the column you want to create
                        </label>
                        <textarea
                            id="ai-add-prompt"
                            autoFocus
                            rows={4}
                            value={instruction}
                            onChange={(e) => setInstruction(e.target.value)}
                            placeholder="e.g. Create a column 'Full Name' by concatenating first and last name, or 'Is High Value' if total_spend > 1000"
                            className="w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none shadow-sm"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit(e);
                                }
                            }}
                        />
                        <p className="text-[11px] text-stone-400 px-1">
                            The AI will generate a new transformation step based on your description.
                        </p>
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
                            className={`px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg flex items-center gap-2 transition-all shadow-sm
                                ${instruction.trim() ? 'hover:bg-indigo-700 active:scale-95' : 'opacity-50 cursor-not-allowed'}`}
                        >
                            <Sparkles size={14} />
                            Generate Column
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
