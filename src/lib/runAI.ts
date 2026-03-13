import { getAIKey } from '../utils/aiKeyStorage';
import { buildInsightPrompt } from './createAIPrompt';
import { extractSQL } from './extractSQL';

export async function explainResult(params: {
    sql: string,
    columns: { name: string, type: string }[],
    rows: any[],
    rowCount: number
}): Promise<string> {
    const key = getAIKey();
    if (!key) {
        throw new Error("NO_AI_KEY");
    }

    const prompt = buildInsightPrompt(params);

    try {
        console.log("Sending Insight request");
        const response = await fetch('/ai', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt,
                apiKey: key
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `Proxy Server Error: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("Insight response received", data);

        if (!data || typeof data !== 'object') {
            throw new Error("Invalid response format from server");
        }

        if (!data.text || typeof data.text !== 'string' || !data.text.trim()) {
            console.error("Empty or invalid AI response:", data);
            throw new Error("AI returned empty insights");
        }

        return data.text;
    } catch (error: any) {
        console.error("explainResult Error:", error);
        throw error;
    }
}

function formatFullSchema(schema: { tables: string[]; columns: Record<string, { name: string; type: string }[]> }): string {
    let output = "Tables:\n";
    schema.tables.forEach(table => {
        const columns = schema.columns[table] || [];
        const colList = columns.map(col => `  ${col.name} ${col.type}`).join(',\n');
        output += `${table} (\n${colList}\n)\n\n`;
    });
    return output;
}

export interface AIContext {
    previousSQL?: string | null;
    previousQuestion?: string | null;
    activeTable?: string | null;
}

export async function runAI(
    question: string,
    schema: { tables: string[]; columns: Record<string, { name: string; type: string }[]> },
    context?: AIContext
): Promise<string> {
    const key = getAIKey();
    if (!key) {
        throw new Error("NO_AI_KEY");
    }

    const formattedSchema = formatFullSchema(schema);

    // Hyper-strict instructions if active table is known
    let strictGrounding = "";
    if (context?.activeTable) {
        const activeCols = schema.columns[context.activeTable]?.map(c => c.name) || [];
        strictGrounding = `
- You MUST use ONLY this table: ${context.activeTable}
- Never reference any other table.
- Use ONLY the following columns for ${context.activeTable}:
  ${activeCols.join(", ")}
- If a column is not listed above, do NOT use it.`;
    }

    let contextNote = "";
    if (context?.previousSQL || context?.previousQuestion) {
        contextNote = `
You are continuing an analysis.
${context.previousSQL ? `PREVIOUS SQL: ${context.previousSQL}` : ""}
${context.previousQuestion ? `PREVIOUS QUESTION: ${context.previousQuestion}` : ""}
${context.activeTable ? `ACTIVE TABLE: ${context.activeTable}` : ""}

Stay grounded to the same table or context unless the new question explicitly asks for something else.`;
    }

    const systemPrompt = `You are a SQL assistant for DuckDB.
Only generate SQL using the provided schema.
Do NOT invent tables.
Do NOT invent columns.
You MUST use only the exact column names provided.
Do NOT rename columns.
Do NOT create variations like product_name.
If unsure, use the exact column from schema.
Return only valid SQL.${strictGrounding}
${contextNote}

DATABASE SCHEMA:
${formattedSchema}`;

    try {
        console.log("Sending AI request with context:", context);
        const response = await fetch('/ai', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                system: systemPrompt,
                prompt: `QUESTION: ${question}\n\nReturn ONLY the SQL query. No explanation.`,
                apiKey: key
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `Proxy Server Error: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("AI response received", data);

        if (!data || typeof data !== 'object') {
            throw new Error("Invalid response format from server");
        }

        const rawText = data.text || '';
        console.log("[AI RAW]", rawText);

        const cleanedSQL = extractSQL(rawText);
        if (cleanedSQL) console.log("[CLEANED]", cleanedSQL);

        if (!cleanedSQL) {
            console.error("FAILED TO EXTRACT SQL FROM AI RESPONSE.");
            console.error("RAW AI TEXT:", JSON.stringify(rawText));
            console.error("FULL API RESPONSE:", JSON.stringify(data, null, 2));
            throw new Error("AI did not return valid SQL. Try rephrasing.");
        }

        // 1. Identify potential column names (Heuristic)
        const allValidColumns = new Set<string>();
        Object.values(schema.columns).forEach(cols => {
            cols.forEach(c => allValidColumns.add(c.name.toLowerCase()));
        });

        const sqlKeywords = new Set(['SELECT', 'FROM', 'WHERE', 'GROUP', 'BY', 'ORDER', 'LIMIT', 'JOIN', 'ON', 'AS', 'AND', 'OR', 'IN', 'IS', 'NOT', 'NULL', 'WITH', 'HAVING', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'CAST', 'DESC', 'ASC', 'UNION', 'ALL', 'LIKE', 'BETWEEN', 'EXISTS']);
        const tokens = cleanedSQL.split(/[\s,()=;!<>+/*%"']+/);

        const referencedColumns: string[] = [];
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const upperToken = token.toUpperCase();
            if (!token || sqlKeywords.has(upperToken) || /^\d+$/.test(token)) continue;
            if (schema.tables.some(tbl => tbl.toLowerCase() === token.toLowerCase())) continue;
            if (i > 0 && tokens[i - 1].toUpperCase() === 'AS') continue;
            referencedColumns.push(token);
        }

        // 2. Surgical Column Auto-Correction
        let finalSQL = cleanedSQL;
        try {
            finalSQL = autoFixColumns(cleanedSQL, schema, context?.activeTable || undefined);
            if (finalSQL !== cleanedSQL) {
                console.log("[COLUMN FIXED]", finalSQL);
            }
        } catch (err: any) {
            console.error("COLUMN AUTO-CORRECTION FAILED:", err.message);
            throw err; // Propagate validation failures if repair is impossible
        }

        // 3. Enforce Active Table Scope
        if (context?.activeTable) {
            try {
                const prevEnforced = finalSQL;
                finalSQL = enforceActiveTable(finalSQL, context.activeTable);
                if (finalSQL !== prevEnforced) {
                    console.log("[TABLE ENFORCED]", finalSQL);
                }
            } catch (err: any) {
                console.error("TABLE ENFORCEMENT FAILED:", err.message);
                throw err;
            }
        }

        // 4. FINAL VALIDATION PASS (on finalSQL)
        if (context?.activeTable) {
            const activeCols = schema.columns[context.activeTable]?.map(c => c.name) || [];
            validateSQLSchema(finalSQL, context.activeTable, activeCols);
            console.log("[FINAL VALIDATED]", finalSQL);
        }

        return finalSQL;
    } catch (error: any) {
        console.error("runAI Error:", error);
        throw error;
    }
}

/**
 * Validates that the SQL targets the correct table and uses only authorized columns.
 */
export function validateSQLSchema(
    sql: string,
    activeTable: string,
    schemaCols: string[]
): void {
    const sqlKeywords = new Set(['SELECT', 'FROM', 'WHERE', 'GROUP', 'BY', 'ORDER', 'LIMIT', 'JOIN', 'ON', 'AS', 'AND', 'OR', 'IN', 'IS', 'NOT', 'NULL', 'WITH', 'HAVING', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'CAST', 'DESC', 'ASC', 'UNION', 'ALL', 'LIKE', 'BETWEEN', 'EXISTS']);

    // 1. Extract and Verify Table
    const fromRegex = /\bFROM\s+["']?([a-zA-Z0-9_]+)["']?/i;
    const match = sql.match(fromRegex);
    const referencedTable = match ? match[1].toLowerCase() : null;

    if (!referencedTable) {
        throw new Error("Invalid SQL: No FROM clause detected.");
    }
    if (referencedTable !== activeTable.toLowerCase()) {
        throw new Error(`Security Violation: SQL targets table "${referencedTable}" but active context is "${activeTable}".`);
    }

    // 2. Extract and Verify Columns
    const tokens = sql.split(/[\s,()=;!<>+/*%"']+/);
    const validCols = new Set(schemaCols.map(c => c.toLowerCase()));

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const upperToken = token.toUpperCase();

        if (!token || sqlKeywords.has(upperToken) || /^\d+$/.test(token)) continue;
        if (token.toLowerCase() === referencedTable) continue;
        if (i > 0 && tokens[i - 1].toUpperCase() === 'AS') continue;

        if (!validCols.has(token.toLowerCase())) {
            throw new Error(`Unauthorized Column: "${token}" is not part of the ${activeTable} schema.`);
        }
    }
}

/**
 * Surgically repairs invalid column names in the generated SQL.
 */
export function autoFixColumns(
    sql: string,
    schema: { tables: string[]; columns: Record<string, { name: string; type: string }[]> },
    activeTable?: string
): string {
    const sqlKeywords = new Set(['SELECT', 'FROM', 'WHERE', 'GROUP', 'BY', 'ORDER', 'LIMIT', 'JOIN', 'ON', 'AS', 'AND', 'OR', 'IN', 'IS', 'NOT', 'NULL', 'WITH', 'HAVING', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'CAST', 'DESC', 'ASC', 'UNION', 'ALL', 'LIKE', 'BETWEEN', 'EXISTS']);

    const allValidColumns = new Set<string>();
    Object.values(schema.columns).forEach(cols => cols.forEach(c => allValidColumns.add(c.name.toLowerCase())));

    const tokens = sql.split(/[\s,()=;!<>+/*%"']+/);
    const tableNames = new Set(schema.tables.map(t => t.toLowerCase()));

    // Find invalid columns (excluding keywords, tables, and aliases)
    const invalidColumns: string[] = [];
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const upperToken = token.toUpperCase();
        if (!token || sqlKeywords.has(upperToken) || /^\d+$/.test(token)) continue;
        if (tableNames.has(token.toLowerCase())) continue;
        if (i > 0 && tokens[i - 1].toUpperCase() === 'AS') continue;

        if (!allValidColumns.has(token.toLowerCase())) {
            invalidColumns.push(token);
        }
    }

    if (invalidColumns.length === 0) return sql;

    let repairedSQL = sql;
    const activeCols = activeTable ? new Set(schema.columns[activeTable]?.map(c => c.name.toLowerCase())) : null;

    for (const invalidCol of [...new Set(invalidColumns)]) {
        const lowerInvalid = invalidCol.toLowerCase();
        let bestMatch: string | null = null;
        let maxScore = 0;

        // Try to match against the active table's columns first for higher accuracy
        const candidates = activeCols || allValidColumns;

        for (const validCol of candidates) {
            let score = getSimilarity(lowerInvalid, validCol);
            if (lowerInvalid.startsWith(validCol) || validCol.startsWith(lowerInvalid)) score += 0.15;
            if (lowerInvalid.includes(validCol) || validCol.includes(lowerInvalid)) score += 0.1;

            if (score > maxScore) {
                maxScore = score;
                bestMatch = validCol;
            }
        }

        // If no high-confidence match in active table, fallback to global schema if we weren't already using it
        if ((!bestMatch || maxScore < 0.6) && activeCols) {
            for (const validCol of allValidColumns) {
                let score = getSimilarity(lowerInvalid, validCol);
                if (lowerInvalid.startsWith(validCol) || validCol.startsWith(lowerInvalid)) score += 0.15;
                if (lowerInvalid.includes(validCol) || validCol.includes(lowerInvalid)) score += 0.1;

                if (score > maxScore) {
                    maxScore = score;
                    bestMatch = validCol;
                }
            }
        }

        if (bestMatch && maxScore > 0.6) {
            console.log(`[AI SQL Auto-Fixed] ${invalidCol} → ${bestMatch} (Confidence: ${(maxScore * 100).toFixed(1)}%)`);
            // PROTECT: Ensure we don't accidentally replace a table name if it happens to be in a FROM clause
            // Use a regex that ignores content inside FROM ... [limit/where/etc]
            const replaceRegex = new RegExp(`(?<!FROM\\s+)\\b${invalidCol}\\b`, 'gi');
            repairedSQL = repairedSQL.replace(replaceRegex, bestMatch);
        } else {
            throw new Error(`AI generated invalid column name: ${invalidCol}`);
        }
    }

    return repairedSQL;
}

/**
 * Replaces any existing FROM clause with FROM ${activeTable}
 */
export function enforceActiveTable(sql: string, activeTable: string): string {
    const fromRegex = /\bFROM\s+["']?[a-zA-Z0-9_]+["']?/i;
    if (!fromRegex.test(sql)) {
        throw new Error("Invalid SQL: No FROM clause found to enforce table scope.");
    }
    return sql.replace(fromRegex, `FROM ${activeTable}`);
}

/**
 * String similarity using Levenshtein distance
 */
function getSimilarity(s1: string, s2: string): number {
    if (s1 === s2) return 1.0;
    const distance = levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    return 1.0 - distance / maxLength;
}

function levenshteinDistance(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,      // deletion
                dp[i][j - 1] + 1,      // insertion
                dp[i - 1][j - 1] + cost // substitution
            );
        }
    }
    return dp[m][n];
}
