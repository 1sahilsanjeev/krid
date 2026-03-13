import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { deleteFileFromStorage, updateSessionPersistence, renameFileInStorage } from './data/filePersistence';

interface StoreState {
    activeFile: string | null;
    activeStats: { rowCount: number; colCount: number } | null;
    files: Array<{
        name: string;
        tableName: string;
        id?: string;
        fileName?: string;
        type?: string;
    }>;
    setActiveFile: (file: string | null) => void;
    setActiveStats: (stats: { rowCount: number; colCount: number } | null) => void;
    addFile: (file: {
        name: string;
        tableName: string;
        id?: string;
        fileName?: string;
        type?: string
    }, shouldOpen?: boolean) => void;
    removeFile: (params: { name: string; tableName: string }) => void;
    renameFile: (oldName: string, newName: string) => Promise<void>;
}

export const useAppStore = create<StoreState>()(
    persist(
        (set, get) => ({
            activeFile: null,
            activeStats: null,
            files: [], // Initialize with empty array as requested
            setActiveFile: (file) => set({ activeFile: file }),
            setActiveStats: (stats) => set({ activeStats: stats }),
            addFile: (file, shouldOpen = true) => set((state) => ({
                files: [...state.files, file],
                activeFile: shouldOpen ? file.name : state.activeFile
            })),
            removeFile: ({ name, tableName }: { name: string; tableName: string }) => set((state) => {
                console.log("[AppStore] removeFile request:", { name, tableName });
                deleteFileFromStorage(tableName).catch(console.error);
                return {
                    files: state.files.filter(f => f.name !== name && f.tableName !== tableName),
                    activeFile: (state.activeFile === name || state.activeFile === tableName) ? null : state.activeFile
                };
            }),
            renameFile: async (oldName, newName) => {
                console.log("[AppStore] renameFile request:", { oldName, newName });
                const files = get().files;
                const file = files.find(f => f.name === oldName || f.tableName === oldName);
                if (!file) {
                    console.error("[AppStore] renameFile: File not found for oldName:", oldName, "in files:", files.map(f => f.name));
                    return;
                }

                const isDefault = file.id === 'sales' || file.id === 'sample' || file.id === 'api_logs' || 
                                 file.tableName === 'sales' || file.tableName === 'sample' || file.tableName === 'api_logs';

                console.log("[AppStore] renameFile found match:", { file, isDefault });

                if (!isDefault) {
                    await renameFileInStorage(file.name, newName).catch(console.error);
                }

                set((state) => ({
                    files: state.files.map(f => (f.name === oldName || f.tableName === (file.tableName)) ? { 
                        ...f, 
                        name: newName, 
                        tableName: isDefault ? f.tableName : newName 
                    } : f),
                    activeFile: state.activeFile === oldName ? newName : state.activeFile
                }));
                console.log("[AppStore] renameFile: State update triggered");
            },
        }),
        {
            name: 'app-storage',
        }
    )
);

// Subscribe to state changes to update session persistence
useAppStore.subscribe(
    (state, prevState) => {
        if (state.files !== prevState.files) {
            updateSessionPersistence(state.files).catch(console.error);
        }
    }
);
