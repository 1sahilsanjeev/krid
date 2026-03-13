import { useRef, useEffect, useState } from 'react';
import { CornerDownLeft, Pencil, X } from 'lucide-react';
import { useStore } from '../store/useStore';

interface FileContextMenuProps {
    file: {
        id: string | number;
        name: string;
        tableName: string;
        type: string;
        rows: string;
    };
    position: { x: number; y: number };
    onClose: () => void;
    onOpen: (name: string) => void;
    onRename: (id: string | number, name: string) => void;
    onDelete: (id: string | number) => void;
}

export const FileContextMenu = ({
    file,
    position,
    onClose,
    onOpen,
    onRename,
    onDelete
}: FileContextMenuProps) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { conn } = useStore();
    const [stats, setStats] = useState({ rows: 0, cols: 0 });
    const [isEditing, setIsEditing] = useState(false);
    const [tempName, setTempName] = useState(file.name);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            // Select only the name part if there's an extension
            const lastDotIndex = tempName.lastIndexOf('.');
            if (lastDotIndex !== -1) {
                inputRef.current.setSelectionRange(0, lastDotIndex);
            } else {
                inputRef.current.select();
            }
        }
    }, [isEditing]);

    useEffect(() => {
        const fetchStats = async () => {
            if (!conn || file.type === 'folder') return;
            try {
                const res = await conn.query(`
                    SELECT 
                        (SELECT COUNT(*) FROM "${file.tableName}") as row_count,
                        (SELECT COUNT(*) FROM (DESCRIBE "${file.tableName}")) as col_count
                `);
                const result = res.toArray()[0].toJSON();
                setStats({
                    rows: Number(result.row_count),
                    cols: Number(result.col_count)
                });
            } catch (err) {
                console.error("Failed to fetch menu stats:", err);
            }
        };
        fetchStats();
    }, [conn, file.tableName, file.type]);

    const handleSave = () => {
        if (tempName.trim() && tempName !== file.name) {
            onRename(file.id, tempName);
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            setTempName(file.name);
            setIsEditing(false);
        }
    };

    const fileTypeLabels: Record<string, string> = {
        csv: 'CSV Spreadsheet',
        json: 'JSON Data',
        parquet: 'Parquet File',
        query: 'SQL Query',
        folder: 'File Folder'
    };

    return (
        <div
            ref={menuRef}
            onMouseDown={(e) => e.stopPropagation()}
            className="fixed z-[1000] w-52 bg-white dark:bg-[#1c1c1c] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-stone-200/60 dark:border-white/10 overflow-hidden animate-in fade-in zoom-in duration-100"
            style={{ left: position.x, top: position.y }}
        >
            {/* Header */}
            <div className="px-3 py-2.5 border-b border-stone-100 dark:border-white/5">
                {isEditing ? (
                    <div className="flex flex-col gap-1">
                        <input
                            ref={inputRef}
                            type="text"
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={handleSave}
                            className="w-full bg-[#f0f7ff] dark:bg-indigo-500/10 border border-[#3b82f6] dark:border-indigo-400 rounded-lg px-2 py-0.5 text-[15px] font-semibold text-stone-800 dark:text-stone-100 outline-none shadow-[0_0_0_2px_rgba(59,130,246,0.1)] transition-all"
                        />
                    </div>
                ) : (
                    <div className="text-[15px] font-semibold text-stone-800 dark:text-stone-100 leading-tight">
                        {file.name}
                    </div>
                )}
                <div className="text-[12px] text-stone-400 dark:text-stone-500 font-medium mt-0.5">
                    {fileTypeLabels[file.type] || 'File'}
                </div>
            </div>

            {/* Stats */}
            <div className="px-3 py-2 border-b border-stone-100 dark:border-white/5 bg-stone-50/30 dark:bg-white/[0.02]">
                <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11.5px]">
                        <span className="text-stone-400 dark:text-stone-500">Size</span>
                        <span className="text-stone-600 dark:text-stone-300 font-medium">{file.rows}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11.5px]">
                        <span className="text-stone-400 dark:text-stone-500">Rows</span>
                        <span className="text-stone-600 dark:text-stone-300 font-medium">{stats.rows}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11.5px]">
                        <span className="text-stone-400 dark:text-stone-500">Columns</span>
                        <span className="text-stone-600 dark:text-stone-300 font-medium">{stats.cols}</span>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="p-1">
                <button
                    onClick={() => { onOpen(file.name); onClose(); }}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-stone-100 dark:hover:bg-white/5 transition-colors group"
                >
                    <div className="flex items-center gap-3">
                        <CornerDownLeft size={14} className="text-stone-400 group-hover:text-stone-600 dark:text-stone-500 dark:group-hover:text-stone-300" />
                        <span className="text-[13px] font-medium text-stone-700 dark:text-stone-300">Open</span>
                    </div>
                </button>
 
                <button
                    onClick={() => setIsEditing(true)}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-xl transition-colors group ${isEditing ? 'bg-indigo-50 dark:bg-indigo-500/10' : 'hover:bg-stone-100 dark:hover:bg-white/5'}`}
                >
                    <div className="flex items-center gap-3">
                        <Pencil size={14} className={`${isEditing ? 'text-indigo-500 dark:text-indigo-400' : 'text-stone-400 group-hover:text-stone-600 dark:text-stone-500 dark:group-hover:text-stone-300'}`} />
                        <span className={`text-[13px] font-medium ${isEditing ? 'text-indigo-600 dark:text-indigo-300' : 'text-stone-700 dark:text-stone-300'}`}>Rename</span>
                    </div>
                </button>
 
                <button
                    onClick={() => { onDelete(file.id); onClose(); }}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors group"
                >
                    <div className="flex items-center gap-3">
                        <X size={14} className="text-red-400 group-hover:text-red-500" />
                        <span className="text-[13px] font-medium text-red-500">Delete</span>
                    </div>
                </button>
            </div>
        </div>
    );
};
