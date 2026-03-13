import { X, Clock, Pin, Trash2 } from 'lucide-react';
import { useStore } from '../store/useStore';

interface QueryHistoryPanelProps {
    onClose: () => void;
    onSelectQuery: (id: string) => void;
}

export default function QueryHistoryPanel({ onClose, onSelectQuery }: QueryHistoryPanelProps) {
    const { queryHistory, pinQuery, removeQuery } = useStore();

    const sortedHistory = [...queryHistory].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.timestamp - a.timestamp;
    });

    return (
        <div className="absolute inset-0 bg-white/80 dark:bg-[#1a1a1a]/90 backdrop-blur-sm z-[70] animate-in fade-in duration-200 flex flex-col transition-colors">
            <div className="flex items-center justify-between px-6 py-2 border-b border-stone-100 dark:border-white/10 bg-white/50 dark:bg-black/20 transition-colors">
                <h4 className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">Recent Queries</h4>
                <button
                    onClick={onClose}
                    className="text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 p-1 transition-colors"
                    title="Close history"
                >
                    <X size={14} />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1 custom-scrollbar">
                {sortedHistory.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-stone-300 dark:text-stone-600 gap-2 opacity-60">
                        <Clock size={32} strokeWidth={1.5} />
                        <span className="text-xs font-medium">No query history yet</span>
                    </div>
                ) : (
                    sortedHistory.map((item) => (
                        <div
                            key={item.id}
                            className="group flex items-start gap-3 p-2 rounded-xl hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 transition-all border border-transparent hover:border-emerald-100/50 dark:hover:border-emerald-800/50 cursor-pointer"
                            onClick={() => onSelectQuery(item.id)}
                        >
                            <div className={`mt-1 p-1 rounded-lg ${item.pinned ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-500 dark:text-amber-400' : 'bg-stone-100 dark:bg-white/5 text-stone-400 dark:text-stone-500 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/40 group-hover:text-emerald-600 dark:group-hover:text-emerald-400'}`}>
                                {item.pinned ? <Pin size={10} fill="currentColor" /> : <Clock size={10} />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-mono text-stone-600 dark:text-stone-400 truncate group-hover:text-stone-900 dark:group-hover:text-stone-200 transition-colors">
                                    {item.sql.split('\n')[0].trim() || 'Empty query'}
                                </div>
                                <div className="text-[10px] text-stone-400 mt-1 font-medium">
                                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        pinQuery(item.id);
                                    }}
                                    className={`p-1.5 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors ${item.pinned ? 'text-amber-500' : 'text-stone-400 dark:text-stone-500 hover:text-amber-600 dark:hover:text-amber-400'}`}
                                    title={item.pinned ? "Unpin" : "Pin query"}
                                >
                                    <Pin size={12} fill={item.pinned ? "currentColor" : "none"} />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeQuery(item.id);
                                    }}
                                    className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-stone-400 dark:text-stone-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                    title="Remove from history"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
