import { Search, Settings, MessageSquare } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function Layout({ children }: { children: React.ReactNode }) {
    const { setCommandPaletteOpen, setSettingsOpen, setShowPrivacyPolicy, setShowTermsOfService } = useStore();

    return (
        <div className="min-h-screen bg-[#fafaf9] dark:bg-[#111111] flex flex-col font-sans text-stone-800 dark:text-stone-200 relative overflow-hidden transition-colors duration-200">
            {/* Background removed, handled by Canvas */}

            {/* Header */}
            <header className="fixed top-0 left-0 right-0 h-10 flex items-center justify-between px-4 z-10 bg-white dark:bg-[#141414] border-b border-stone-100/50 dark:border-white/5 transition-colors duration-200">
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-800 dark:text-stone-200 tracking-tight">Krid</span>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        className="flex items-center gap-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors group cursor-pointer"
                        onClick={() => setCommandPaletteOpen(true)}
                    >
                        <Search size={14} className="group-hover:text-stone-600 dark:group-hover:text-stone-300" />
                        <span className="text-xs font-medium">Search</span>
                        <div className="flex items-center gap-0.5 text-[10px] text-stone-400 dark:text-stone-500 border border-stone-200 dark:border-white/10 rounded px-1 min-w-[20px] justify-center bg-gray-50 dark:bg-white/5 ml-0.5">
                            <span>⌘</span><span>K</span>
                        </div>
                    </button>

                    <div className="flex items-center gap-1 ml-1">
                        <button
                            title="Settings"
                            onClick={() => setSettingsOpen(true)}
                            className="p-1.5 hover:bg-stone-100 dark:hover:bg-white/10 rounded-md transition-colors text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
                        >
                            <Settings size={15} />
                        </button>
                        <button
                            title="Contact Support"
                            onClick={() => window.open('mailto:support@example.com')}
                            className="p-1.5 hover:bg-stone-100 dark:hover:bg-white/10 rounded-md transition-colors text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
                        >
                            <MessageSquare size={15} />
                        </button>
                    </div>

                    <div className="w-px h-3 bg-stone-200 dark:bg-stone-700"></div>
                    <button className="p-1.5 hover:bg-stone-100 dark:hover:bg-white/10 rounded-md transition-colors text-stone-400">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="9" y1="3" x2="9" y2="21" /></svg>
                    </button>
                </div>
            </header>

            {/* Top Right Version Pill */}
            <div className="fixed top-14 right-6 z-10">
                <div className="bg-white/80 dark:bg-[#111111]/80 backdrop-blur-md px-3 py-1 rounded-full shadow-sm border border-stone-200/50 dark:border-white/5 text-[11px] font-medium text-stone-500 dark:text-stone-400 flex items-center gap-2 transition-all duration-300 hover:border-stone-300 dark:hover:border-white/10 group">
                    <span className="text-stone-700 dark:text-stone-200">v0.0.0</span>
                    <span className="text-stone-300 dark:text-stone-700 font-bold ml-1">·</span>
                    <span className="text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors cursor-pointer pr-1">What's New</span>
                </div>
            </div>

            {/* Main Content Area */}
            <main className="flex-1 relative z-0 pt-10">
                {children}
            </main>

            {/* Bottom Footer */}
            <footer className="fixed bottom-4 left-6 z-10 text-[10px] text-stone-300 flex gap-3">
                <button onClick={() => setShowPrivacyPolicy(true)} className="hover:text-stone-500 transition-colors">Privacy</button>
                <span className="text-stone-200">·</span>
                <button onClick={() => setShowTermsOfService(true)} className="hover:text-stone-500 transition-colors">Terms</button>
            </footer>
        </div>
    );
}
