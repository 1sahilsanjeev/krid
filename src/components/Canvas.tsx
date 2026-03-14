import { useState, useRef, useEffect } from 'react';

import { Loader2, Minus, Plus, Triangle, LayoutGrid, MousePointer2 } from 'lucide-react';
import { useStore, type FileItem } from '../store/useStore';
import { useAppStore } from '../store';
import { loadFile } from '../data/loadFile';
import { getLastSessionFiles, restoreLastSessionFiles } from '../data/filePersistence';
import type { SessionFile } from '../data/filePersistence';
import { X } from 'lucide-react';
import { FileContextMenu } from './FileContextMenu';

// Helper to format file size
const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// Helper to truncate names
const truncateName = (name: string, limit: number = 8): string => {
    if (name.length <= limit) return name;
    return name.substring(0, limit) + '..';
};

// Reusable FileIcon Component
const FileIcon = ({
    file,
    isSelected,
    isDraggingThis,
    hideTip,
    showOnboardingTip,
    onClick,
    onDoubleClick,
    onMouseDown,
    onContextMenu
}: {
    file: any,
    isSelected: boolean,
    isDraggingThis?: boolean,
    hideTip?: boolean,
    showOnboardingTip?: boolean,
    onClick: (e: React.MouseEvent) => void,
    onDoubleClick?: (e: React.MouseEvent) => void,
    onMouseDown?: (e: React.MouseEvent) => void,
    onContextMenu?: (e: React.MouseEvent) => void
}) => {
    const [isHovered, setIsHovered] = useState(false);
    // Strip extension for display
    const displayName = file.name.replace(/\.[^/.]+$/, "");
    return (
        <div
            className={`flex flex-col items-center gap-1 w-14 cursor-pointer transition-transform hover:z-10 relative 
                ${!isDraggingThis ? 'hover:scale-105' : 'scale-105 z-20'}
            `}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onMouseDown={onMouseDown}
            onContextMenu={onContextMenu}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Hover/Selection Card Background */}
            <div className={`absolute top-[-6px] -inset-x-3 rounded-2xl transition-opacity -z-10 
                ${isSelected
                    ? (file.type === 'csv'
                        ? 'bg-[#ecfdf5] dark:bg-emerald-500/10 opacity-60 dark:opacity-40'
                        : (file.type === 'parquet'
                            ? 'bg-[#f5f3ff] dark:bg-purple-500/10 opacity-60 dark:opacity-40'
                            : (file.type === 'query'
                                ? 'bg-[#e0e7ff] dark:bg-indigo-500/10 opacity-60 dark:opacity-40'
                                : 'bg-[#fffbeb] dark:bg-amber-500/10 opacity-60 dark:opacity-40')))
                    : `bg-[#f4f4f5] dark:bg-white/5 ${isHovered ? 'opacity-50 dark:opacity-100' : 'opacity-0'}`
                }`}
                style={{ height: '110px' }}
            />

            <div className={`w-14 h-14 rounded-[18px] flex items-center justify-center relative transition-all duration-200 box-border
                ${isSelected
                    ? (file.type === 'csv'
                        ? 'bg-emerald-100 border-[3px] border-emerald-500 shadow-sm'
                        : (file.type === 'parquet'
                            ? 'bg-purple-100 border-[3px] border-purple-500 shadow-sm'
                            : (file.type === 'query'
                                ? 'bg-indigo-100 border-[3px] border-indigo-500 shadow-sm'
                                : 'bg-amber-100 border-[3px] border-amber-500 shadow-sm')))
                    : `${file.color} shadow-sm border border-white/40 dark:border-white/10 ring-1 ring-black/5 dark:ring-white/5`
                }
            `}>
                {file.type === 'csv' ? (
                    <div className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide absolute bottom-1 right-1 shadow-sm leading-none
                        ${isSelected
                            ? 'bg-emerald-500 text-white'
                            : 'bg-[#10b981] text-white border border-emerald-400/50'
                        }
                    `}>
                        csv
                    </div>
                ) : file.type === 'parquet' ? (
                    <div className={`px-1 py-0.5 rounded-full text-[10px] font-bold capitalize tracking-wide absolute bottom-1.5 left-1/2 -translate-x-1/2 shadow-sm leading-none whitespace-nowrap
                        ${isSelected
                            ? 'bg-purple-500 text-white'
                            : 'bg-purple-500 text-white border border-purple-400/50'
                        }
                    `}>
                        Parquet
                    </div>
                ) : file.type === 'query' ? (
                    <div className={`px-1 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide absolute bottom-1.5 left-1/2 -translate-x-1/2 shadow-sm leading-none whitespace-nowrap
                        ${isSelected
                            ? 'bg-indigo-500 text-white'
                            : 'bg-indigo-500 text-white border border-indigo-400/50'
                        }
                    `}>
                        sql
                    </div>
                ) : (
                    <div className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide absolute bottom-1 right-1 shadow-sm leading-none
                        ${isSelected
                            ? 'bg-amber-500 text-white'
                            : 'bg-amber-400 text-white border border-amber-400/50'
                        }
                    `}>
                        json
                    </div>
                )}
            </div>

            <div className="text-center z-0 relative mt-0 flex flex-col items-center pb-1.5">
                <div className="h-6 flex items-center justify-center">
                    <div className={`text-sm font-medium select-none leading-tight transition-all duration-200 w-fit whitespace-nowrap
                        ${isSelected
                            ? (file.type === 'csv'
                                ? 'bg-emerald-500 text-white px-3 py-1 rounded-full shadow-md text-xs'
                                : (file.type === 'parquet'
                                    ? 'bg-purple-500 text-white px-3 py-1 rounded-full shadow-md text-xs'
                                    : (file.type === 'query'
                                        ? 'bg-indigo-500 text-white px-3 py-1 rounded-full shadow-md text-xs'
                                        : 'bg-amber-500 text-white px-3 py-1 rounded-full shadow-md text-xs')))
                            : 'text-stone-700 dark:text-stone-400'
                        }
                    `}>
                        {truncateName(displayName)}
                    </div>
                </div>
                <div className={`text-[11px] text-stone-400 select-none pb-1 mt-0.5 ${isSelected ? 'opacity-80' : ''}`}>{file.rows}</div>

                {/* Double click text */}
                <div className={`text-[8px] text-stone-400 font-medium transition-opacity absolute top-full left-1/2 -translate-x-1/2 whitespace-nowrap -mt-1
                    ${isSelected || !isHovered || hideTip ? 'opacity-0' : 'opacity-100'}
                `}>
                    double-click to open
                </div>
            </div>
        </div>
    );
};

export default function Canvas() {
    const {
        isLoading,
        setCommandPaletteOpen,
        files,
        setFiles, // Add setFiles
        selectedId,
        setSelectedId,
        updateFilePosition,
        mergeFiles,
        removeFileFromFolder,
        resetFiles,
        rearrangeLayout,
        scale,
        setScale,
        offset,
        setOffset,
        loadSchema,
        appTheme,
        showOnboarding,
        nextOnboardingStep
    } = useStore();
    const [isPanning, setIsPanning] = useState(false);
    const { activeFile, setActiveFile, addFile } = useAppStore();

    const [logs, setLogs] = useState<string[]>([]);
    const addLog = (msg: string) => setLogs(prev => [...prev.slice(-4), msg]); // Keep last 5
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const [draggedFile, setDraggedFile] = useState<{ id: string | number; offsetX: number; offsetY: number; folderId?: string | number; initialX?: number; initialY?: number } | null>(null);
    const [dragOverId, setDragOverId] = useState<string | number | null>(null); // Track drop target
    const [openFolderId, setOpenFolderId] = useState<string | number | null>(null);
    const [isWidgetExpanded, setIsWidgetExpanded] = useState(false);
    const [sessionFiles, setSessionFiles] = useState<SessionFile[]>([]);
    const [showRestoreBanner, setShowRestoreBanner] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, file: any } | null>(null);
    const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const lastMousePos = useRef({ x: 0, y: 0 });
    const dragCounter = useRef(0);

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const s = Math.exp(-e.deltaY * 0.001);
            setScale(prev => Math.min(Math.max(0.1, prev * s), 5));
        } else {
            setOffset(prev => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        // Allow panning only if clicking on empty space (middle click or left click on background)
        if (e.button === 1 || e.button === 0) {
            setIsPanning(true);
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            setSelectedId(null); // Deselect when clicking canvas
            setOpenFolderId(null); // Close folder when clicking background
            setContextMenu(null); // Close context menu
        }
    };

    const handleFileMouseDown = (e: React.MouseEvent, file: typeof files[0]) => {
        e.stopPropagation(); // Prevent canvas panning
        setSelectedId(file.id);

        // Calculate mouse position in canvas coordinates
        const canvasMouseX = (e.clientX - offset.x) / scale;
        const canvasMouseY = (e.clientY - offset.y) / scale;

        setDraggedFile({
            id: file.id,
            offsetX: canvasMouseX - file.x,
            offsetY: canvasMouseY - file.y,
            initialX: file.x,
            initialY: file.y
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isPanning) {
            const dx = e.clientX - lastMousePos.current.x;
            const dy = e.clientY - lastMousePos.current.y;
            setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            lastMousePos.current = { x: e.clientX, y: e.clientY };
        } else if (draggedFile) {
            // Dragging a file
            const canvasMouseX = (e.clientX - offset.x) / scale;
            const canvasMouseY = (e.clientY - offset.y) / scale;

            const newX = canvasMouseX - draggedFile.offsetX;
            const newY = canvasMouseY - draggedFile.offsetY;

            // If dragging from a folder, only update position if moved significantly
            if (draggedFile.folderId) {
                const folder = files.find((f: typeof files[0]) => f.id === draggedFile.folderId);
                if (folder) {
                    const dx = newX - (draggedFile.initialX ?? folder.x);
                    const dy = newY - (draggedFile.initialY ?? folder.y);
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    // Only update position if dragged more than 20 pixels from folder
                    if (distance > 20) {
                        updateFilePosition(draggedFile.id, newX, newY);
                    }
                }
            } else {
                // Regular file, always update position
                updateFilePosition(draggedFile.id, newX, newY);
            }

            // Check for overlap
            let bestMatchId: string | number | null = null;
            const FILE_SIZE = 56; // w-14 = 56px
            const ITEM_AREA = FILE_SIZE * FILE_SIZE;

            // Current bounds of dragged file
            const r1 = { x: newX, y: newY, w: FILE_SIZE, h: FILE_SIZE };

            for (const file of files) {
                if (file.id === draggedFile.id) continue;

                const r2 = { x: file.x, y: file.y, w: FILE_SIZE, h: FILE_SIZE };

                // Calculate intersection
                const intersectX = Math.max(0, Math.min(r1.x + r1.w, r2.x + r2.w) - Math.max(r1.x, r2.x));
                const intersectY = Math.max(0, Math.min(r1.y + r1.h, r2.y + r2.h) - Math.max(r1.y, r2.y));
                const overlapArea = intersectX * intersectY;

                if (overlapArea / ITEM_AREA > 0.30) {
                    bestMatchId = file.id;
                    break; // Just take the first one for now
                }
            }
            setDragOverId(bestMatchId);
        }
    };

    const handleMouseUp = () => {
        if (draggedFile) {
            // If dragging from a folder and not dropping on another file
            if (draggedFile.folderId && !dragOverId) {
                // Get the current position of the dragged file
                const draggedFileData = (files.find(f => f.id === draggedFile.folderId)?.children || []).find((c: any) => c.id === draggedFile.id);
                if (draggedFileData) {
                    // Calculate distance moved to determine if it was actually dragged
                    const folder = files.find(f => f.id === draggedFile.folderId);
                    if (folder) {
                        // Calculate distance from folder start position
                        const dx = draggedFileData.x - (draggedFile.initialX ?? folder.x);
                        const dy = draggedFileData.y - (draggedFile.initialY ?? folder.y);
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        // Only remove from folder if dragged a meaningful distance (e.g., > 20 pixels)
                        if (distance > 20) {
                            removeFileFromFolder(draggedFile.folderId, draggedFile.id);
                        }
                    }
                }
            } else if (dragOverId) {
                // Merging files
                mergeFiles(draggedFile.id, dragOverId);
            }
        }
        setIsPanning(false);
        setDraggedFile(null);
        setDragOverId(null);
    };

    // Check for last session files on mount
    useEffect(() => {
        const lastSession = getLastSessionFiles();
        if (lastSession.length > 0) {
            // Collect ALL file table names including those inside folders
            const existingTableNames = new Set<string>();
            for (const f of files) {
                if (f.tableName) existingTableNames.add(f.tableName);
                if (f.type === 'folder' && f.children) {
                    for (const child of f.children) {
                        if (child.tableName) existingTableNames.add(child.tableName);
                    }
                }
            }
            const newFiles = lastSession.filter(f => !existingTableNames.has(f.tableName || f.name));
            if (newFiles.length > 0) {
                setSessionFiles(newFiles);
                setShowRestoreBanner(true);
            }
        }
    }, []);

    // Attach global mouse up listener just in case
    useEffect(() => {
        const handleGlobalMouseUp = () => {
            if (draggedFile && dragOverId) {
                // We can't easily access state here without refs or helpers, 
                // but typically the main handleMouseUp covers interaction within the div.
                // For safety if mouse leaves window, we might miss the drop.
                // For now, simple clear is safer than potentially creating folders with stale state.
            }
            setIsPanning(false);
            setDraggedFile(null);
            setDragOverId(null);
        };
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, [draggedFile, dragOverId]); // Add deps to ensure we capture latest if needed, though this resets logic.

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Tab') {
                e.preventDefault(); // Prevent focus leaving canvas context
                if (files.length === 0) return;

                const currentIndex = files.findIndex(f => f.id === selectedId);

                let nextIndex;
                if (e.shiftKey) {
                    // Previous (Shift + Tab)
                    nextIndex = currentIndex === -1 || currentIndex === 0
                        ? files.length - 1
                        : currentIndex - 1;
                } else {
                    // Next (Tab)
                    nextIndex = currentIndex === -1
                        ? 0
                        : (currentIndex + 1) % files.length;
                }

                setSelectedId(files[nextIndex].id);
            }

            if (selectedId && (e.key === 'Delete' || e.key === 'Backspace')) {
                handleDeleteFile(selectedId);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [files, selectedId]);

    const handleFileContextMenu = (e: React.MouseEvent, file: any) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            file
        });
        setSelectedId(file.id);
    };

    const handleRenameFile = async (id: string | number, newName: string) => {
        const file = files.find(f => String(f.id) === String(id));
        if (!file) return;

        if (newName && newName !== file.name) {
            await useStore.getState().renameFile(id, newName);
            // Also update app store name if it's a data file
            const appStore = useAppStore.getState();
            const appFile = appStore.files.find(f => f.name === file.name);
            if (appFile) {
                // If the renamed file is the active one, we should probably update state
                // but for now the store rename handles the database rename which is most important
            }
        }
    };

    const handleDeleteFile = (id: string | number) => {
        console.log("[Canvas] Handle Delete File Request:", { id, type: typeof id });
        
        // Use a recursive search to find the file even if it's in a folder
        const findRecursive = (items: FileItem[], targetId: string | number): FileItem | undefined => {
            for (const item of items) {
                if (String(item.id) === String(targetId)) return item;
                if (item.type === 'folder' && item.children) {
                    const found = findRecursive(item.children, targetId);
                    if (found) return found;
                }
            }
            return undefined;
        };

        const fileToDelete = findRecursive(files, id);
        if (!fileToDelete) {
            console.error("[Canvas] File to delete not found in tree:", id);
            return;
        }

        // Show custom confirmation modal instead of blocking window.confirm
        setDeleteConfirmationId(id);
    };

    const confirmDeletion = () => {
        if (!deleteConfirmationId) return;

        const findRecursive = (items: FileItem[], targetId: string | number): FileItem | undefined => {
            for (const item of items) {
                if (String(item.id) === String(targetId)) return item;
                if (item.type === 'folder' && item.children) {
                    const found = findRecursive(item.children, targetId);
                    if (found) return found;
                }
            }
            return undefined;
        };

        const fileToDelete = findRecursive(files, deleteConfirmationId);
        if (fileToDelete) {
            console.log("[Canvas] Executing deletion for:", fileToDelete.name);
            useStore.getState().removeFile(deleteConfirmationId);
            useAppStore.getState().removeFile({ name: fileToDelete.name, tableName: fileToDelete.tableName });
            setSelectedId(null);
            addLog(`Deleted ${fileToDelete.name}`);
            loadSchema();
        }
        setDeleteConfirmationId(null);
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current += 1;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDraggingOver(true);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Necessary to allow dropping
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current -= 1;
        if (dragCounter.current === 0) {
            setIsDraggingOver(false);
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
        dragCounter.current = 0;
        addLog("Drop event detected");

        const droppedFiles = Array.from(e.dataTransfer.files);
        if (droppedFiles.length === 0) {
            addLog("No files dropped");
            return;
        }

        for (const file of droppedFiles) {
            addLog(`Processing: ${file.name}`);
            const lowerName = file.name.toLowerCase();
            if (lowerName.endsWith('.csv') || lowerName.endsWith('.json') || lowerName.endsWith('.parquet')) {
                try {
                    addLog("Loading into DuckDB...");
                    const result = await loadFile(file);
                    addLog("DuckDB Load Success");

                    const isCsv = lowerName.endsWith('.csv');
                    const isParquet = lowerName.endsWith('.parquet');

                    let fileType: 'csv' | 'json' | 'parquet' = 'json';
                    if (isCsv) fileType = 'csv';
                    else if (isParquet) fileType = 'parquet';

                    // Generate ONE unique string ID to rule them both
                    const newFileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                    addFile({ 
                        id: newFileId,
                        name: result.tableName, 
                        tableName: result.tableName, 
                        type: fileType 
                    });
                    addLog("Added to Store");

                    // Add visual node to Canvas
                    let fileColor = 'bg-amber-100 text-amber-600';

                    if (fileType === 'csv') {
                        fileColor = 'bg-emerald-100 text-emerald-600';
                    } else if (fileType === 'parquet') {
                        fileColor = 'bg-purple-100 text-purple-600';
                    }

                    const newVisualFile: FileItem = {
                        id: newFileId,
                        name: result.tableName, 
                        tableName: result.tableName,
                        type: fileType,
                        rows: formatFileSize(file.size),
                        color: fileColor,
                        x: 200 + (Math.random() * 50),
                        y: 200 + (Math.random() * 50)
                    };

                    setFiles([...files, newVisualFile]);
                    addLog("Visual Node Created");
                    loadSchema(); // Refresh schema after upload

                } catch (error: any) {
                    console.error("Failed to load file:", error);
                    addLog(`Error: ${error.message}`);
                    alert(`Failed to load file ${file.name}: ${error.message}`);
                }
            } else {
                addLog("Ignored: Unsupported format");
                alert(`File ${file.name} is not supported. Only CSV, JSON, and Parquet files are supported.`);
            }
        }
    };

    // Fit to Screen Logic (Center Content at 100%)
    const handleFitToScreen = () => {
        if (files.length === 0) {
            setScale(1);
            setOffset({ x: 0, y: 0 });
            return;
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        files.forEach(file => {
            minX = Math.min(minX, file.x);
            minY = Math.min(minY, file.y);
            maxX = Math.max(maxX, file.x + 56);
            maxY = Math.max(maxY, file.y + 56);
        });

        const width = maxX - minX;
        const height = maxY - minY;
        const centerX = minX + width / 2;
        const centerY = minY + height / 2;

        const container = containerRef.current;
        if (!container) return;

        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        // Force scale to 1 (100%)
        const newScale = 1;

        // Calculate offset to center the content bounding box
        const newOffsetX = (containerWidth / 2) - (centerX * newScale);
        const newOffsetY = (containerHeight / 2) - (centerY * newScale);

        setScale(newScale);
        setOffset({ x: newOffsetX, y: newOffsetY });
    };

    return (
        <div
            ref={containerRef}
            className={`absolute inset-0 overflow-hidden cursor-default bg-[#faf9f5] dark:bg-[#111111] transition-colors duration-200 ${isPanning ? 'cursor-grabbing' : ''}`}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Grid Pattern */}
            <div
                className="absolute inset-0 pointer-events-none opacity-[0.4] dark:opacity-20 transition-opacity duration-200"
                style={{
                    backgroundImage: appTheme === 'dark' ? 'radial-gradient(#3f3f46 1px, transparent 1px)' : 'radial-gradient(#cbd5e1 1px, transparent 1px)',
                    backgroundSize: `${20 * scale}px ${20 * scale}px`,
                    backgroundPosition: `${offset.x}px ${offset.y}px`
                }}
            />

            {/* Upload Overlay */}
            {isDraggingOver && (
                <div className="absolute left-4 right-4 bottom-4 top-14 rounded-xl border-2 border-dashed border-blue-400 bg-blue-50/90 z-[100] flex flex-col items-center justify-center pointer-events-none animate-in fade-in duration-200">
                    <div className="flex flex-col items-center gap-4">
                        {/* Placeholder File Icon */}
                        <div className="w-16 h-20 bg-white border border-stone-200 rounded-lg shadow-sm flex items-center justify-center relative transform rotate-[-6deg]">
                            <div className="absolute top-0 right-0 w-4 h-4 bg-stone-100 border-b border-l border-stone-200 rounded-bl-lg"></div>
                            <div className="text-[6px] text-stone-400 font-mono mt-4">file</div>
                        </div>

                        <div className="text-blue-600 font-medium text-lg mt-2 select-none">Drop files to upload</div>
                    </div>
                </div>
            )}
            {/* Transformable Layer */}
            <div
                className="absolute origin-top-left w-full h-full"
                style={{
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`
                }}
            >

                {/* Files Rendering on Canvas */}
                {files.map((file) => {
                    const isSelected = selectedId === file.id;
                    const isDraggingThis = draggedFile?.id === file.id;
                    const isDragOverTarget = dragOverId === file.id;
                    const isFolder = file.type === 'folder'; // Visualize as folder ONLY if it is one

                    // If it's a drag target, we want to show the folder visual
                    // The content mimics the "folder forms" UI

                    if (isFolder) {
                        return (
                            <div
                                key={file.id}
                                className={`absolute group flex flex-col items-center w-14`}
                                style={{ left: file.x, top: file.y }}
                                onMouseDown={(e) => handleFileMouseDown(e, file)}
                                onContextMenu={(e) => handleFileContextMenu(e, file)}
                                onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    setOpenFolderId(openFolderId === file.id ? null : file.id);
                                }}
                            >
                                {/* Drag Over Target Visualization */}
                                {isDragOverTarget && (
                                    <>
                                        <div className="absolute left-1/2 -translate-x-1/2 w-[84px] h-[132px] -top-[20px] border-[2px] border-dashed border-indigo-400/60 bg-indigo-200/30 rounded-[18px] pointer-events-none z-0 animate-pulse"
                                            style={{ animationDuration: '2s' }}
                                        />
                                        <div className="absolute left-1/2 -translate-x-1/2 top-[114px] pointer-events-none z-20">
                                            <span className="text-[10px] text-indigo-400 font-medium tracking-wide whitespace-nowrap">
                                                drop to add
                                            </span>
                                        </div>
                                    </>
                                )}
                                {/* Selection/Hover Background */}
                                <div className={`absolute top-[-12px] bottom-0 -inset-x-3 rounded-2xl transition-opacity -z-10 
                                    ${openFolderId === file.id
                                        ? 'bg-[#e0e7ff] dark:bg-indigo-500/10 opacity-100 dark:opacity-40' // Open state (same as selected)
                                        : (isSelected
                                            ? 'bg-[#e0e7ff] dark:bg-indigo-500/10 opacity-100 dark:opacity-40' // Selected state (Blueish)
                                            : 'bg-[#f4f4f5] dark:bg-white/5 opacity-0 group-hover:opacity-50 dark:group-hover:opacity-100' // Hover state
                                        )
                                    }`}
                                />

                                {/* Expanded Folder Content */}
                                {openFolderId === file.id && (
                                    <div
                                        className={`absolute top-24 left-1/2 -translate-x-1/2 w-fit min-w-[12rem] rounded-[32px] px-6 py-5 z-50 cursor-default flex items-start justify-center transition-all
                                            ${isDragOverTarget
                                                ? 'bg-[#e0e7ff]/80 dark:bg-indigo-900/40'
                                                : 'bg-[#e0e7ff]/55 dark:bg-white/5'}`}
                                        style={{ height: '130px' }}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onDoubleClick={(e) => e.stopPropagation()}
                                        onMouseEnter={() => {
                                            // When dragging a file over the expanded folder shade, set it as drop target
                                            if (draggedFile && !draggedFile.folderId) {
                                                setDragOverId(file.id);
                                            }
                                        }}
                                        onMouseLeave={() => {
                                            // Clear drop target when leaving the shade
                                            if (dragOverId === file.id) {
                                                setDragOverId(null);
                                            }
                                        }}
                                    >
                                        <div className="flex flex-row flex-nowrap items-center justify-center gap-14">
                                            {file.children?.map(child => {
                                                const isDraggingThisChild = draggedFile?.id === child.id && draggedFile?.folderId === file.id;
                                                const draggedChildData = isDraggingThisChild ? files.find(f => f.id === file.id)?.children?.find(c => c.id === child.id) : null;
                                                const folder = files.find(f => f.id === file.id);
                                                let shouldHide = false;
 
                                                if (isDraggingThisChild && draggedChildData && folder) {
                                                    const dx = draggedChildData.x - (draggedFile?.initialX ?? folder.x);
                                                    const dy = draggedChildData.y - (draggedFile?.initialY ?? folder.y);
                                                    const distance = Math.sqrt(dx * dx + dy * dy);
                                                    shouldHide = distance > 20;
                                                }

                                                return (
                                                    <div key={child.id} className="group w-14 flex-shrink-0" style={{ opacity: shouldHide ? 0 : 1 }}>
                                                        <FileIcon
                                                            file={child}
                                                            isSelected={selectedId === child.id}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedId(child.id);
                                                            }}
                                                            onDoubleClick={(e) => {
                                                                e.stopPropagation();
                                                                setActiveFile(child.name);
                                                            }}
                                                            onMouseDown={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedId(child.id);

                                                                // Get the visual position of the element
                                                                const rect = e.currentTarget.getBoundingClientRect();
                                                                const visualX = (rect.left - offset.x) / scale;
                                                                const visualY = (rect.top - offset.y) / scale;

                                                                // Sync the file's position in store to match visual position
                                                                // This prevents jumping when drag starts
                                                                updateFilePosition(child.id, visualX, visualY);

                                                                // Calculate mouse position in canvas coordinates
                                                                const canvasMouseX = (e.clientX - offset.x) / scale;
                                                                const canvasMouseY = (e.clientY - offset.y) / scale;

                                                                setDraggedFile({
                                                                    id: child.id,
                                                                    offsetX: canvasMouseX - visualX,
                                                                    offsetY: canvasMouseY - visualY,
                                                                    folderId: file.id,
                                                                    initialX: visualX,
                                                                    initialY: visualY
                                                                });
                                                            }}
                                                            onContextMenu={(e) => handleFileContextMenu(e, child)}
                                                        />
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Folder Back/Tab visualization */}
                                <div className={`w-14 h-14 relative flex items-center justify-center transition-all duration-300 ${openFolderId === file.id ? 'scale-110' : ''}`}>
                                    {/* Folder Tab */}
                                    <div className="absolute top-0 left-1 w-6 h-3 bg-[#6366f1] rounded-t-md -mt-1.5 z-0"></div>
                                    {/* Folder Body */}
                                    <div className="absolute inset-0 bg-[#6366f1] rounded-2xl shadow-lg z-10 flex items-center justify-center border-t border-white/20">
                                    </div>
                                </div>

                                <div className="text-center z-0 relative mt-2 flex flex-col items-center pb-2">
                                    <div className={`text-sm font-medium select-none leading-tight transition-all duration-200 w-fit whitespace-nowrap
                                        ${openFolderId === file.id || isSelected || isDragOverTarget
                                            ? 'bg-[#6366f1] text-white px-3 py-1 rounded-full shadow-md text-xs'
                                            : 'text-stone-700 dark:text-stone-300'
                                        }
                                    `}>
                                        {isDragOverTarget ? 'Folder' : truncateName(file.name)}
                                    </div>

                                    {!openFolderId && !isDragOverTarget && (
                                        <div className={`text-[8px] text-stone-400 font-medium transition-opacity absolute top-full left-1/2 -translate-x-1/2 whitespace-nowrap mt-0.5
                                            ${isSelected ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}
                                        `}>
                                            double-click to open
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    }

                    return (
                        <div
                            key={file.id}
                            className="absolute group flex flex-col items-center justify-center"
                            style={{ left: file.x, top: file.y, width: 56, height: 56 }}
                            onMouseDown={(e) => handleFileMouseDown(e, file)}
                        >
                            {/* Merge Target Visualization */}
                            {dragOverId === file.id && (
                                <>
                                    {/* Dashed container - large enough for both icons */}
                                    <div className="absolute left-1/2 -translate-x-1/2 w-[84px] h-[132px] -top-[20px] border-[2px] border-dashed border-indigo-400/60 bg-indigo-200/30 rounded-[18px] pointer-events-none z-0 animate-pulse"
                                        style={{ animationDuration: '2s' }}
                                    />
                                    {/* Label below */}
                                    <div className="absolute left-1/2 -translate-x-1/2 top-[114px] pointer-events-none z-20">
                                        <span className="text-[10px] text-indigo-400 font-medium tracking-wide whitespace-nowrap">
                                            drop to create folder
                                        </span>
                                    </div>
                                </>
                            )}

                            <div className="relative z-10 w-full h-full">
                                <FileIcon
                                    file={file}
                                    isSelected={isSelected}
                                    isDraggingThis={isDraggingThis}
                                    hideTip={dragOverId === file.id}
                                    showOnboardingTip={showOnboarding && file.name === 'sales'}
                                    onClick={() => { }}
                                    onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        if (showOnboarding) {
                                            nextOnboardingStep();
                                        }
                                        setActiveFile(file.name);
                                    }}
                                    onContextMenu={(e) => handleFileContextMenu(e, file)}
                                />
                            </div>
                        </div>
                    );
                })}

                {/* Render dragged file from folder */}
                {draggedFile?.folderId && (() => {
                    const folder = files.find(f => f.id === draggedFile.folderId);
                    const draggedChild = folder?.children?.find(c => c.id === draggedFile.id);

                    if (draggedChild && folder && draggedFile.initialX !== undefined && draggedFile.initialY !== undefined) {
                        // Only show dragged visual if moved significantly from folder position
                        const dx = draggedChild.x - draggedFile.initialX;
                        const dy = draggedChild.y - draggedFile.initialY;
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        // Only render dragged file if it's been moved more than 20 pixels
                        if (distance > 20) {
                            return (
                                <div
                                    key={`dragged-${draggedChild.id}`}
                                    className="absolute group"
                                    style={{ left: draggedChild.x, top: draggedChild.y }}
                                >
                                    <FileIcon
                                        file={draggedChild}
                                        isSelected={selectedId === draggedChild.id}
                                        isDraggingThis={true}
                                        onClick={() => { }}
                                    />
                                </div>
                            );
                        }
                    }
                    return null;
                })()}

                {/* Center Content (Empty State) - Render only when no file is active and no user files are uploaded */}
                {!activeFile && files.filter(f => f.id !== 'sales' && f.id !== 'sample' && f.id !== 'api_logs').length === 0 && (
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center pointer-events-none w-full">
                        <div className="flex flex-col items-center gap-4 max-w-lg text-center mt-[-10vh]">
                            {/* Central Icon Ring */}
                            <div className="relative mb-2">
                                <div className="w-[60px] h-[60px] rounded-full border-[4px] border-slate-400/70 flex items-center justify-center bg-transparent">
                                    <div className="w-7 h-7 rounded-full border-[3px] border-slate-400/70"></div>
                                </div>
                                {isLoading && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 rounded-full">
                                        <Loader2 className="animate-spin text-slate-500" />
                                    </div>
                                )}
                            </div>

                            <h2 className="text-[20px] text-slate-600 dark:text-stone-300 font-normal tracking-tight mt-1">
                                Drop your files on the canvas to explore
                            </h2>

                            <p className="text-[14px] text-slate-400/80 dark:text-stone-400/80 font-normal mt-0.5">
                                CSV, JSON, Parquet - your files become visible
                            </p>

                            <p className="text-[12px] text-slate-300 dark:text-stone-500 font-normal mt-2">
                                Everything runs locally — Your data stays private
                            </p>

                            {/* Keyboard Shortcuts */}
                            <div className="flex items-center gap-8 mt-8 text-[12px] font-normal">
                                <div
                                    className="flex items-center gap-2 cursor-pointer pointer-events-auto hover:opacity-80 transition-opacity"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCommandPaletteOpen(true);
                                    }}
                                >
                                    <span className="text-slate-400 dark:text-stone-500">⌘K</span>
                                    <span className="select-none text-slate-400/80 dark:text-stone-600">Search</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-400 dark:text-stone-500">Tab</span>
                                    <span className="select-none text-slate-400/80 dark:text-stone-600">Navigate</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-400 dark:text-stone-500">Enter</span>
                                    <span className="select-none text-slate-400/80 dark:text-stone-600">Open</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Conditional Rendering of Tables REMOVED - Managed in App.tsx now */}
            </div>

            {/* Floating Zoom Controls (Bottom Right) - Fixed Position */}
            <div
                className={`fixed bottom-6 right-6 bg-white dark:bg-[#1a1a1a] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] dark:shadow-none border border-stone-200/60 dark:border-white/5 pointer-events-auto select-none transition-all duration-700 ease-in-out flex flex-col overflow-hidden w-80
                    ${isWidgetExpanded ? 'rounded-3xl px-2 py-1.5 gap-4 items-center' : 'rounded-2xl px-2 py-1.5 gap-2 items-center'}
                `}
                onMouseDown={(e) => e.stopPropagation()}
            >
                {/* Top Row (Controls) */}
                <div className="flex items-center justify-between w-full h-8">
                    <div className="flex items-center gap-2">
                        <button
                            className="w-8 h-8 flex items-center justify-center hover:bg-stone-50 dark:hover:bg-white/10 rounded-xl text-stone-500 dark:text-stone-400 transition-colors active:scale-95"
                            onClick={() => setScale(s => Math.max(0.1, s - 0.1))}
                            aria-label="Zoom Out"
                            title="Zoom Out"
                        >
                            <Minus size={16} strokeWidth={2} />
                        </button>

                        <span className="text-[13px] font-medium text-stone-600 dark:text-stone-300 min-w-[3rem] text-center font-mono tabular-nums">
                            {Math.round(scale * 100)}%
                        </span>

                        <button
                            className="w-8 h-8 flex items-center justify-center hover:bg-stone-50 dark:hover:bg-white/10 rounded-xl text-stone-500 dark:text-stone-400 transition-colors active:scale-95"
                            onClick={() => setScale(s => Math.min(5, s + 0.1))}
                            aria-label="Zoom In"
                            title="Zoom In"
                        >
                            <Plus size={16} strokeWidth={2} />
                        </button>
                    </div>

                    <div className="w-px h-5 bg-stone-200 dark:bg-white/10 mx-1"></div>

                    <div className="flex items-center gap-1">
                        {/* Reset View (Square with dot) */}
                        <button
                            className="w-8 h-8 flex items-center justify-center hover:bg-stone-50 dark:hover:bg-white/10 rounded-xl text-stone-500 dark:text-stone-400 transition-colors active:scale-95 group"
                            onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}
                            aria-label="Reset View (100%)"
                            title="Reset View (100%)"
                        >
                            <div className="w-3.5 h-3.5 border-[1.5px] border-current rounded-[3px] flex items-center justify-center">
                                <div className="w-0.5 h-0.5 bg-current rounded-full" />
                            </div>
                        </button>

                        {/* Fit to Screen (Concentric Circles) -> Keep visible but maybe hide if desired? Reference shows it. */}
                        <button
                            className="w-8 h-8 flex items-center justify-center hover:bg-stone-50 dark:hover:bg-white/10 rounded-xl text-stone-500 dark:text-stone-400 transition-colors active:scale-95"
                            title="Fit to Screen"
                            aria-label="Fit to Screen"
                            onClick={handleFitToScreen}
                        >
                            <div className="w-3.5 h-3.5 border-[1.5px] border-current rounded-full flex items-center justify-center">
                                <div className="w-1.5 h-1.5 border-[1.5px] border-current rounded-full" />
                            </div>
                        </button>

                        {/* Rearrange (Grid) */}
                        <button
                            className="w-8 h-8 flex items-center justify-center hover:bg-stone-50 dark:hover:bg-white/10 rounded-xl text-stone-500 dark:text-stone-400 transition-colors active:scale-95"
                            title="Rearrange Layout"
                            aria-label="Rearrange Layout"
                            onClick={() => { rearrangeLayout(); }}
                        >
                            <LayoutGrid size={16} strokeWidth={2} />
                        </button>

                        {/* Collapse / More (Triangle Up -> Down) */}
                        <button
                            className="w-6 h-8 flex items-center justify-center hover:bg-stone-50 dark:hover:bg-white/10 rounded-xl text-stone-400 dark:text-stone-500 transition-colors active:scale-95"
                            title={isWidgetExpanded ? "Collapse" : "More Options"}
                            onClick={() => setIsWidgetExpanded(!isWidgetExpanded)}
                        >
                            <Triangle size={8} fill="currentColor" className={`transition-transform duration-700 ${isWidgetExpanded ? 'rotate-180' : 'rotate-0'}`} />
                        </button>
                    </div>
                </div>

                {/* Expanded Content */}
                {isWidgetExpanded && (
                    <div className="flex flex-col gap-3 w-full animate-in fade-in slide-in-from-bottom-2 duration-700">
                        {/* Divider */}
                        <div className="h-[0.5px] bg-stone-100 dark:bg-white/10 w-full transition-colors" />

                        {/* Stats */}
                        <div className="flex items-center justify-between text-xs text-stone-500 font-medium px-1">
                            <span>{files.length} nodes</span>
                            <span>0 connections</span>
                        </div>

                        {/* Minimap Placeholder */}
                        <div className="bg-stone-50 dark:bg-black/20 rounded-xl border border-stone-100 dark:border-white/10 h-24 flex items-center justify-center text-xs text-stone-400 font-medium select-none transition-colors">
                            Minimap coming soon
                        </div>

                        {/* Actions List */}
                        <div className="flex flex-col gap-1 mt-1">

                            <button
                                className="flex items-center justify-between w-full px-2 py-1.5 hover:bg-stone-50 dark:hover:bg-white/5 rounded-lg text-xs font-medium text-stone-600 dark:text-stone-300 transition-colors text-left"
                                onClick={() => setCommandPaletteOpen(true)}
                            >
                                <span>Command palette</span>
                                <span className="flex items-center gap-0.5 text-stone-400 dark:text-stone-500">
                                    <span className="bg-stone-100 dark:bg-white/10 border border-stone-200 dark:border-white/10 rounded px-1 min-w-[18px] text-center h-[18px] flex items-center justify-center text-[10px] transition-colors">⌘K</span>
                                </span>
                            </button>
                            <button
                                className="flex items-center justify-between w-full px-2 py-1.5 hover:bg-stone-50 dark:hover:bg-white/5 rounded-lg text-xs font-medium text-stone-600 dark:text-stone-300 transition-colors text-left"
                                onClick={() => {
                                    if (selectedId) {
                                        // Trigger delete if selected
                                        // Need internal or store logic, for now just placeholder or key simulation
                                        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
                                    }
                                }}
                            >
                                <span>Delete selected</span>
                                <span className="flex items-center gap-0.5 text-stone-400 dark:text-stone-500">
                                    <span className="bg-stone-100 dark:bg-white/10 border border-stone-200 dark:border-white/10 rounded px-1 min-w-[18px] text-center h-[18px] flex items-center justify-center text-[10px] transition-colors">⌫</span>
                                </span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Online Status (Fixed) */}
            <div className="fixed bottom-6 right-2 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white shadow-sm z-30 pointer-events-none"></div>

            {/* Debug Logs Overlay */}
            <div className="hidden fixed top-20 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
                {logs.map((log, i) => (
                    <div key={i} className="bg-black/80 text-white px-3 py-1.5 rounded-md text-xs font-mono backdrop-blur-md shadow-lg animate-in fade-in slide-in-from-right-4">
                        {log}
                    </div>
                ))}
            </div>

            {/* Session Restore Banner */}
            {showRestoreBanner && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[50] animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white dark:bg-[#1c1c1c] rounded-[20px] shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.5)] border border-stone-100 dark:border-white/10 px-5 py-3.5 flex items-center gap-4 min-w-[320px]">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="text-xl">
                                📂
                            </div>
                            <span className="text-[14px] text-stone-700 dark:text-stone-200 font-medium whitespace-nowrap">
                                {sessionFiles.length} files from last session
                            </span>
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={async () => {
                                    addLog("Restoring session...");
                                    await restoreLastSessionFiles();

                                    // Generate visual nodes for the canvas matching the session files
                                    const newVisualNodes = sessionFiles.map((file, index) => {
                                        let fileColor = 'bg-stone-100 text-stone-600';
                                        if (file.type === 'csv') fileColor = 'bg-emerald-100 text-emerald-600';
                                        else if (file.type === 'parquet') fileColor = 'bg-purple-100 text-purple-600';
                                        else if (file.type === 'json') fileColor = 'bg-amber-100 text-amber-600';

                                        return {
                                            id: Date.now() + Math.random() + index,
                                            name: file.name,
                                            tableName: file.tableName || file.name,
                                            type: file.type as "csv" | "json" | "parquet" | "query" | "folder",
                                            rows: `${file.rows.toLocaleString()} rows`,
                                            color: fileColor,
                                            x: 200 + (index * 20),
                                            y: 150 + (index * 80)
                                        };
                                    });

                                    // Filter out any that might already exist visually
                                    const existingNames = new Set(files.map(f => f.name));
                                    const uniqueNewNodes = newVisualNodes.filter(n => !existingNames.has(n.name));

                                    if (uniqueNewNodes.length > 0) {
                                        setFiles([...files, ...uniqueNewNodes]);
                                    }

                                    setShowRestoreBanner(false);
                                    addLog("Session restored");
                                    loadSchema();
                                }}
                                className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white px-5 py-2 rounded-xl text-[14px] font-bold transition-all active:scale-95 shadow-sm"
                            >
                                Restore
                            </button>
                            <button
                                onClick={() => setShowRestoreBanner(false)}
                                className="text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors p-1"
                                title="Dismiss"
                            >
                                <X size={18} strokeWidth={2.5} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Context Menu Overlay */}
            {contextMenu && (
                <FileContextMenu
                    file={contextMenu.file}
                    position={{ x: contextMenu.x, y: contextMenu.y }}
                    onClose={() => setContextMenu(null)}
                    onOpen={(name) => setActiveFile(name)}
                    onRename={handleRenameFile}
                    onDelete={handleDeleteFile}
                />
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmationId && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-[#18181b] rounded-xl shadow-2xl border border-neutral-200 dark:border-white/10 w-full max-w-[320px] overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-5">
                            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-1.5">Delete File</h3>
                            <p className="text-[13px] leading-relaxed text-neutral-500 dark:text-neutral-400">
                                Are you sure you want to delete this file? This action cannot be undone.
                            </p>
                        </div>
                        <div className="bg-neutral-50 dark:bg-white/[0.02] p-3 px-5 flex justify-end gap-2">
                            <button
                                onClick={() => setDeleteConfirmationId(null)}
                                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDeletion}
                                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20 transition-all active:scale-95"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
