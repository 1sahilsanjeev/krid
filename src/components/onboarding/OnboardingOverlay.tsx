import React from 'react';
import { useStore } from '../../store/useStore';
import { CheckCircle2, Sparkles, LayoutGrid, Search } from 'lucide-react';

export const OnboardingOverlay: React.FC = () => {
    const { onboardingStep, nextOnboardingStep, showOnboarding, hideOnboarding } = useStore();

    if (!showOnboarding) return null;

    // Step 1: Auto-layout (handled in Canvas.tsx)
    // Step 2: AI Search (handled in TableView.tsx)
    // Step 3: Success Screen (handled here)

    if (onboardingStep !== 3) return null;

    return (
        <div className="fixed inset-0 z-[20000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-500">
            <div className="bg-white dark:bg-[#111111] w-full max-w-md rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-slate-200/60 dark:border-white/10 overflow-hidden animate-in zoom-in-95 duration-700">
                <div className="p-8 text-center">
                    {/* Success Icon */}
                    <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    </div>

                    <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">
                        You're all set!
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                        You've learned the basics of Krid. Start exploring your data with the power of AI and a flexible canvas.
                    </p>

                    <button
                        onClick={hideOnboarding}
                        className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-all active:scale-[0.98] shadow-lg shadow-indigo-600/20"
                    >
                        Start Exploring
                    </button>
                    
                    <button
                        onClick={() => {
                            // Reset to step 1 if they want to play again
                            useStore.setState({ onboardingStep: 1 });
                        }}
                        className="mt-4 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        Replay Tutorial
                    </button>
                </div>
                
                {/* Feature highlights footer */}
                <div className="bg-slate-50 dark:bg-white/5 px-8 py-4 flex items-center justify-center gap-6 border-t border-slate-200/60 dark:border-white/5">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <LayoutGrid size={12} /> Canvas
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Search size={12} /> AI Search
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Sparkles size={12} /> Insights
                    </div>
                </div>
            </div>
        </div>
    );
};
