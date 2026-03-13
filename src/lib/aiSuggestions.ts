/**
 * Ranks columns based on common high-value query targets (e.g., revenue, category).
 */
export function rankColumns(columns: { name: string; type: string }[]): { numeric: string[], text: string[] } {
    const numericPriorities = ["revenue", "price", "amount", "quantity"];
    const textPriorities = ["category", "region", "type", "product"];

    const isNumeric = (type: string) =>
        ['INTEGER', 'FLOAT', 'DOUBLE', 'BIGINT', 'HUGEINT', 'SMALLINT', 'TINYINT', 'REAL', 'DECIMAL'].some(t =>
            type.toUpperCase().includes(t)
        );

    const isText = (type: string) =>
        ['VARCHAR', 'TEXT', 'STRING', 'CHAR'].some(t =>
            type.toUpperCase().includes(t)
        );

    const numeric = columns.filter(c => isNumeric(c.type)).map(c => c.name);
    const text = columns.filter(c => isText(c.type)).map(c => c.name);

    const rankedNumeric = [...numeric].sort((a, b) => {
        const aPri = numericPriorities.findIndex(p => a.toLowerCase() === p);
        const bPri = numericPriorities.findIndex(p => b.toLowerCase() === p);
        if (aPri !== -1 && bPri !== -1) return aPri - bPri;
        if (aPri !== -1) return -1;
        if (bPri !== -1) return 1;
        return 0;
    });

    const rankedText = [...text].sort((a, b) => {
        const aPri = textPriorities.findIndex(p => a.toLowerCase() === p);
        const bPri = textPriorities.findIndex(p => b.toLowerCase() === p);
        if (aPri !== -1 && bPri !== -1) return aPri - bPri;
        if (aPri !== -1) return -1;
        if (bPri !== -1) return 1;
        return 0;
    });

    return { numeric: rankedNumeric, text: rankedText };
}

/**
 * Generates deterministic suggestions based on strict table schema rules.
 * Prioritizes high-value columns like 'revenue' or 'category'.
 * 
 * Validations:
 * - Empty Schema: Returns [];
 * - Zero Rows: Only basic exploration;
 * - Single Col: No GROUP BY;
 */
export function generateTrySuggestions(
    tableName: string,
    columns: { name: string; type: string }[],
    rowCount: number = 1
): { text: string; isNumeric: boolean }[] {
    if (!columns || columns.length === 0) return [];

    // --- Hardcoded Presets for Default Tables ---
    if (tableName === 'sales') {
        return [
            { text: "Sort the data by price in ascending order", isNumeric: false },
            { text: "Calculate the total revenue for each category", isNumeric: true },
            { text: "Find the product with the highest quantity", isNumeric: false },
            { text: "Show the average price for each region", isNumeric: true }
        ];
    }

    if (tableName === 'sample') {
        return [
            { text: "List all users who have signed up in the last month", isNumeric: false },
            { text: "Calculate the average number of signups per country", isNumeric: true },
            { text: "Find the top 3 plans with the most active users", isNumeric: false },
            { text: "Identify any users with duplicate email addresses", isNumeric: false }
        ];
    }

    if (tableName === 'api_logs') {
        return [
            { text: "Find the top 3 endpoints with the highest average latency", isNumeric: true },
            { text: "List all distinct methods and the count of requests for each method", isNumeric: false },
            { text: "Show the requests with the highest latency in the last hour", isNumeric: true },
            { text: "Get the average latency for each status category", isNumeric: true }
        ];
    }

    const suggestions: { text: string; isNumeric: boolean }[] = [];
    const { numeric, text } = rankColumns(columns);

    // Rule 1: Always include "Show first 10 rows from <tableName>"
    // This is valid even if rowCount is 0 (it will just return empty result)
    suggestions.push({ text: `Show first 10 rows from ${tableName}`, isNumeric: false });

    // Stop additional suggestions if table has 0 rows (aggregations are less useful)
    if (rowCount === 0) return suggestions;

    // Rule 2: If numeric exists → suggest AVG, MAX
    if (numeric.length > 0) {
        suggestions.push({ text: `What is the average ${numeric[0]}?`, isNumeric: true });
        suggestions.push({ text: `Find the maximum value of ${numeric[0]}`, isNumeric: true });
    }

    // Rule 3: If numeric + text exist → suggest GROUP BY aggregation
    // Only if we have at least 2 columns to group by anything
    if (numeric.length > 0 && text.length > 0 && columns.length > 1) {
        suggestions.push({ text: `Calculate total ${numeric[0]} by ${text[0]}`, isNumeric: true });
    }

    // Rule 4: If text exists → suggest unique values
    if (text.length > 0) {
        suggestions.push({ text: `Show all unique values in the ${text[0]} column`, isNumeric: false });
    }

    return suggestions.slice(0, 5);
}

/**
 * @deprecated Use generateTrySuggestions for stricter deterministic rules.
 */
export function generateSuggestions(tableName: string, columns: { name: string; type: string }[]): string[] {
    return generateTrySuggestions(tableName, columns, 1).map(s => s.text);
}
