import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';

export default function PromptModal() {
    const { promptConfig, closePrompt } = useStore();
    const [value, setValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (promptConfig?.isOpen) {
            setValue(promptConfig.defaultValue || '');
            // Auto-focus the input when modal opens
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [promptConfig?.isOpen, promptConfig?.defaultValue]);

    if (!promptConfig?.isOpen) return null;

    const handleConfirm = () => {
        promptConfig.onConfirm(value);
        closePrompt();
    };

    const handleCancel = () => {
        if (promptConfig.onCancel) promptConfig.onCancel();
        closePrompt();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleConfirm();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-stone-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={handleCancel}
            />

            {/* Modal */}
            <div className="relative w-full max-w-sm bg-white dark:bg-[#1a1a1a] rounded-xl shadow-2xl dark:shadow-black/60 border border-stone-200 dark:border-white/10 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                <div className="p-5 flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">{promptConfig.title}</h3>
                        {promptConfig.message && (
                            <p className="text-xs text-stone-500 dark:text-stone-400">{promptConfig.message}</p>
                        )}
                    </div>

                    <input
                        ref={inputRef}
                        type="text"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={promptConfig.placeholder || 'Enter value...'}
                        className="w-full bg-stone-50 dark:bg-[#141414] border border-stone-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:focus:ring-indigo-500/30 transition-shadow"
                    />

                    <div className="flex items-center gap-2 mt-2">
                        <button
                            onClick={handleCancel}
                            className="flex-1 px-4 py-2 text-xs font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-white/10 rounded-lg transition-colors border border-transparent hover:border-stone-200 dark:hover:border-white/10"
                        >
                            {promptConfig.cancelText || 'Cancel'}
                        </button>
                        <button
                            onClick={handleConfirm}
                            className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors shadow-sm active:scale-95"
                        >
                            {promptConfig.confirmText || 'OK'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
