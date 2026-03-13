import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdb_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
    mvp: {
        mainModule: duckdb_wasm,
        mainWorker: mvp_worker,
    },
    eh: {
        mainModule: duckdb_eh,
        mainWorker: eh_worker,
    },
};

let dbInstance: duckdb.AsyncDuckDB | null = null;
let initPromise: Promise<duckdb.AsyncDuckDB> | null = null;

export const initDB = async (): Promise<duckdb.AsyncDuckDB> => {
    if (dbInstance) {
        return dbInstance;
    }

    if (initPromise) {
        return initPromise;
    }

    initPromise = (async () => {
        try {
            // Select a bundle based on browser checks
            const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);

            // Instantiate the asynchronous version of DuckDB-wasm
            const worker = new Worker(bundle.mainWorker!);
            const logger = new duckdb.ConsoleLogger();
            const db = new duckdb.AsyncDuckDB(logger, worker);

            await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

            dbInstance = db;
            return db;
        } catch (error) {
            initPromise = null; // Reset promise on failure so we can try again
            throw error;
        }
    })();

    return initPromise;
};

export const getDB = async (): Promise<duckdb.AsyncDuckDB> => {
    if (!dbInstance) {
        // If not initialized, we initialize it.
        // The requirements said "Initialize database only once", checking validity.
        // It implies singleton usage.
        return initDB();
    }
    return dbInstance;
};
