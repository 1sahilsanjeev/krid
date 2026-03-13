import { MoreHorizontal } from 'lucide-react';
import { useAppStore } from '../store.ts';

const files = [
    { id: 1, name: 'sales', type: 'csv', rows: '1.2 KB', color: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' },
    { id: 2, name: 'sample', type: 'csv', rows: '840 B', color: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' },
    { id: 3, name: 'api_logs', type: 'json', rows: '420 B', color: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400' },
];

export default function Sidebar() {
    const { setActiveFile } = useAppStore();

    return (
        <div className="fixed left-6 top-24 bottom-20 w-48 flex flex-col gap-6 z-20 pointer-events-none">
            {files.map((file) => (
                <div
                    key={file.id}
                    className="group pointer-events-auto flex flex-col items-center gap-2 w-20 cursor-pointer transition-transform hover:scale-105"
                    onClick={() => {
                        console.log(`${file.name} clicked`);
                        setActiveFile(file.name);
                    }}
                >
                    <div className={`w-14 h-14 rounded-2xl shadow-sm dark:shadow-black/20 flex items-center justify-center ${file.color} relative transition-colors`}>
                        {file.type === 'csv' ? <span className="font-bold text-[10px] uppercase">csv</span> : <span className="font-bold text-[10px] uppercase">json</span>}

                        {/* File Icon Overlay */}
                        <div className="absolute -top-1 -right-1 bg-white dark:bg-[#2a2a2a] rounded-full p-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal size={12} className="text-stone-400 dark:text-stone-500" />
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-sm font-medium text-stone-700 dark:text-stone-300 transition-colors">{file.name}</div>
                        <div className="text-[10px] text-stone-400 dark:text-stone-500 transition-colors">{file.rows}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}
