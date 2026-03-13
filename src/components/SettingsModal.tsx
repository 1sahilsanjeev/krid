import { useState, useEffect } from 'react';
import { X, Type, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { saveAIKey, getAIKey, removeAIKey } from '../utils/aiKeyStorage';

export default function SettingsModal() {
    const {
        isSettingsOpen,
        setSettingsOpen,
    } = useStore();

    const [activeTab, setActiveTab] = useState<'ai' | 'appearance'>('ai');
    const [localKey, setLocalKey] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);
    const [hasExistingKey, setHasExistingKey] = useState(false);

    // Sync local state with storage when opened
    useEffect(() => {
        if (isSettingsOpen) {
            setLocalKey('');
            setShowSuccess(false);
            setHasExistingKey(!!getAIKey());
        }
    }, [isSettingsOpen]);

    // Keyboard Shortcuts
    useEffect(() => {
        if (!isSettingsOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey)) {
                if (e.key === '1') {
                    e.preventDefault();
                    setActiveTab('ai');
                } else if (e.key === '2') {
                    e.preventDefault();
                    setActiveTab('appearance');
                }
            }
            if (e.key === 'Escape') {
                setSettingsOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isSettingsOpen, setSettingsOpen]);

    if (!isSettingsOpen) return null;

    const handleSave = () => {
        if (!localKey.trim()) return;

        saveAIKey(localKey);
        setLocalKey('');
        setHasExistingKey(true);
        setShowSuccess(true);

        // Hide success message after 3 seconds
        setTimeout(() => setShowSuccess(false), 3000);
    };

    const handleDelete = () => {
        removeAIKey();
        setHasExistingKey(false);
        setLocalKey('');
        setShowSuccess(false);
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-stone-900/30 backdrop-blur-[2px] animate-in fade-in duration-300"
                onClick={() => setSettingsOpen(false)}
            />

            {/* Modal Container */}
            <div className="relative w-[360px] h-[310px] bg-white dark:bg-[#1a1a1a] rounded-[20px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-black/50 border border-stone-200 dark:border-white/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col transition-colors">

                {/* Header */}
                <div className="px-5 pt-4 pb-1 flex items-center justify-between">
                    <h2 className="text-[15px] font-medium text-stone-800 dark:text-stone-200 tracking-tight">
                        Settings
                    </h2>
                    <button
                        onClick={() => setSettingsOpen(false)}
                        className="p-1 hover:bg-stone-100 dark:hover:bg-white/10 rounded-lg text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-all"
                        title="Close"
                    >
                        <X size={16} strokeWidth={2.5} />
                    </button>
                </div>

                {/* Horizontal Tabs */}
                <div className="px-5 flex items-center gap-4 border-b border-stone-100 dark:border-white/10">
                    <button
                        onClick={() => setActiveTab('ai')}
                        className={`flex items-center gap-1.5 pb-2 pt-0.5 transition-all relative
                            ${activeTab === 'ai' ? 'text-stone-900 dark:text-stone-200' : 'text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300'}`}
                    >
                        <Type size={14} strokeWidth={2.5} />
                        <span className="font-medium text-[13px]">AI</span>
                        <div className="flex items-center gap-0.5 ml-0.5 opacity-40 scale-[0.8]">
                            <span className="text-[10px] font-medium font-mono">⌘</span>
                            <span className="text-[10px] font-medium font-mono">1</span>
                        </div>
                        {activeTab === 'ai' && (
                            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-stone-900 dark:bg-stone-200 rounded-full" />
                        )}
                    </button>

                    <button
                        onClick={() => setActiveTab('appearance')}
                        className={`flex items-center gap-1.5 pb-2 pt-0.5 transition-all relative
                            ${activeTab === 'appearance' ? 'text-stone-900 dark:text-stone-200' : 'text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300'}`}
                    >
                        <span className="font-medium text-[13px]">Appearance</span>
                        <div className="flex items-center gap-0.5 ml-0.5 opacity-40 scale-[0.8]">
                            <span className="text-[10px] font-medium font-mono">⌘</span>
                            <span className="text-[10px] font-medium font-mono">2</span>
                        </div>
                        {activeTab === 'appearance' && (
                            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-stone-900 dark:bg-stone-200 rounded-full" />
                        )}
                    </button>
                </div>

                {/* Tab Content */}
                <div className="px-5 py-3 flex-1 overflow-y-auto">
                    {activeTab === 'ai' && (
                        <div className="space-y-3 animate-in fade-in duration-300">
                            <div className="flex items-center justify-between">
                                <label className="text-[12px] font-medium text-stone-400 dark:text-stone-500 tracking-tight">
                                    Anthropic API Key
                                </label>
                                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${hasExistingKey
                                    ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/50'
                                    : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/50'
                                    }`}>
                                    {hasExistingKey ? (
                                        <>
                                            <CheckCircle2 size={12} />
                                            <span>Saved</span>
                                        </>
                                    ) : (
                                        <>
                                            <AlertCircle size={12} />
                                            <span>Not set</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            <input
                                type="text"
                                value={localKey}
                                onChange={(e) => setLocalKey(e.target.value)}
                                placeholder={hasExistingKey ? "••••••••••••" : "sk-ant-api03-..."}
                                className="w-full bg-white dark:bg-[#141414] border border-stone-200 dark:border-white/10 rounded-[10px] px-3 py-2 text-[13px] font-normal text-stone-800 dark:text-stone-200 placeholder:text-stone-300 dark:placeholder:text-stone-600 focus:outline-none focus:border-stone-400 dark:focus:border-stone-500 transition-all shadow-sm"
                            />

                            <div className="flex gap-2">
                                <button
                                    onClick={handleSave}
                                    disabled={!localKey.trim()}
                                    className={`flex-1 py-1.5 rounded-[10px] text-white dark:text-stone-900 font-medium text-[13px] transition-all shadow-sm active:scale-[0.98]
                                        ${localKey.trim() ? 'bg-[#abc2f8] dark:bg-[#99b3f0] hover:bg-[#99b3f0] dark:hover:bg-[#abc2f8]' : 'bg-stone-200 dark:bg-white/10 dark:text-stone-500 cursor-not-allowed'}`}
                                >
                                    Save
                                </button>
                                {hasExistingKey && (
                                    <button
                                        onClick={handleDelete}
                                        className="px-2.5 rounded-[10px] bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-100 dark:border-red-900/50 transition-all shadow-sm active:scale-[0.95]"
                                        title="Delete stored key"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>

                            <p className="text-[12px] font-normal min-h-[18px]">
                                {showSuccess ? (
                                    <span className="text-emerald-500 dark:text-emerald-400 animate-in fade-in slide-in-from-top-1">
                                        Key stored locally
                                    </span>
                                ) : (
                                    <span className="text-stone-500 dark:text-stone-500">
                                        Stored locally only
                                    </span>
                                )}
                            </p>
                        </div>
                    )}

                    {activeTab === 'appearance' && (
                        <div className="h-full flex items-center justify-center animate-in fade-in duration-300">
                            <p className="text-stone-400 dark:text-stone-500 font-normal text-[12px]">Appearance settings coming soon...</p>
                        </div>
                    )}
                </div>

                {/* Footer Section */}
                <div className="px-5 py-2.5 border-t border-stone-50 dark:border-white/5 bg-[#fff] dark:bg-[#141414]">
                    <span className="text-[12px] text-stone-400 dark:text-stone-500 font-normal">
                        esc to close
                    </span>
                </div>
            </div>
        </div>
    );
}
