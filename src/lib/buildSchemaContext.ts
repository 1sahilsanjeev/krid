import { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';

/**
 * Builds a formatted schema context string for a given table.
 * Executes PRAGMA table_info to get column names and types.
 */
export async function buildSchemaContext(conn: AsyncDuckDBConnection, activeTable: string): Promise<string> {
    if (!activeTable) return '';

    try {
        // Run PRAGMA table_info to get column metadata
        const result = await conn.query(`PRAGMA table_info('${activeTable}')`);
        const rows = result.toArray();

        let context = `Table: ${activeTable}\nColumns:\n`;

        rows.forEach((row: any) => {
            // row.name is column name, row.type is data type
            context += `${row.name} ${row.type}\n`;
        });

        return context.trim();
    } catch (error) {
        console.error('Error building schema context:', error);
        return `Table: ${activeTable}\n(Error fetching schema)`;
    }
}
