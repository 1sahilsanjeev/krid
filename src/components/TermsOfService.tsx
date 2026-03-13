import { ArrowLeft } from 'lucide-react';
import { useStore } from '../store/useStore';

const TermsOfService = () => {
    const { setShowTermsOfService } = useStore();

    return (
        <div 
            style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
            className="fixed inset-0 bg-white dark:bg-[#0a0a0a] z-[10000] flex justify-center w-full h-full overflow-y-auto hide-scrollbar font-sans selection:bg-emerald-100 dark:selection:bg-emerald-900/30"
        >
            <style dangerouslySetInnerHTML={{ __html: `.hide-scrollbar::-webkit-scrollbar { display: none; }` }} />
            <div className="w-full max-w-3xl px-8 py-16 md:py-24 space-y-12">
                
                {/* Back Button */}
                <button 
                    onClick={() => setShowTermsOfService(false)}
                    className="flex items-center gap-2 text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors text-sm group"
                >
                    <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
                    <span>Back to Krid</span>
                </button>

                <header className="space-y-4">
                    <h1 className="text-4xl md:text-5xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
                        Terms of Service
                    </h1>
                    <p className="text-sm text-stone-400 dark:text-stone-500 font-medium">
                        Last updated: March 2026
                    </p>
                </header>

                <div className="prose prose-stone dark:prose-invert max-w-none space-y-10">
                    
                    <p className="text-stone-600 dark:text-stone-400 leading-relaxed text-lg">
                        Welcome to <span className="font-semibold text-stone-900 dark:text-stone-100">Krid</span>. 
                        These Terms govern your use of the Krid website and services. By using Krid, you agree to these terms.
                    </p>

                    <section className="space-y-4">
                        <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">1. Use of the Service</h2>
                        <p className="text-stone-600 dark:text-stone-400 leading-relaxed">
                            Krid provides tools for exploring and analyzing structured data. You agree to use the service only for lawful purposes. You must not:
                        </p>
                        <ul className="list-disc pl-5 text-stone-600 dark:text-stone-400 space-y-1 py-2">
                            <li>Attempt to disrupt the service</li>
                            <li>Reverse engineer the system</li>
                            <li>Upload malicious files</li>
                            <li>Abuse AI functionality</li>
                        </ul>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">2. User Data</h2>
                        <p className="text-stone-600 dark:text-stone-400 leading-relaxed">
                            You are responsible for the datasets you upload or process. You confirm that you have the right to use the data and that it does not violate laws or third-party rights. <span className="font-bold text-stone-900 dark:text-stone-100">Krid does not claim ownership of your data.</span>
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">3. AI Features</h2>
                        <p className="text-stone-600 dark:text-stone-400 leading-relaxed">
                            Krid may use AI systems to assist with data analysis, query generation, pipeline generation, and explanations. 
                            AI results may occasionally be incorrect. <span className="font-bold text-stone-900 dark:text-stone-100">You are responsible for verifying outputs before relying on them.</span>
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">4. Availability</h2>
                        <p className="text-stone-600 dark:text-stone-400 leading-relaxed">
                            We aim to provide reliable service but cannot guarantee uninterrupted access, error-free operation, or permanent availability. The service may change or evolve over time.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">5. Intellectual Property</h2>
                        <p className="text-stone-600 dark:text-stone-400 leading-relaxed">
                            The Krid platform, including design, software, branding, and features, are owned by Krid and protected by intellectual property laws.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">6. Limitation of Liability</h2>
                        <p className="text-stone-600 dark:text-stone-400 leading-relaxed italic border-l-2 border-stone-100 dark:border-white/5 pl-4">
                            To the maximum extent permitted by law, Krid is not liable for data loss, business interruption, indirect damages, or reliance on AI-generated results. Use the service at your own risk.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">7. Termination</h2>
                        <p className="text-stone-600 dark:text-stone-400 leading-relaxed">
                            We may suspend or terminate access if a user violates these Terms. Users may stop using the service at any time.
                        </p>
                    </section>

                    <section className="space-y-4 border-t border-stone-100 dark:border-white/5 pt-10">
                        <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">8. Changes to Terms</h2>
                        <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
                            We may update these Terms periodically. Continued use of the service means you accept the updated terms.
                        </p>
                    </section>
                </div>

                <footer className="pt-20 pb-10 flex flex-col items-center gap-6">
                    <button 
                        onClick={() => setShowTermsOfService(false)}
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

export default TermsOfService;
