/**
 * Generates a strict AI prompt for converting natural language to SQL.
 * 
 * Rules applied:
 * - Generate ONLY SQL
 * - No explanations
 * - No markdown
 * - Use provided table name
 * - Do not invent columns
 * - DuckDB compatible SQL
 */
export function createAIPrompt(userQuestion: string, schema: string): string {
    return `
You are a SQL expert.
Given this table schema:
${schema}

Convert the user request into a single valid DuckDB SQL query.
User request: "${userQuestion}"

IMPORTANT: Return ONLY the raw SQL. Do not use markdown formatting (no \`\`\`sql). Do not explain.
`.trim();
}

/**
 * Generates a prompt for the AI to provide insights based on query results.
 */
export function buildInsightPrompt({ sql, columns, rows, rowCount }: {
    sql: string,
    columns: { name: string, type: string }[],
    rows: any[],
    rowCount: number
}): string {
    const columnInfo = columns.map(c => `${c.name} (${c.type})`).join('\n');

    const sampleRowsJson = JSON.stringify(
        rows,
        (_, value) => (typeof value === 'bigint' ? value.toString() : value),
        2
    );

    return `
You are a data analyst.
Analyze the query result.
Provide concise insights (max 5 bullet points).
Focus on trends, comparisons, anomalies, and patterns.
Do NOT repeat raw numbers without context.
Do NOT explain SQL.
Do NOT use markdown.

SQL QUERY:
${sql}

ROW COUNT:
${rowCount}

COLUMNS:
${columnInfo}

SAMPLE ROWS:
${sampleRowsJson}

Return only insight bullet points.
`.trim();
}
