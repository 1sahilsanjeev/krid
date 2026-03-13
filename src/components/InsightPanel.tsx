import { Lightbulb, Loader2 } from 'lucide-react';

interface InsightPanelProps {
    text: string | null;
    isLoading: boolean;
    onClose: () => void;
}

export default function InsightPanel({ text, isLoading, onClose }: InsightPanelProps) {
    if (!text && !isLoading) return null;

    return (
        <div className="bg-stone-50 dark:bg-white/5 border border-stone-100 dark:border-white/10 rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300 flex flex-col max-h-[400px] transition-colors">
            <div className="px-4 py-2 bg-stone-100/50 dark:bg-black/20 border-b border-stone-100 dark:border-white/10 flex items-center justify-between shrink-0 transition-colors">
                <div className="flex items-center gap-2">
                    <Lightbulb size={12} className="text-amber-500" />
                    <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">AI Insights</span>
                </div>
                <button
                    onClick={onClose}
                    className="text-[10px] text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 font-medium transition-colors"
                >
                    Close
                </button>
            </div>
            <div className="p-4 overflow-y-auto custom-scrollbar">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-6 gap-3">
                        <Loader2 className="animate-spin text-stone-300" size={24} />
                        <span className="text-xs text-stone-400 font-medium animate-pulse italic">
                            Analyzing patterns and trends...
                        </span>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {text?.split('\n').filter(l => l.trim()).map((line, i) => (
                            <div key={i} className="flex gap-3 text-sm text-stone-700 dark:text-stone-300 leading-relaxed group">
                                <span className="text-indigo-400 font-bold shrink-0 mt-1 select-none">•</span>
                                <span className="group-hover:translate-x-1 transition-transform inline-block">
                                    {line.replace(/^[•\-\*]\s*/, '').trim()}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e7e5e4;
                    border-radius: 10px;
                }
            ` }} />
        </div>
    );
}
