export interface CellModel {
    raw: string;            // user input
    value: any;             // computed/display value
    formula: string | null; // formula without "="
    dependencies: string[]; // cells this cell depends on
}

export function parseCellValue(raw: string): CellModel {
    const trimmed = raw.trim();

    if (trimmed.startsWith('=')) {
        return {
            raw,
            value: null, // To be computed
            formula: trimmed.slice(1),
            dependencies: [] // To be extracted
        };
    }

    // Attempt to parse as number if it's not empty and looks like a number
    const num = Number(trimmed);
    if (trimmed !== "" && !isNaN(num)) {
        return {
            raw,
            value: num,
            formula: null,
            dependencies: []
        };
    }

    return {
        raw,
        value: raw,
        formula: null,
        dependencies: []
    };
}
