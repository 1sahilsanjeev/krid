import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

interface SaveTableModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string) => void;
    initialValue?: string;
}

export default function SaveTableModal({ isOpen, onClose, onSave, initialValue = '' }: SaveTableModalProps) {
    const [name, setName] = useState(initialValue);

    useEffect(() => {
        if (isOpen) {
            setName(initialValue);
        }
    }, [isOpen, initialValue]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (name.trim()) {
            onSave(name.trim());
            onClose();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-stone-900/50 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-sm bg-white dark:bg-[#1c1c1c] rounded-2xl shadow-2xl border border-stone-200 dark:border-white/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-5 py-3 flex items-center justify-between border-b border-stone-100 dark:border-white/10 bg-stone-50/50 dark:bg-white/[0.03]">
                    <div className="flex items-center gap-2 text-stone-800 dark:text-stone-100 font-semibold text-base">
                        <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-sm">
                            <Save size={15} />
                        </div>
                        Save as Table
                    </div>
                    <button
                        onClick={onClose}
                        title="Close"
                        className="text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 p-1 rounded-full hover:bg-stone-100 dark:hover:bg-white/10 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="px-5 pt-1.5 pb-2 space-y-2">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-stone-500 dark:text-stone-400">
                            Table Name
                        </label>
                        <input
                            autoFocus
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Enter a descriptive name..."
                            className="w-full px-3 py-2 bg-stone-50 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-500/30 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all text-sm text-stone-800 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-600"
                        />
                        <p className="text-[11px] text-stone-400 dark:text-stone-500 px-0.5">
                            Use a name that helps you identify this dataset on the canvas later.
                        </p>
                    </div>
                </div>

                <div className="px-5 py-2.5 bg-stone-50 dark:bg-white/[0.03] border-t border-stone-100 dark:border-white/10 flex items-center justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-3 py-1.5 text-xs font-medium text-stone-600 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        disabled={!name.trim()}
                        onClick={handleSave}
                        className={`px-5 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg shadow-sm shadow-indigo-200/40 transition-all
                            ${name.trim() ? 'hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98]' : 'opacity-50 cursor-not-allowed'}
                        `}
                    >
                        Save Table
                    </button>
                </div>
            </div>
        </div>
    );
}
