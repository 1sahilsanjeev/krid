import React from 'react';

export interface ExplanationData {
    summary: string;
    derived_columns: Array<{
        name: string;
        explanation: string;
        dependencies: string[];
    }>;
    filters: string[];
    aggregations: string[];
    risks: string[];
    optimization_suggestions: string[];
}

interface PipelineExplanationPanelProps {
    data: ExplanationData | null;
    isLoading?: boolean;
}

export function PipelineExplanationPanel({ data, isLoading }: PipelineExplanationPanelProps) {
    if (isLoading) {
        return (
            <div className="p-4 text-sm text-stone-500 dark:text-stone-400 font-mono animate-pulse bg-stone-50 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-lg transition-colors">
                Analyzing pipeline...
            </div>
        );
    }

    if (!data) {
        return null;
    }

    return (
        <div className="p-4 bg-stone-50 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-lg font-mono text-sm text-stone-800 dark:text-stone-200 space-y-6 overflow-y-auto max-h-[600px] shadow-inner transition-colors">

            {/* Summary */}
            <section>
                <h3 className="font-bold text-stone-900 dark:text-stone-100 border-b border-stone-200 dark:border-white/10 pb-1 mb-2 text-xs uppercase tracking-wider">Summary</h3>
                <p className="text-stone-600 dark:text-stone-300 leading-relaxed bg-white dark:bg-[#1a1a1a] p-3 rounded border border-stone-100 dark:border-white/5 transition-colors">{data.summary}</p>
            </section>

            {/* Derived Columns */}
            {data.derived_columns && data.derived_columns.length > 0 && (
                <section>
                    <h3 className="font-bold text-stone-900 dark:text-stone-100 border-b border-stone-200 dark:border-white/10 pb-1 mb-2 text-xs uppercase tracking-wider">Derived Columns</h3>
                    <div className="space-y-2">
                        {data.derived_columns.map((col, idx) => (
                            <div key={idx} className="bg-white dark:bg-[#1a1a1a] p-3 rounded border border-stone-100 dark:border-white/5 transition-colors">
                                <div className="font-bold text-indigo-600 dark:text-indigo-400 mb-1">{col.name}</div>
                                <p className="text-stone-600 dark:text-stone-300 mb-2">{col.explanation}</p>
                                {col.dependencies && col.dependencies.length > 0 && (
                                    <div className="text-[11px] text-stone-400 dark:text-stone-500 font-medium">
                                        <span className="text-stone-500 dark:text-stone-400">DEPS:</span> {col.dependencies.join(', ')}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Filters */}
            {data.filters && data.filters.length > 0 && (
                <section>
                    <h3 className="font-bold text-stone-900 dark:text-stone-100 border-b border-stone-200 dark:border-white/10 pb-1 mb-2 text-xs uppercase tracking-wider">Filters</h3>
                    <ul className="list-disc list-inside space-y-1 text-stone-600 dark:text-stone-300 bg-white dark:bg-[#1a1a1a] p-3 rounded border border-stone-100 dark:border-white/5 transition-colors">
                        {data.filters.map((filter, idx) => (
                            <li key={idx}>{filter}</li>
                        ))}
                    </ul>
                </section>
            )}

            {/* Aggregations */}
            {data.aggregations && data.aggregations.length > 0 && (
                <section>
                    <h3 className="font-bold text-stone-900 dark:text-stone-100 border-b border-stone-200 dark:border-white/10 pb-1 mb-2 text-xs uppercase tracking-wider">Aggregations</h3>
                    <ul className="list-disc list-inside space-y-1 text-stone-600 dark:text-stone-300 bg-white dark:bg-[#1a1a1a] p-3 rounded border border-stone-100 dark:border-white/5 transition-colors">
                        {data.aggregations.map((agg, idx) => (
                            <li key={idx}>{agg}</li>
                        ))}
                    </ul>
                </section>
            )}

            {/* Risks */}
            {data.risks && data.risks.length > 0 && (
                <section>
                    <h3 className="font-bold text-red-600 dark:text-red-400 border-b border-red-100 dark:border-red-500/20 pb-1 mb-2 text-xs uppercase tracking-wider">Risks Identified</h3>
                    <ul className="list-disc list-inside space-y-1 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 p-3 rounded border border-red-100 dark:border-red-500/20 transition-colors">
                        {data.risks.map((risk, idx) => (
                            <li key={idx}>{risk}</li>
                        ))}
                    </ul>
                </section>
            )}

            {/* Optimization Suggestions */}
            {data.optimization_suggestions && data.optimization_suggestions.length > 0 && (
                <section>
                    <h3 className="font-bold text-emerald-600 dark:text-emerald-400 border-b border-emerald-100 dark:border-emerald-500/20 pb-1 mb-2 text-xs uppercase tracking-wider">Optimization Suggestions</h3>
                    <ul className="list-disc list-inside space-y-1 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 p-3 rounded border border-emerald-100 dark:border-emerald-500/20 transition-colors">
                        {data.optimization_suggestions.map((opt, idx) => (
                            <li key={idx}>{opt}</li>
                        ))}
                    </ul>
                </section>
            )}

        </div>
    );
}
