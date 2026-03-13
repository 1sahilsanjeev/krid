import { X, Search, Plus, Table, ChevronDown, MoveDown, Hash, CaseSensitive, Pencil, ArrowRight, Command } from 'lucide-react';
import React from 'react';
import { useAppStore } from '../store.ts';

interface SalesTableProps {
    data?: Record<string, any>[];
}

export default function SalesTable({ data }: SalesTableProps) {
    const { setActiveFile } = useAppStore();

    // Mock data matching the screenshot
    const defaultData = [
        { id: 0, product: "Laptop Pro", category: "Electronics", price: 1299, quantity: 45, revenue: 58455, region: "North" },
        { id: 1, product: "Wireless Mouse", category: "Electronics", price: 29, quantity: 234, revenue: 6786, region: "East" },
        { id: 2, product: "Office Chair", category: "Furniture", price: 399, quantity: 67, revenue: 26733, region: "West" },
        { id: 3, product: "Standing Desk", category: "Furniture", price: 599, quantity: 32, revenue: 19168, region: "North" },
        { id: 4, product: "Monitor 27\"", category: "Electronics", price: 449, quantity: 89, revenue: 39961, region: "South" },
        { id: 5, product: "Keyboard RGB", category: "Electronics", price: 149, quantity: 156, revenue: 23244, region: "East" },
        { id: 6, product: "Webcam HD", category: "Electronics", price: 79, quantity: 203, revenue: 16037, region: "West" },
        { id: 7, product: "Desk Lamp", category: "Furniture", price: 49, quantity: 312, revenue: 15288, region: "South" },
        { id: 8, product: "USB Hub", category: "Electronics", price: 39, quantity: 445, revenue: 17355, region: "North" },
        { id: 9, product: "Cable Kit", category: "Accessories", price: 19, quantity: 567, revenue: 10773, region: "East" }
    ];

    const [tableData, setTableData] = React.useState<Record<string, any>[]>(data && data.length > 0 ? data : defaultData);

    // Helper for formatting numbers
    const formatNumber = (num: number) => {
        return num.toLocaleString();
    };

    const [selectedCell, setSelectedCell] = React.useState<{ rowId: number, colKey: string } | null>({ rowId: 4, colKey: 'category' });
    const [editingCell, setEditingCell] = React.useState<{ rowId: number, colKey: string } | null>(null);
    const [tempValue, setTempValue] = React.useState<string | number>("");
    const [isAddColumnOpen, setIsAddColumnOpen] = React.useState(false);

    // Helper to check if a cell is selected
    const isSelected = (rowId: number, colKey: string) => {
        return selectedCell?.rowId === rowId && selectedCell?.colKey === colKey;
    };

    const isEditing = (rowId: number, colKey: string) => {
        return editingCell?.rowId === rowId && editingCell?.colKey === colKey;
    };

    const handleCellClick = (rowId: number, colKey: string) => {
        setSelectedCell({ rowId, colKey });
    };

    const handleDoubleClick = (rowId: number, colKey: string, initialValue: any) => {
        setEditingCell({ rowId, colKey });
        setTempValue(initialValue);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTempValue(e.target.value);
    };

    const isSavedRef = React.useRef(false);

    React.useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (editingCell || isAddColumnOpen || !selectedCell) return;

            const isCtrl = e.ctrlKey || e.metaKey;

            if (e.key === 'F2') {
                e.preventDefault();
                const currentRow = tableData.find(d => (d as any).id === selectedCell.rowId);
                const val = currentRow?.[selectedCell.colKey];
                setEditingCell(selectedCell);
                setTempValue(val !== undefined && val !== null ? String(val) : "");
                return;
            }

            if (e.key.length === 1 && !isCtrl && !e.altKey) {
                setEditingCell(selectedCell);
                setTempValue(e.key);
                return;
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [editingCell, isAddColumnOpen, selectedCell, tableData]);

    React.useEffect(() => {
        if (editingCell) {
            isSavedRef.current = false;
        }
    }, [editingCell]);

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowId: number, colKey: string) => {
        if (e.key === 'Enter') {
            isSavedRef.current = true;
            saveEdit(rowId, colKey);
        } else if (e.key === 'Escape') {
            cancelEdit();
        }
    };

    const saveEdit = (rowId: number, colKey: string) => {
        const newData = [...tableData];
        const rowIndex = newData.findIndex(item => item.id === rowId);
        if (rowIndex !== -1) {
            // Basic type conversion if needed (assuming simple types for now)
            // In a real app, we'd check the column type
            let finalValue = tempValue;
            const originalValue = newData[rowIndex][colKey];

            if (typeof originalValue === 'number' && !isNaN(Number(tempValue))) {
                finalValue = Number(tempValue);
            }

            newData[rowIndex] = { ...newData[rowIndex], [colKey]: finalValue };
            setTableData(newData);
        }
        setEditingCell(null);
    };

    const cancelEdit = () => {
        setEditingCell(null);
    };

    return (
        <div className="fixed inset-0 bg-white z-[9999] flex flex-col w-full h-full overflow-hidden font-sans animate-in fade-in zoom-in-95 duration-200">
            {/* Top Header Bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 bg-white shadow-sm z-20">
                <div className="flex items-center gap-3">
                    <button
                        title="Go back"
                        onClick={() => setActiveFile(null)}
                        className="p-2 hover:bg-stone-100 rounded-md text-stone-500 transition-colors"
                    >
                        <X size={16} />
                    </button>
                    <div className="flex items-center gap-2 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md text-sm font-medium border border-emerald-100">
                        <Table size={14} className="text-emerald-500" />
                        <span>sales.csv</span>
                        <ChevronDown size={12} className="opacity-50" />
                    </div>

                    <div className="h-6 w-px bg-stone-200 mx-2"></div>

                    <div className="relative group">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 group-hover:text-stone-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Sort, filter, or ask anything..."
                            className="bg-stone-50 hover:bg-stone-100 transition-colors border-none rounded-lg py-1.5 pl-8 pr-16 text-sm w-80 text-stone-700 placeholder:text-stone-400 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            <span className="text-[10px] bg-white border border-stone-200 rounded px-1 text-stone-400 font-medium">/</span>
                            <span className="text-[10px] text-stone-400 font-medium">or</span>
                            <span className="text-[10px] bg-white border border-stone-200 rounded px-1 text-stone-400 font-medium">⌘K</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-medium text-stone-500">
                    <div className="flex items-center gap-2">
                        <span>10 rows</span>
                        <span>8 cols</span>
                    </div>
                    <button className="p-1.5 hover:bg-stone-100 rounded-md text-stone-400 hover:text-stone-600 transition-colors">
                        <Plus size={16} />
                    </button>
                </div>
            </div>

            {/* Formula/Selection Bar */}
            <div className="h-10 bg-white border-b border-stone-200 flex items-center px-4 z-20 relative">
                <div className="flex items-center gap-4 w-full">
                    {/* Formula Icon */}
                    <div className="w-6 h-6 flex items-center justify-center bg-stone-100 rounded text-stone-500">
                        <span className="text-xs font-serif italic font-bold">=</span>
                    </div>

                    {/* Selection Context & Value */}
                    {selectedCell ? (
                        <div className="flex items-center gap-3 text-sm flex-1">
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs font-medium border border-emerald-100/50">
                                <span className="font-bold">{selectedCell.colKey}</span>
                                <span className="text-emerald-400">@</span>
                                <span className="text-stone-500">row {selectedCell.rowId + 1}</span>
                            </div>
                            <div className="w-px h-4 bg-stone-200"></div>
                            <input
                                type="text"
                                className="flex-1 bg-transparent outline-none text-stone-800 placeholder:text-stone-400"
                                value={tableData.find(d => (d as any).id === selectedCell.rowId)?.[selectedCell.colKey] ?? ''}
                                aria-label="Formula bar"
                                onChange={(e) => {
                                    const val = e.target.value;
                                    const newData = [...tableData];
                                    const rowIndex = newData.findIndex(item => item.id === selectedCell.rowId);
                                    if (rowIndex !== -1) {
                                        // Basic type retention - if it was a number, try to keep it a number
                                        const originalValue = newData[rowIndex][selectedCell.colKey];
                                        let finalValue: string | number = val;
                                        if (typeof originalValue === 'number' && !isNaN(Number(val)) && val !== '') {
                                            finalValue = Number(val);
                                        }
                                        newData[rowIndex] = { ...newData[rowIndex], [selectedCell.colKey]: finalValue };
                                        setTableData(newData);
                                    }
                                }}
                            />
                        </div>
                    ) : (
                        <div className="flex-1 text-xs text-stone-400 italic">
                            Select a cell to view value...
                        </div>
                    )}

                    {/* Add Column Button */}
                    <div className="relative">
                        <button
                            className="w-8 h-8 flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 text-white rounded-md shadow-sm transition-colors"
                            onClick={() => setIsAddColumnOpen(!isAddColumnOpen)}
                        >
                            <Plus size={16} />
                        </button>

                        {/* Popover */}
                        {isAddColumnOpen && (
                            <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-xl border border-stone-100 p-3 z-50 animate-in fade-in zoom-in-95 duration-200">
                                <input
                                    type="text"
                                    placeholder="Column name"
                                    className="w-full bg-stone-50 border border-stone-200 rounded px-3 py-1.5 text-sm text-stone-700 placeholder:text-stone-400 outline-none focus:ring-2 focus:ring-emerald-500/20 mb-3"
                                    autoFocus
                                />
                                <div className="flex items-center justify-end gap-2 text-xs font-medium">
                                    <button
                                        className="px-2 py-1 text-stone-500 hover:text-stone-700 hover:bg-stone-50 rounded transition-colors"
                                        onClick={() => setIsAddColumnOpen(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="px-2 py-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                                        onClick={() => setIsAddColumnOpen(false)}
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-auto relative" onClick={() => setSelectedCell(null)}>
                <table className="w-full border-collapse text-sm text-left">
                    <thead className="text-xs text-stone-500 font-medium bg-stone-50 sticky top-0 z-10 border-b border-stone-200 shadow-sm">
                        <tr>
                            {/* Row ID Header */}
                            <th className="w-12 px-3 py-2 bg-stone-50 border-r border-stone-200 font-normal text-stone-400 sticky left-0 z-20">
                                #
                            </th>

                            {/* Column Headers */}
                            {[
                                { name: '_rowid_1', icon: Hash, type: 'number' },
                                { name: 'product', icon: CaseSensitive, type: 'text' },
                                { name: 'category', icon: CaseSensitive, type: 'text' },
                                { name: 'price', icon: Hash, type: 'number' },
                                { name: 'quantity', icon: Hash, type: 'number' },
                                { name: 'revenue', icon: Hash, type: 'number' },
                                { name: 'region', icon: CaseSensitive, type: 'text' }
                            ].map((col) => (
                                <th key={col.name} className="px-4 py-2 border-r border-stone-200 min-w-[150px] group cursor-pointer hover:bg-stone-100 transition-colors select-none">
                                    <div className="flex items-center gap-2">
                                        <col.icon size={14} className="text-stone-400 group-hover:text-stone-600" />
                                        <span>{col.name === '_rowid_1' ? '_rowid_1' : col.name}</span>
                                        {col.name === '_rowid_1' && <MoveDown size={10} className="ml-auto text-stone-400" />}
                                    </div>
                                </th>
                            ))}
                            <th className="w-10 px-2 py-2 border-l border-stone-200 text-center hover:bg-stone-100 cursor-pointer">
                                <Plus size={14} className="mx-auto text-stone-400" />
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 bg-white">
                        {tableData.map((row) => (
                            <tr key={row.id} className="group hover:bg-stone-50/50 transition-colors">
                                {/* Row Index */}
                                <td className="px-3 py-2 text-xs text-stone-400 bg-stone-50/30 border-r border-stone-100 sticky left-0 group-hover:bg-stone-100 font-mono text-center select-none">
                                    {(row as any).id + 1}
                                </td>

                                {/* Custom Data Cells */}
                                {[
                                    { key: 'id', val: (row as any).id, className: "text-blue-600 font-medium" },
                                    { key: 'product', val: (row as any).product, className: "text-stone-800 font-medium" },
                                    { key: 'category', val: (row as any).category, className: "text-stone-600" },
                                    { key: 'price', val: (row as any).price, displayVal: formatNumber((row as any).price), className: "text-blue-600 font-mono text-right" },
                                    { key: 'quantity', val: (row as any).quantity, displayVal: formatNumber((row as any).quantity), className: "text-blue-600 font-mono text-right" },
                                    { key: 'revenue', val: (row as any).revenue, displayVal: formatNumber((row as any).revenue), className: "text-blue-600 font-mono text-right" },
                                    { key: 'region', val: (row as any).region, className: "text-stone-600" }
                                ].map(({ key, val, displayVal, className }) => {
                                    const selected = isSelected((row as any).id, key);
                                    const editing = isEditing((row as any).id, key);

                                    return (
                                        <td
                                            key={key}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleCellClick((row as any).id, key);
                                            }}
                                            onDoubleClick={(e) => {
                                                e.stopPropagation();
                                                handleDoubleClick((row as any).id, key, val);
                                            }}
                                            className={`px-4 py-2 border-r border-stone-100 whitespace-nowrap cursor-default relative
                                                ${className}
                                                ${selected && !editing ? 'bg-emerald-50/50 cell-selected z-10' : ''}
                                                ${editing ? 'p-0 cell-editing' : ''}
                                            `}
                                            style={{}}
                                        >
                                            {editing ? (
                                                <input
                                                    type="text"
                                                    value={tempValue}
                                                    onChange={handleInputChange}
                                                    onKeyDown={(e) => handleInputKeyDown(e, (row as any).id, key)}
                                                    onBlur={() => {
                                                        if (!isSavedRef.current) {
                                                            saveEdit((row as any).id, key);
                                                        }
                                                    }}
                                                    autoFocus
                                                    aria-label={`Edit ${key}`}
                                                    className={`w-[calc(100%+2px)] h-[calc(100%+2px)] px-4 py-2 bg-white outline-none absolute inset-[-1px] text-stone-900 z-50 ${className}`}
                                                />
                                            ) : (
                                                displayVal !== undefined ? displayVal : val
                                            )}
                                        </td>
                                    );
                                })}
                                <td className="border-l border-stone-100"></td>
                            </tr>
                        ))}
                        {/* Empty Rows Filler */}
                        {Array.from({ length: Math.max(0, 15 - tableData.length) }).map((_, i) => (
                            <tr key={`empty-${i}`} className="h-9">
                                <td className="border-r border-stone-100 bg-stone-50/30 sticky left-0"></td>
                                <td className="border-r border-stone-100"></td>
                                <td className="border-r border-stone-100"></td>
                                <td className="border-r border-stone-100"></td>
                                <td className="border-r border-stone-100"></td>
                                <td className="border-r border-stone-100"></td>
                                <td className="border-r border-stone-100"></td>
                                <td className="border-r border-stone-100"></td>
                                <td className="border-l border-stone-100"></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer */}
            <div className="border-t border-stone-200 bg-white px-4 py-2 flex items-center justify-between text-xs text-stone-500 z-20">
                <div className="flex items-center gap-4">
                    <span>Showing 1-10 of 10 rows</span>
                    <div className="flex items-center gap-2 px-2 py-1 hover:bg-stone-50 rounded border border-transparent hover:border-stone-200 cursor-pointer transition-all">
                        <span>50 / page</span>
                        <ChevronDown size={12} />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-stone-50 rounded-md text-stone-600 transition-colors border border-transparent hover:border-stone-200">
                        <Pencil size={12} />
                        <span>Edit</span>
                    </button>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-stone-50 rounded-md text-stone-600 transition-colors border border-transparent hover:border-stone-200">
                        <span>Next</span>
                        <ArrowRight size={12} />
                    </button>
                    <div className="w-px h-4 bg-stone-200 mx-1"></div>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-stone-50 rounded-md text-stone-600 transition-colors border border-transparent hover:border-stone-200">
                        <Command size={12} />
                        <span>Copy</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
