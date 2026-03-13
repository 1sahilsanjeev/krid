import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: any[]) {
    return twMerge(clsx(inputs));
}

export default function Toast() {
    const { toast } = useStore();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (toast) {
            setVisible(true);
        } else {
            setVisible(false);
        }
    }, [toast]);

    if (!toast) return null;

    const icons = {
        info: <Info size={18} className="text-blue-500" />,
        error: <AlertCircle size={18} className="text-red-500" />,
        success: <CheckCircle2 size={18} className="text-emerald-500" />
    };

    const bgColors = {
        info: 'bg-blue-50 border-blue-100',
        error: 'bg-red-50 border-red-100',
        success: 'bg-emerald-50 border-emerald-100'
    };

    return (
        <div
            className={cn(
                "fixed bottom-8 left-1/2 -translate-x-1/2 z-[20000] transition-all duration-300 transform",
                visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"
            )}
        >
            <div className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-lg bg-white min-w-[320px] max-w-[480px]",
                bgColors[toast.type]
            )}>
                <div className="flex-shrink-0">
                    {icons[toast.type]}
                </div>
                <p className="flex-1 text-[14px] font-medium text-stone-700 leading-tight">
                    {toast.message}
                </p>
            </div>
        </div>
    );
}
