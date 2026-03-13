import { X, HelpCircle, ArrowUpAZ, ArrowDownZA, Filter, Group, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';

interface ColumnProfilePanelProps {
    isOpen: boolean;
    onClose: () => void;
    colors: any;
}

export default function ColumnProfilePanel({ isOpen, onClose, colors }: ColumnProfilePanelProps) {
    const { columnProfile, setSortConfig, sortConfig, setFilterConfig, filterConfig, setGroupConfig, groupConfig, isProfileLoading, openPrompt } = useStore();

    if (!isOpen || !columnProfile) return null;

    const { name, type, count, nulls, unique, sampleValues } = columnProfile;
    const nullPercentage = count > 0 ? ((nulls / count) * 100).toFixed(1) : "0.0";

    const handleSortAsc = () => {
        if (sortConfig?.colKey === name && sortConfig?.direction === 'ASC') setSortConfig(null);
        else setSortConfig({ colKey: name, direction: 'ASC' });
    };

    const handleSortDesc = () => {
        if (sortConfig?.colKey === name && sortConfig?.direction === 'DESC') setSortConfig(null);
        else setSortConfig({ colKey: name, direction: 'DESC' });
    };

    const handleFilter = () => {
        if (filterConfig?.colKey === name) {
            setFilterConfig(null);
            return;
        }

        openPrompt({
            title: `Filter ${name}`,
            message: `Enter exact value to filter '${name}' by:`,
            placeholder: 'Exact value...',
            confirmText: 'Filter',
            onConfirm: (val: string) => {
                if (val) setFilterConfig({ colKey: name, operator: '=', value: val });
            },
            onCancel: () => { },
        });
    };

    const handleGroup = () => {
        if (groupConfig?.colKey === name) {
            setGroupConfig(null);
        } else {
            setGroupConfig({ colKey: name });
        }
    };

    const isSortAsc = sortConfig?.colKey === name && sortConfig?.direction === 'ASC';
    const isSortDesc = sortConfig?.colKey === name && sortConfig?.direction === 'DESC';
    const isFiltered = filterConfig?.colKey === name;
    const isGrouped = groupConfig?.colKey === name;

    const btnClass = (active: boolean) => `flex items-center gap-2 text-[13px] font-medium px-3 py-2.5 rounded-xl transition-all ${active ? colors.quickActionActive : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-white/10 bg-stone-50 dark:bg-white/5'}`;

    return (
        <div className="w-[300px] bg-white dark:bg-[#111111] border-l border-stone-200 dark:border-white/10 flex flex-col h-full overflow-hidden shrink-0 relative transition-colors">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 dark:border-white/10 sticky top-0 bg-white dark:bg-[#111111] z-10 transition-colors">
                <div className="flex items-center gap-2 overflow-hidden truncate pr-2">
                    <span className="font-semibold text-stone-800 dark:text-stone-200 text-sm truncate" title={name}>{name}</span>
                    {isProfileLoading && <Loader2 size={12} className="animate-spin text-stone-400 dark:text-stone-500 shrink-0" />}
                </div>
                <button
                    title="Close Panel"
                    onClick={onClose}
                    className="p-1 hover:bg-stone-100 dark:hover:bg-white/10 rounded text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors shrink-0"
                >
                    <X size={16} />
                </button>
            </div>

            {/* Content & Footer Wrapper */}
            <div className={`flex flex-col h-full overflow-hidden transition-all duration-200 ${isProfileLoading ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>

                {/* Scrollable Stats */}
                <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6 custom-scrollbar">

                    {/* Data Type */}
                    <div className="flex items-center gap-2 text-stone-600 dark:text-stone-400">
                        <HelpCircle size={16} className="text-stone-400 dark:text-stone-500" />
                        <span className="text-sm font-medium capitalize">{type.toLowerCase()}</span>
                    </div>

                    {/* Statistics */}
                    <div className="flex flex-col gap-2">
                        <h3 className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">Statistics</h3>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-stone-50 dark:bg-white/5 rounded-lg p-3 flex flex-col justify-center transition-colors">
                                <span className="text-[10px] uppercase font-bold text-stone-400 dark:text-stone-500 tracking-wider mb-0.5">Count</span>
                                <span className="text-sm font-medium text-stone-700 dark:text-stone-300">{count.toLocaleString()}</span>
                            </div>
                            <div className="bg-stone-50 dark:bg-white/5 rounded-lg p-3 flex flex-col justify-center transition-colors">
                                <span className="text-[10px] uppercase font-bold text-stone-400 dark:text-stone-500 tracking-wider mb-0.5">Nulls</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-sm font-medium text-stone-700 dark:text-stone-300">{nulls.toLocaleString()}</span>
                                    <span className="text-xs text-stone-500 dark:text-stone-400">({nullPercentage}%)</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Unique */}
                    <div className="flex flex-col gap-2">
                        <h3 className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">Unique</h3>
                        <div className="bg-stone-50 dark:bg-white/5 rounded-lg p-3 w-1/2 flex flex-col justify-center transition-colors">
                            <span className="text-[10px] uppercase font-bold text-stone-400 dark:text-stone-500 tracking-wider mb-0.5 hidden">Unique</span>
                            <span className="text-sm font-medium text-stone-700 dark:text-stone-300">{unique.toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Sample Values */}
                    <div className="flex flex-col gap-2">
                        <h3 className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">Sample Values</h3>
                        <div className="flex flex-col gap-1.5">
                            {sampleValues.length > 0 ? (
                                sampleValues.map((val, idx) => (
                                    <div key={idx} className="bg-stone-50 dark:bg-white/5 px-3 py-1.5 rounded-md text-xs text-stone-600 dark:text-stone-400 truncate transition-colors" title={String(val)}>
                                        {String(val)}
                                    </div>
                                ))
                            ) : (
                                <div className="text-xs text-stone-400 dark:text-stone-500 italic">No samples available</div>
                            )}
                        </div>
                    </div>

                </div>

                {/* Fixed Quick Actions Footer */}
                <div className="p-5 border-t border-stone-100 dark:border-white/10 bg-white dark:bg-[#111111] flex flex-col gap-2 shrink-0 transition-colors">
                    <h3 className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-1">Quick Actions</h3>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={handleSortAsc}
                            className={btnClass(isSortAsc)}
                        >
                            <ArrowUpAZ size={16} className={isSortAsc ? colors.quickActionIcon : "text-stone-400"} /> Sort A→Z
                        </button>
                        <button
                            onClick={handleSortDesc}
                            className={btnClass(isSortDesc)}
                        >
                            <ArrowDownZA size={16} className={isSortDesc ? colors.quickActionIcon : "text-stone-400"} /> Sort Z→A
                        </button>
                        <button
                            onClick={handleFilter}
                            className={btnClass(isFiltered)}
                        >
                            <Filter size={16} className={isFiltered ? colors.quickActionIcon : "text-stone-400"} /> Filter
                        </button>
                        <button
                            onClick={handleGroup}
                            className={btnClass(isGrouped)}
                        >
                            <Group size={16} className={isGrouped ? colors.quickActionIcon : "text-stone-400"} /> Group by
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
