import React, { useState, useEffect, useRef } from 'react';

interface SnapshotModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string) => void;
}

export default function SnapshotModal({ isOpen, onClose, onSave }: SnapshotModalProps) {
    const [name, setName] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setName('');
            // Focus input after modal animation starts
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

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
        <div className="fixed inset-0 z-[12000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-stone-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-[440px] bg-white dark:bg-[#1a1a1a] rounded-xl shadow-2xl dark:shadow-black/60 border border-stone-200 dark:border-white/10 p-6 animate-in fade-in zoom-in-95 duration-200 transition-colors">
                <div className="space-y-3">
                    <label className="block text-sm font-medium text-stone-800 dark:text-stone-200 transition-colors">
                        Snapshot name:
                    </label>
                    <input
                        ref={inputRef}
                        type="text"
                        value={name}
                        title="Snapshot name"
                        placeholder="Enter snapshot name..."
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full px-4 py-2 bg-stone-50 dark:bg-[#141414] border-2 border-indigo-600/50 dark:border-indigo-500/50 rounded-lg outline-none focus:ring-0 focus:border-indigo-600 dark:focus:border-indigo-500 transition-all text-stone-800 dark:text-stone-200 placeholder-stone-400 dark:placeholder-stone-500"
                    />
                </div>

                <div className="mt-8 flex items-center justify-end gap-3">
                    <button
                        onClick={handleSave}
                        className="px-8 py-2.5 min-w-[100px] bg-indigo-600 text-white font-bold rounded-full hover:bg-indigo-700 active:scale-95 transition-all shadow-md shadow-indigo-200 dark:shadow-indigo-900/20"
                    >
                        OK
                    </button>
                    <button
                        onClick={onClose}
                        className="px-8 py-2.5 min-w-[100px] bg-stone-100 dark:bg-white/5 text-stone-700 dark:text-stone-300 font-bold rounded-full hover:bg-stone-200 dark:hover:bg-white/10 active:scale-95 transition-all"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
