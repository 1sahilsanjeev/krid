import { parseFormula, addressToCoords, coordsToAddress } from './formulaParser';
import type { ASTNode } from './formulaParser';
import type { CellModel } from './tableUtils';

export interface GridContext {
    data: any[];
    grid: CellModel[][];
    columns: string[];
    stagedChanges: Record<string, { newValue: CellModel; oldValue: any }>;
    computedCache?: Record<string, EvaluationResult>;
}

export interface EvaluationResult {
    value: number | string | null;
    error: null | "CIRCULAR_REFERENCE" | "ERROR";
}


function evaluateNode(
    node: ASTNode,
    context: GridContext,
    callStack: Set<string>
): number {
    switch (node.type) {
        case "Literal":
            return node.value;

        case "CellReference": {
            const coords = addressToCoords(node.address);
            if (!coords) return 0;

            const { row: rowIdx, col: colIdx } = coords;
            if (
                rowIdx < 0 ||
                rowIdx >= context.grid.length ||
                colIdx < 0 ||
                colIdx >= context.columns.length
            ) {
                return 0;
            }

            const cellKey = `${rowIdx}_${colIdx}`;

            if (callStack.has(cellKey)) {
                throw new Error("CIRCULAR_REFERENCE");
            }

            callStack.add(cellKey);
            try {
                const cell = context.grid[rowIdx][colIdx];
                const { value, formula } = cell;
                const isFormula = formula !== null;

                let result: number;
                if (isFormula) {
                    const ast = parseFormula('=' + formula);
                    result = evaluateNode(ast, context, callStack);
                } else {
                    result = typeof value === "number" ? value : parseFloat(String(value));
                    if (isNaN(result)) result = 0;
                }
                return result;
            } finally {
                callStack.delete(cellKey);
            }
        }

        case "BinaryExpression": {
            const left = evaluateNode(node.left, context, callStack);
            const right = evaluateNode(node.right, context, callStack);
            switch (node.operator) {
                case "+":
                    return left + right;
                case "-":
                    return left - right;
                case "*":
                    return left * right;
                case "/":
                    // Spreadsheet standard: division by zero often returns an error,
                    // but here we return 0 or can throw dedicated Div0 if needed.
                    return right === 0 ? 0 : left / right;
                default:
                    return 0;
            }
        }

        case "FunctionCall": {
            if (node.name === "SUM") {
                let sum = 0;
                for (const arg of node.args) {
                    if (arg.type === "Range") {
                        const start = addressToCoords(arg.start.address);
                        const end = addressToCoords(arg.end.address);
                        if (!start || !end) continue;

                        const minRow = Math.min(start.row, end.row);
                        const maxRow = Math.max(start.row, end.row);
                        const minCol = Math.min(start.col, end.col);
                        const maxCol = Math.max(start.col, end.col);

                        for (let r = minRow; r <= maxRow; r++) {
                            for (let c = minCol; c <= maxCol; c++) {
                                const val = evaluateNode(
                                    { type: "CellReference", address: coordsToAddress(r, c) },
                                    context,
                                    callStack
                                );
                                if (!isNaN(val)) sum += val;
                            }
                        }
                    } else {
                        const val = evaluateNode(arg, context, callStack);
                        if (!isNaN(val)) sum += val;
                    }
                }
                return sum;
            }
            return 0;
        }

        case "Range": {
            return 0;
        }

        default:
            return 0;
    }
}

export function evaluateFormula(
    formula: string,
    context: GridContext
): EvaluationResult {
    try {
        const ast = parseFormula(formula);
        const value = evaluateNode(ast, context, new Set());
        return { value, error: null };
    } catch (err: any) {
        if (err.message === "CIRCULAR_REFERENCE") {
            return { value: "#CIRCULAR", error: "CIRCULAR_REFERENCE" };
        }
        console.error("Formula evaluation error:", err);
        return { value: "#ERROR", error: "ERROR" };
    }
}
