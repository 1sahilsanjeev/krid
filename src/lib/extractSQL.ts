/**
 * Cleans and extracts the first SQL query from a text string.
 * 
 * Logic:
 * 1. Remove markdown code blocks (e.g., ```sql ... ```)
 * 2. Find the first SELECT or WITH query using case-insensitive RegEx
 * 3. Trim trailing semicolons or whitespace
 */
export function extractSQL(text: string): string {
    if (!text) return '';

    // 1. Strip markdown code blocks more robustly
    let cleaned = text.replace(/```sql(?:\s+)?/gi, '')
        .replace(/```(?:\s+)?/gi, '')
        .trim();

    // 2. Find the first SELECT or WITH block
    const sqlMatch = cleaned.match(/(?:SELECT|WITH)\b[\s\S]+/i);

    if (!sqlMatch) return '';

    let sql = sqlMatch[0].trim();

    // 3. Remove trailing semicolon if it exists
    if (sql.endsWith(';')) {
        sql = sql.slice(0, -1).trim();
    }

    // 4. Structural Validation: Must contain SELECT and FROM
    const upperSQL = sql.toUpperCase();
    if (!upperSQL.includes('SELECT') || !upperSQL.includes('FROM')) {
        return '';
    }

    return sql;
}
