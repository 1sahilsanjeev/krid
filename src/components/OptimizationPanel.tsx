import { Zap, Trash2, AlertTriangle, Lightbulb, Check, X, Loader2, Info } from 'lucide-react';

export interface Optimization {
    type: 'duplicate_expression' | 'unused_column' | 'simplifiable_expression' | 'risk' | 'redundant_transform';
    target: string;
    details: string;
    suggestion: string;
}

interface OptimizationPanelProps {
    optimizations: Optimization[];
    onApply: (optimization: Optimization) => Promise<void>;
    onIgnore: (optimization: Optimization) => void;
    isApplying?: string | null;
}

export function OptimizationPanel({
    optimizations,
    onApply,
    onIgnore,
    isApplying
}: OptimizationPanelProps) {
    if (!optimizations || optimizations.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-stone-50 dark:bg-white/5 rounded-2xl border-2 border-dashed border-stone-200 dark:border-white/10 transition-colors">
                <div className="w-12 h-12 rounded-full bg-stone-100 dark:bg-white/10 flex items-center justify-center text-stone-400 dark:text-stone-500 mb-4 transition-colors">
                    <Info size={24} />
                </div>
                <p className="text-stone-500 dark:text-stone-400 font-medium text-sm text-center">No optimization suggestions found for this pipeline.</p>
                <p className="text-stone-400 dark:text-stone-500 text-xs mt-1 text-center">Your pipeline logic appears efficient and robust.</p>
            </div>
        );
    }

    const getTypeStyles = (type: string) => {
        switch (type) {
            case 'duplicate_expression':
                return { icon: <Zap size={16} />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-100 dark:border-blue-500/20' };
            case 'unused_column':
                return { icon: <Trash2 size={16} />, color: 'text-stone-600 dark:text-stone-400', bg: 'bg-stone-100 dark:bg-white/10', border: 'border-stone-200 dark:border-white/20' };
            case 'risk':
                return { icon: <AlertTriangle size={16} />, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-100 dark:border-red-500/20' };
            case 'simplifiable_expression':
                return { icon: <Lightbulb size={16} />, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-100 dark:border-amber-500/20' };
            case 'redundant_transform':
                return { icon: <Zap size={16} />, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-500/10', border: 'border-indigo-100 dark:border-indigo-500/20' };
            default:
                return { icon: <Info size={16} />, color: 'text-stone-600 dark:text-stone-400', bg: 'bg-stone-50 dark:bg-white/5', border: 'border-stone-100 dark:border-white/10' };
        }
    };

    const getTypeLabel = (type: string) => {
        return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    return (
        <div className="flex flex-col gap-4">
            {optimizations.map((opt, idx) => {
                const styles = getTypeStyles(opt.type);
                const applyingCurrent = isApplying === opt.target;

                return (
                    <div
                        key={`${opt.target}-${idx}`}
                        className="bg-white dark:bg-[#1a1a1a] border border-stone-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm hover:shadow-md dark:shadow-black/20 transition-all duration-200"
                    >
                        {/* Header */}
                        <div className={`px-4 py-2.5 ${styles.bg} border-b ${styles.border} flex items-center justify-between transition-colors`}>
                            <div className="flex items-center gap-2">
                                <span className={styles.color}>{styles.icon}</span>
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${styles.color} font-mono`}>
                                    {getTypeLabel(opt.type)}
                                </span>
                            </div>
                            <span className="text-[11px] font-mono font-bold text-stone-600 dark:text-stone-300 bg-white/80 dark:bg-black/20 px-2 py-0.5 rounded border border-stone-200 dark:border-white/10 shadow-sm transition-colors">
                                {opt.target}
                            </span>
                        </div>

                        {/* Content */}
                        <div className="p-4 space-y-4">
                            <div>
                                <h4 className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-tight mb-1">Issue Detected</h4>
                                <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed font-medium">{opt.details}</p>
                            </div>

                            <div className="bg-stone-50 dark:bg-white/5 rounded-lg p-3 border border-stone-100 dark:border-white/5 group relative transition-colors">
                                <h4 className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-tight mb-1.5 flex items-center gap-1">
                                    <Check size={10} /> Suggested Fix
                                </h4>
                                <div className="text-xs text-stone-600 dark:text-stone-300 font-mono bg-white dark:bg-[#141414] p-2 rounded border border-stone-100 dark:border-white/5 overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-inner transition-colors">
                                    {opt.suggestion}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 pt-1">
                                <button
                                    onClick={() => onApply(opt)}
                                    disabled={!!isApplying || opt.type === 'risk'}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all shadow-sm
                                        ${opt.type === 'risk'
                                            ? 'bg-stone-100 dark:bg-white/10 text-stone-400 dark:text-stone-500 cursor-not-allowed border border-stone-200 dark:border-white/10'
                                            : 'bg-stone-900 dark:bg-stone-200 text-white dark:text-stone-900 hover:bg-black dark:hover:bg-white active:scale-[0.98] disabled:opacity-50'
                                        }`}
                                    title={opt.type === 'risk' ? "Safety risks require manual intervention" : "Apply this optimization"}
                                >
                                    {applyingCurrent ? (
                                        <Loader2 className="animate-spin" size={14} />
                                    ) : (
                                        <Check size={14} strokeWidth={3} />
                                    )}
                                    {opt.type === 'risk' ? 'Manual Action Required' : 'Apply Optimization'}
                                </button>

                                <button
                                    onClick={() => onIgnore(opt)}
                                    disabled={!!applyingCurrent}
                                    className="px-3 py-2.5 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/10 rounded-lg transition-all border border-transparent hover:border-stone-200 dark:hover:border-white/10"
                                    title="Dismiss suggestion"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {opt.type === 'risk' && (
                                <div className="flex items-center gap-2 text-[10px] text-red-500 dark:text-red-400 font-bold bg-red-50 dark:bg-red-500/10 p-2 rounded-md border border-red-100 dark:border-red-500/20 transition-colors">
                                    <AlertTriangle size={12} />
                                    <span>Security/Logic risks must be addressed manually in the expression editor.</span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
