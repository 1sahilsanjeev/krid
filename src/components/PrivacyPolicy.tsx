import { ArrowLeft } from 'lucide-react';
import { useStore } from '../store/useStore';

const PrivacyPolicy = () => {
    const { setShowPrivacyPolicy } = useStore();

    return (
        <div 
            style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
            className="fixed inset-0 bg-white dark:bg-[#0a0a0a] z-[10000] flex justify-center w-full h-full overflow-y-auto hide-scrollbar font-sans selection:bg-emerald-100 dark:selection:bg-emerald-900/30"
        >
            <style dangerouslySetInnerHTML={{ __html: `.hide-scrollbar::-webkit-scrollbar { display: none; }` }} />
            <div className="w-full max-w-3xl px-8 py-16 md:py-24 space-y-12">
                
                {/* Back Button */}
                <button 
                    onClick={() => setShowPrivacyPolicy(false)}
                    className="flex items-center gap-2 text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors text-sm group"
                >
                    <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
                    <span>Back to Krid</span>
                </button>

                <header className="space-y-4">
                    <h1 className="text-4xl md:text-5xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
                        Privacy Policy
                    </h1>
                    <p className="text-sm text-stone-400 dark:text-stone-500 font-medium">
                        Last updated: March 2026
                    </p>
                </header>

                <div className="prose prose-stone dark:prose-invert max-w-none space-y-10">
                    
                    <section className="space-y-4">
                        <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">Overview</h2>
                        <p className="text-stone-600 dark:text-stone-400 leading-relaxed text-lg">
                            Welcome to <span className="font-semibold text-stone-900 dark:text-stone-100">Krid</span>. 
                            Krid is a browser-based data exploration tool designed to help you analyze datasets using structured pipelines and AI. 
                            Your privacy is fundamental to how we build: <span className="font-bold text-stone-900 dark:text-stone-100">all data processing happens locally in your browser.</span> 
                            We do not operate servers that store, process, or have access to your private data.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">Data We Collect</h2>
                        <p className="text-stone-600 dark:text-stone-400 leading-relaxed">
                            <span className="font-bold text-stone-900 dark:text-stone-100">We do not collect any personal data or spreadsheet content.</span> 
                            Krid runs entirely in your browser using technologies like DuckDB WASM for data processing. 
                            Files you open are processed locally and never leave your device.
                        </p>

                        <div className="space-y-4 pl-4 border-l-2 border-stone-100 dark:border-white/5">
                            <div className="space-y-1">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-stone-400 dark:text-stone-600">Usage Data</h3>
                                <p className="text-stone-600 dark:text-stone-400">
                                    We may collect limited technical data to understand how the app is used and improve performance:
                                </p>
                                <ul className="list-disc pl-5 text-stone-600 dark:text-stone-400 space-y-1 py-2">
                                    <li>Anonymized page views and navigation patterns</li>
                                    <li>Browser type and device information</li>
                                    <li>Performance logs and error reports</li>
                                </ul>
                            </div>

                            <div className="space-y-1">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-stone-400 dark:text-stone-600">AI Requests</h3>
                                <p className="text-stone-600 dark:text-stone-400">
                                    If you use AI features (such as natural language queries), your prompts and limited schema information are sent to third-party AI providers. No raw dataset content is included in these requests.
                                </p>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">Local Storage</h2>
                        <p className="text-stone-600 dark:text-stone-400 leading-relaxed">
                            Krid stores the following data locally on your device using browser storage (localStorage and IndexedDB):
                        </p>
                        <ul className="list-disc pl-5 text-stone-600 dark:text-stone-400 space-y-2">
                            <li><span className="font-semibold text-stone-800 dark:text-stone-200">Application settings</span> — theme preferences and view configurations.</li>
                            <li><span className="font-semibold text-stone-800 dark:text-stone-200">Session data</span> — temporary state of your active analysis.</li>
                            <li><span className="font-semibold text-stone-800 dark:text-stone-200">File metadata</span> — names and sizes of datasets you've explored.</li>
                        </ul>
                    </section>

                    <section className="space-y-4 pt-4">
                        <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">Third-Party Services</h2>
                        <p className="text-stone-600 dark:text-stone-400 leading-relaxed">
                            Some features rely on third-party providers (AI models, hosting infrastructure). 
                            These services process only the limited request data necessary to provide their functionality. 
                            <span className="font-bold text-emerald-600 dark:text-emerald-500"> We do not sell your data.</span>
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">Your Rights & Security</h2>
                        <p className="text-stone-600 dark:text-stone-400 leading-relaxed">
                            Depending on your location, you may have rights to access, delete, or correct your data. 
                            While we implement technical safeguards, no online service can guarantee absolute security. 
                            Krid is not intended for users under the age of 13.
                        </p>
                    </section>

                    <section className="space-y-4 pt-10 border-t border-stone-100 dark:border-white/5">
                        <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">Changes to This Policy</h2>
                        <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
                            We may update this Privacy Policy periodically. Updates will be posted on this page with a revised "Last updated" date.
                        </p>
                    </section>
                </div>

                <footer className="pt-20 pb-10 flex flex-col items-center gap-6">
                    <button 
                        onClick={() => setShowPrivacyPolicy(false)}
                        className="px-10 py-4 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-2xl font-bold shadow-xl shadow-black/5 dark:shadow-white/5 hover:scale-105 transition-transform active:scale-95"
                    >
                        Return to Application
                    </button>
                    <p className="text-xs text-stone-300 dark:text-stone-700">
                        &copy; 2026 Krid. All rights reserved.
                    </p>
                </footer>
            </div>
        </div>
    );
};

export default PrivacyPolicy;
