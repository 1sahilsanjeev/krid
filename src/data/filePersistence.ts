import { getDB } from './duckdb';
import { useAppStore } from '../store';

const DB_NAME = 'FilePersistenceDB';
const STORE_NAME = 'files';
const SESSION_STORAGE_KEY = 'krid_last_session_files';
const DB_VERSION = 1;

export const initPersistenceDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const saveFileToStorage = async (name: string, buffer: Uint8Array): Promise<void> => {
    const db = await initPersistenceDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(buffer, name);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const getFileFromStorage = async (name: string): Promise<Uint8Array | null> => {
    const db = await initPersistenceDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(name);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
};

export const deleteFileFromStorage = async (name: string): Promise<void> => {
    const db = await initPersistenceDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(name);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const renameFileInStorage = async (oldName: string, newName: string): Promise<void> => {
    const db = await initPersistenceDB();
    const buffer = await getFileFromStorage(oldName);
    if (!buffer) return;

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        const putRequest = store.put(buffer, newName);
        putRequest.onsuccess = () => {
            const deleteRequest = store.delete(oldName);
            deleteRequest.onsuccess = () => resolve();
            deleteRequest.onerror = () => reject(deleteRequest.error);
        };
        putRequest.onerror = () => reject(putRequest.error);
    });
};

export interface SessionFile {
    name: string;
    tableName: string; // Add stable tableName reference
    type: "csv" | "json" | "parquet" | string;
    rows: number;
    data: any[];
}

export const updateSessionPersistence = async (
    files: Array<{ name: string; tableName: string; type?: string }>
): Promise<void> => {
    try {
        const sessionFiles: SessionFile[] = [];
        const db = await getDB();
        const conn = await db.connect();

        for (const file of files) {
            try {
                // Get total row count
                const countRes = await conn.query(`SELECT COUNT(*) as count FROM "${file.tableName}"`);
                const rows = Number(countRes.toArray()[0].toJSON().count);

                // Get sample data (first 50 rows)
                const dataRes = await conn.query(`SELECT * FROM "${file.tableName}" LIMIT 50`);
                const data = dataRes.toArray().map(r => r.toJSON());

                sessionFiles.push({
                    name: file.name,
                    tableName: file.tableName,
                    type: file.type || "csv",
                    rows,
                    data
                });
            } catch (err) {
                console.warn(`Failed to extract preview for ${file.name} for session persistence`, err);
            }
        }

        await conn.close();

        // Save to localStorage
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionFiles));
        console.log(`Saved ${sessionFiles.length} files to session persistence.`);

    } catch (error) {
        console.error("Failed to update session persistence:", error);
    }
};

export const getLastSessionFiles = (): SessionFile[] => {
    try {
        const stored = localStorage.getItem(SESSION_STORAGE_KEY);
        if (!stored) {
            return [];
        }

        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
            return parsed as SessionFile[];
        }

        return [];
    } catch (error) {
        console.error("Failed to parse session files from localStorage:", error);
        return [];
    }
};

export const restoreLastSessionFiles = async (): Promise<void> => {
    try {
        const sessionFiles = getLastSessionFiles();
        if (sessionFiles.length === 0) return;

        const appStore = useAppStore.getState();
        const existingFiles = new Set(appStore.files.map(f => f.name));

        const db = await getDB();
        const conn = await db.connect();

        let restoredCount = 0;
        let lastRestoredFile = null;

        for (const file of sessionFiles) {
            // Avoid duplicating already loaded files
            if (existingFiles.has(file.name)) continue;

            const buffer = await getFileFromStorage(file.name);
            if (!buffer) {
                console.warn(`Buffer not found in IndexedDB for file: ${file.name}`);
                continue;
            }

            // Register buffer with DuckDB
            await db.registerFileBuffer(file.name, buffer);

            // Reconstruct table in DuckDB using the stable tableName
            let query = "";
            switch (file.type) {
                case 'csv':
                    query = `CREATE TABLE IF NOT EXISTS "${file.tableName}" AS SELECT * FROM read_csv_auto('${file.name}');`;
                    break;
                case 'json':
                    query = `CREATE TABLE IF NOT EXISTS "${file.tableName}" AS SELECT * FROM read_json_auto('${file.name}');`;
                    break;
                case 'parquet':
                    query = `CREATE TABLE IF NOT EXISTS "${file.tableName}" AS SELECT * FROM read_parquet('${file.name}');`;
                    break;
                default:
                    console.warn(`Unsupported file format restoring ${file.name}: ${file.type}`);
                    continue;
            }

            try {
                await conn.query(query);
                console.log(`[Restore] Successfully recreated table "${file.tableName}" from buffer "${file.name}"`);
            } catch (err) {
                console.error(`Failed to recreate table ${file.tableName} in DuckDB:`, err);
                continue;
            }

            // Add back to Zustand store (avoiding immediate auto-open to prevent UI flicker until end)
            appStore.addFile({
                name: file.name,
                tableName: file.tableName || file.name,
                type: file.type
            }, false);

            restoredCount++;
            lastRestoredFile = file.name;
        }

        await conn.close();

        // Trigger UI refresh and select the last restored file if none was active
        if (restoredCount > 0) {
            const currentActive = useAppStore.getState().activeFile;
            if (!currentActive && lastRestoredFile) {
                useAppStore.getState().setActiveFile(lastRestoredFile);
            }
        }

    } catch (error) {
        console.error("Error restoring session files:", error);
    }
};
