import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useStore } from '../store/useStore';
import { useAppStore } from '../store';
import {
    Moon,
    Settings,
    Plug,
    Maximize,
    ZoomIn,
    ZoomOut,
    Command as CommandIcon,
    ArrowUp,
    ArrowDown,
    CornerDownLeft,
    LayoutGrid,
    Braces,
    ArrowRight
} from 'lucide-react';

export default function CommandPalette() {
    const {
        isCommandPaletteOpen,
        setCommandPaletteOpen,
        files,
        setSelectedId,
        setScale,
        setOffset,
        setSettingsOpen,
        appTheme,
        setAppTheme
    } = useStore();
    const { setActiveFile } = useAppStore();
    const [activeTab, setActiveTab] = useState<'commands' | 'ai'>('commands');
    const [search, setSearch] = useState('');

    // Flatten all files including those inside folders into a single searchable list
    const allFiles = Array.from(new Map(
        files.flatMap(f =>
            f.type === 'folder' && f.children
                ? f.children
                : [f]
        ).map(f => [f.id, f])
    ).values());

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setCommandPaletteOpen(!isCommandPaletteOpen);
            }
        };

        const esc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setCommandPaletteOpen(false);
            }
        };

        document.addEventListener('keydown', down);
        document.addEventListener('keydown', esc);
        return () => {
            document.removeEventListener('keydown', down);
            document.removeEventListener('keydown', esc);
        };
    }, [isCommandPaletteOpen, setCommandPaletteOpen]);

    if (!isCommandPaletteOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/20 backdrop-blur-sm transition-opacity"
                onClick={() => setCommandPaletteOpen(false)}
            />

            {/* Modal */}
            <div className="relative w-full max-w-[640px] bg-white dark:bg-[#1a1a1a] dark:border dark:border-white/10 rounded-xl shadow-2xl dark:shadow-black/50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 ease-out transition-colors">
                <Command
                    className="w-full"
                    onKeyDown={(e) => {
                        if (e.key === 'Tab') {
                            e.preventDefault();
                            setActiveTab((prev) => (prev === 'commands' ? 'ai' : 'commands'));
                        }
                    }}
                >
                    <div className="flex items-center border-b-[0.5px] border-stone-100 dark:border-white/10 px-4 py-2.5">
                        <CommandIcon className="w-5 h-5 text-stone-400 dark:text-stone-500 mr-3" />
                        <Command.Input
                            autoFocus
                            placeholder="Search files and folders..."
                            value={search}
                            onValueChange={setSearch}
                            className="w-full text-lg text-stone-700 dark:text-stone-200 placeholder:text-stone-400 dark:placeholder:text-stone-600 outline-none bg-transparent"
                        />
                    </div>

                    {/* Tabs */}
                    <div className="flex items-center px-2 py-2 border-b-[0.5px] border-stone-50 dark:border-white/5 gap-1">
                        <button
                            onClick={() => setActiveTab('commands')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'commands' ? 'bg-stone-100 dark:bg-white/10 text-stone-900 dark:text-stone-200' : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'}`}
                        >
                            Commands
                        </button>
                        <button
                            onClick={() => setActiveTab('ai')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${activeTab === 'ai' ? 'bg-stone-100 dark:bg-white/10 text-stone-900 dark:text-stone-200' : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'}`}
                        >
                            AI
                        </button>
                        <div className="ml-auto text-xs text-stone-400 px-2">
                            Tab to switch
                        </div>
                    </div>

                    {activeTab === 'commands' ? (
                        <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden py-2 px-2 custom-scrollbar">
                            <Command.Empty className="py-6 text-center text-sm text-stone-500">
                                No results found.
                            </Command.Empty>

                            <Command.Group heading="General">
                                <Command.Item
                                    value="switch to dark mode theme light"
                                    onSelect={() => {
                                        setAppTheme(appTheme === 'dark' ? 'light' : 'dark');
                                        setCommandPaletteOpen(false);
                                    }}
                                    className="flex items-center gap-3 px-3 py-3 rounded-lg cursor-default select-none aria-selected:bg-stone-100 dark:aria-selected:bg-white/5 transition-colors group"
                                >
                                    <div className="w-8 h-8 flex items-center justify-center bg-[#ecfdf5] text-emerald-600 rounded-md">
                                        <Moon size={18} fill="currentColor" className="opacity-80" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-stone-700 dark:text-stone-200">
                                            Switch to {appTheme === 'dark' ? 'Light' : 'Dark'} Mode
                                        </span>
                                        <span className="text-xs text-stone-400 dark:text-stone-500">
                                            Currently: {appTheme === 'dark' ? 'dark' : 'light'} mode
                                        </span>
                                    </div>
                                </Command.Item>

                                <Command.Item
                                    value="settings configuration preferences"
                                    onSelect={() => {
                                        setSettingsOpen(true);
                                        setCommandPaletteOpen(false);
                                    }}
                                    className="flex items-center gap-3 px-3 py-3 rounded-lg cursor-default select-none aria-selected:bg-stone-100 dark:aria-selected:bg-white/5 transition-colors group"
                                >
                                    <div className="w-8 h-8 flex items-center justify-center bg-stone-100 text-stone-500 rounded-md">
                                        <Settings size={18} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-stone-700 dark:text-stone-200">Settings</span>
                                        <span className="text-xs text-stone-400 dark:text-stone-500">Theme, colors, and AI configuration</span>
                                    </div>
                                </Command.Item>
                            </Command.Group>

                            <Command.Group heading="Views">
                                <Command.Item
                                    value="zoom to fit reset view"
                                    onSelect={() => {
                                        setScale(1);
                                        setOffset({ x: 0, y: 0 });
                                        setCommandPaletteOpen(false);
                                    }}
                                    className="flex items-center gap-3 px-3 py-3 rounded-lg cursor-default select-none aria-selected:bg-stone-100 dark:aria-selected:bg-white/5 transition-colors group"
                                >
                                    <div className="w-8 h-8 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-md">
                                        <Maximize size={18} />
                                    </div>
                                    <div className="flex flex-col flex-1">
                                        <span className="text-sm font-medium text-stone-700 dark:text-stone-200">Zoom to Fit</span>
                                        <span className="text-xs text-stone-400 dark:text-stone-500">Fit all items on screen</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <kbd className="hidden group-aria-selected:inline-flex h-5 items-center gap-1 rounded border bg-white px-1.5 font-mono text-[10px] font-medium text-stone-500 opacity-100 shadow-sm">
                                            <span className="text-xs">⌘</span>0
                                        </kbd>
                                    </div>
                                </Command.Item>
                            </Command.Group>

                            {allFiles.length > 0 && (
                                <Command.Group heading="Files">
                                    {allFiles.map((file) => (
                                        <Command.Item
                                            key={file.id || file.name}
                                            value={`${file.name} ${file.id}`}
                                            onSelect={() => {
                                                if (file.id) setSelectedId(Number(file.id));
                                                setActiveFile(file.name);
                                                setCommandPaletteOpen(false);
                                            }}
                                            className="flex items-center gap-3 px-3 py-3 rounded-lg cursor-default select-none aria-selected:bg-stone-100 dark:aria-selected:bg-white/5 transition-colors group"
                                        >
                                            <div className={`w-8 h-8 flex items-center justify-center rounded-md ${file.type === 'csv' ? 'bg-blue-50 text-blue-600' : 'bg-blue-50 text-blue-600'}`}>
                                                {file.type === 'csv' ? <LayoutGrid size={18} /> : <Braces size={18} />}
                                            </div>
                                            <div className="flex flex-col flex-1">
                                                <span className="text-sm font-medium text-stone-700 dark:text-stone-200">{file.name}{file.type ? `.${file.type}` : ''}</span>
                                                <span className="text-xs text-stone-400 dark:text-stone-500">{file.type?.toUpperCase() || 'FILE'}</span>
                                            </div>
                                            <div className="flex items-center">
                                                <ArrowRight size={14} className="text-stone-400 opacity-0 group-aria-selected:opacity-100 transition-opacity" />
                                            </div>
                                        </Command.Item>
                                    ))}
                                </Command.Group>
                            )}
                        </Command.List>
                    ) : (
                        <div className="max-h-[300px] overflow-y-auto px-4 py-3 custom-scrollbar">
                            <h3 className="text-stone-500 font-medium text-xs mb-2 px-1">Ask me anything about your files:</h3>
                            <div className="space-y-1">
                                {(() => {
                                    const baseQueries = ['What files do I have?', 'How can I filter my data?'];
                                    const fileSpecific = files.slice(0, 2).map(f => `Analyze the ${f.name} data`);
                                    return [...baseQueries, ...fileSpecific].map((query, i) => (
                                        <div key={i} className="flex items-center px-4 py-2 rounded-lg cursor-pointer hover:bg-stone-50/80 dark:hover:bg-white/5 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 transition-colors group">
                                            <span className="text-sm font-medium">"{query}"</span>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-stone-50 dark:bg-[#141414] border-t-[0.5px] border-stone-100 dark:border-white/10 text-xs text-stone-400 dark:text-stone-500 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                                <div className="flex items-center gap-0.5">
                                    <ArrowUp size={12} />
                                    <ArrowDown size={12} />
                                </div>
                                <span>Navigate</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <CornerDownLeft size={12} />
                                <span>Select</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="font-mono bg-stone-100 dark:bg-white/10 px-1 rounded text-[10px] uppercase">esc</span>
                                <span>Close</span>
                            </div>
                        </div>
                    </div>
                </Command>
            </div>
        </div>
    );
}
