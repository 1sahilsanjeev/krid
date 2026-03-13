import { getDB } from './duckdb';
import { saveFileToStorage } from './filePersistence';

export interface LoadedFile {
    tableName: string;
    fileName: string;
}

const getUniqueTableName = async (baseName: string, conn: any): Promise<string> => {
    let tableName = baseName;
    let counter = 1;

    // Get list of existing tables
    const res = await conn.query('SHOW TABLES');
    const existingTables = new Set(res.toArray().map((r: any) => r.toJSON().name));

    while (existingTables.has(tableName)) {
        tableName = `${baseName}_${counter}`;
        counter++;
    }
    return tableName;
};

export const loadFile = async (file: File): Promise<LoadedFile> => {
    try {
        const db = await getDB();
        const originalFileName = file.name;

        // Sanitize filename for DuckDB table name
        let sanitizedName = originalFileName.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_');
        if (!/^[a-zA-Z]/.test(sanitizedName)) {
            sanitizedName = 't_' + sanitizedName;
        }

        const buffer = new Uint8Array(await file.arrayBuffer());
        const conn = await db.connect();

        // Get a unique table name
        const tableName = await getUniqueTableName(sanitizedName, conn);

        // Persist to IndexedDB using the UNIQUE tableName as the key
        // This prevents collisions in storage for files with same names
        await saveFileToStorage(tableName, buffer);

        // Then register with DuckDB using the UNIQUE tableName
        await db.registerFileBuffer(tableName, buffer);

        // Determine file extension
        const extension = originalFileName.split('.').pop()?.toLowerCase();

        let query = "";
        switch (extension) {
            case 'csv':
                query = `CREATE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${tableName}');`;
                break;
            case 'json':
                query = `CREATE TABLE "${tableName}" AS SELECT * FROM read_json_auto('${tableName}');`;
                break;
            case 'parquet':
                query = `CREATE TABLE "${tableName}" AS SELECT * FROM read_parquet('${tableName}');`;
                break;
            default:
                await conn.close();
                throw new Error(`Unsupported file format: .${extension}`);
        }

        await conn.query(query);
        await conn.close();

        // We return the unique tableName as BOTH the tableName and fileName identifier
        // to ensure the app store and persistence layer stay in sync.
        return { tableName, fileName: tableName };

    } catch (error) {
        console.error("Error loading file:", error);
        throw error;
    }
};
