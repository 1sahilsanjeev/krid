export type VizType = 'number' | 'category' | 'date' | 'boolean' | 'unsupported';

/**
 * Maps DuckDB column types to a simplified visualization type.
 */
export function getColumnVizType(columnType: string): VizType {
    const type = columnType.toUpperCase();

    // Numeric types
    if ([
        'TINYINT', 'SMALLINT', 'INTEGER', 'BIGINT', 'HUGEINT',
        'UTINYINT', 'USMALLINT', 'UINTEGER', 'UBIGINT',
        'FLOAT', 'DOUBLE', 'DECIMAL', 'REAL'
    ].some(t => type.includes(t))) {
        return 'number';
    }

    // Date/Time types
    if ([
        'DATE', 'TIMESTAMP', 'TIME', 'INTERVAL'
    ].some(t => type.includes(t))) {
        return 'date';
    }

    // Boolean
    if (type === 'BOOLEAN') {
        return 'boolean';
    }

    // Categorical/String types
    if ([
        'VARCHAR', 'TEXT', 'CHAR', 'ENUM'
    ].some(t => type.includes(t))) {
        return 'category';
    }

    return 'unsupported';
}

/**
 * Builds a SQL query to fetch data for visualization based on the column type.
 */
export function buildChartQuery(tableName: string, columnName: string, columnType: string): string {
    const vizType = getColumnVizType(columnType);
    const escapedCol = `"${columnName}"`;
    const escapedTable = `"${tableName}"`;

    switch (vizType) {
        case 'number':
            // Simple histogram with 20 bins
            return `
                WITH stats AS (
                    SELECT MIN(${escapedCol}) as min_val, MAX(${escapedCol}) as max_val 
                    FROM ${escapedTable}
                )
                SELECT 
                    CASE 
                        WHEN max_val = min_val THEN 0
                        ELSE floor(19 * (CAST(${escapedCol} AS DOUBLE) - min_val) / NULLIF(max_val - min_val, 0))
                    END as bin,
                    COUNT(*) as count
                FROM ${escapedTable}, stats
                WHERE ${escapedCol} IS NOT NULL
                GROUP BY 1
                ORDER BY 1;
            `.trim();

        case 'category':
            // Top 10 categories
            return `
                SELECT ${escapedCol} as label, COUNT(*) as count
                FROM ${escapedTable}
                WHERE ${escapedCol} IS NOT NULL
                GROUP BY 1
                ORDER BY 2 DESC
                LIMIT 10;
            `.trim();

        case 'date':
            // Time series grouped by day (or most granular common denominator)
            return `
                SELECT date_trunc('day', ${escapedCol}) as label, COUNT(*) as count
                FROM ${escapedTable}
                WHERE ${escapedCol} IS NOT NULL
                GROUP BY 1
                ORDER BY 1;
            `.trim();

        case 'boolean':
            // Simple true/false split
            return `
                SELECT ${escapedCol}::VARCHAR as label, COUNT(*) as count
                FROM ${escapedTable}
                WHERE ${escapedCol} IS NOT NULL
                GROUP BY 1;
            `.trim();

        default:
            // Fallback for unsupported - just count total vs null
            return `
                SELECT 
                    CASE WHEN ${escapedCol} IS NULL THEN 'Null' ELSE 'Not Null' END as label,
                    COUNT(*) as count
                FROM ${escapedTable}
                GROUP BY 1;
            `.trim();
    }
}
