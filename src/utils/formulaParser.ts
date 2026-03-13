export type ASTNode =
    | LiteralNode
    | CellReferenceNode
    | RangeNode
    | BinaryExpressionNode
    | FunctionCallNode;

export interface LiteralNode {
    type: "Literal";
    value: number;
}

export interface CellReferenceNode {
    type: "CellReference";
    address: string;
}

export interface RangeNode {
    type: "Range";
    start: CellReferenceNode;
    end: CellReferenceNode;
}

export interface BinaryExpressionNode {
    type: "BinaryExpression";
    operator: string;
    left: ASTNode;
    right: ASTNode;
}

export interface FunctionCallNode {
    type: "FunctionCall";
    name: string;
    args: ASTNode[];
}

type TokenType =
    | "NUMBER"
    | "IDENTIFIER"
    | "PLUS"
    | "MINUS"
    | "STAR"
    | "SLASH"
    | "LPAREN"
    | "RPAREN"
    | "COLON"
    | "COMMA"
    | "EOF";

interface Token {
    type: TokenType;
    value: string;
}

class Lexer {
    private input: string;
    private pos: number = 0;

    constructor(input: string) {
        this.input = input;
    }

    tokenize(): Token[] {
        const tokens: Token[] = [];
        while (this.pos < this.input.length) {
            const char = this.input[this.pos];

            if (/\s/.test(char)) {
                this.pos++;
                continue;
            }

            if (/[0-9]/.test(char)) {
                let value = "";
                while (this.pos < this.input.length && /[0-9.]/.test(this.input[this.pos])) {
                    value += this.input[this.pos++];
                }
                tokens.push({ type: "NUMBER", value });
                continue;
            }

            if (/[A-Za-z]/.test(char)) {
                let value = "";
                while (this.pos < this.input.length && /[A-Za-z0-9]/.test(this.input[this.pos])) {
                    value += this.input[this.pos++];
                }
                tokens.push({ type: "IDENTIFIER", value: value.toUpperCase() });
                continue;
            }

            switch (char) {
                case "+": tokens.push({ type: "PLUS", value: "+" }); break;
                case "-": tokens.push({ type: "MINUS", value: "-" }); break;
                case "*": tokens.push({ type: "STAR", value: "*" }); break;
                case "/": tokens.push({ type: "SLASH", value: "/" }); break;
                case "(": tokens.push({ type: "LPAREN", value: "(" }); break;
                case ")": tokens.push({ type: "RPAREN", value: ")" }); break;
                case ":": tokens.push({ type: "COLON", value: ":" }); break;
                case ",": tokens.push({ type: "COMMA", value: "," }); break;
                default: throw new Error(`Unexpected character: ${char}`);
            }
            this.pos++;
        }
        tokens.push({ type: "EOF", value: "" });
        return tokens;
    }
}

export class FormulaParser {
    private tokens: Token[];
    private current: number = 0;

    constructor(formula: string) {
        const raw = formula.startsWith("=") ? formula.substring(1) : formula;
        this.tokens = new Lexer(raw).tokenize();
    }

    parse(): ASTNode {
        return this.expression();
    }

    private expression(): ASTNode {
        let node = this.term();

        while (this.match("PLUS", "MINUS")) {
            const operator = this.previous().value;
            const right = this.term();
            node = {
                type: "BinaryExpression",
                operator,
                left: node,
                right,
            };
        }

        return node;
    }

    private term(): ASTNode {
        let node = this.factor();

        while (this.match("STAR", "SLASH")) {
            const operator = this.previous().value;
            const right = this.factor();
            node = {
                type: "BinaryExpression",
                operator,
                left: node,
                right,
            };
        }

        return node;
    }

    private factor(): ASTNode {
        if (this.match("NUMBER")) {
            return { type: "Literal", value: parseFloat(this.previous().value) };
        }

        if (this.match("LPAREN")) {
            const node = this.expression();
            this.consume("RPAREN", "Expect ')' after expression.");
            return node;
        }

        if (this.match("IDENTIFIER")) {
            const name = this.previous().value;

            // Function Call
            if (this.match("LPAREN")) {
                const args: ASTNode[] = [];
                if (!this.check("RPAREN")) {
                    do {
                        args.push(this.expression());
                    } while (this.match("COMMA"));
                }
                this.consume("RPAREN", "Expect ')' after arguments.");
                return { type: "FunctionCall", name, args };
            }

            // Range or Cell Reference
            const cellRef: CellReferenceNode = { type: "CellReference", address: name };

            if (this.match("COLON")) {
                this.consume("IDENTIFIER", "Expect cell reference after ':'.");
                const endRef: CellReferenceNode = { type: "CellReference", address: this.previous().value };
                return { type: "Range", start: cellRef, end: endRef };
            }

            return cellRef;
        }

        throw new Error(`Unexpected token: ${this.peek().type}`);
    }

    private match(...types: TokenType[]): boolean {
        for (const type of types) {
            if (this.check(type)) {
                this.advance();
                return true;
            }
        }
        return false;
    }

    private advance(): Token {
        if (!this.isAtEnd()) this.current++;
        return this.previous();
    }

    private check(type: TokenType): boolean {
        if (this.isAtEnd()) return false;
        return this.peek().type === type;
    }

    private isAtEnd(): boolean {
        return this.peek().type === "EOF";
    }

    private peek(): Token {
        return this.tokens[this.current];
    }

    private previous(): Token {
        return this.tokens[this.current - 1];
    }

    private consume(type: TokenType, message: string): Token {
        if (this.check(type)) return this.advance();
        throw new Error(message);
    }
}

export function parseFormula(formula: string): ASTNode {
    return new FormulaParser(formula).parse();
}

export function addressToCoords(address: string): { row: number; col: number } | null {
    const match = address.match(/^([A-Z]+)([0-9]+)$/i);
    if (!match) return null;

    const colStr = match[1].toUpperCase();
    const rowStr = match[2];

    let col = 0;
    for (let i = 0; i < colStr.length; i++) {
        col = col * 26 + (colStr.charCodeAt(i) - 64);
    }

    return {
        row: parseInt(rowStr, 10) - 1,
        col: col - 1,
    };
}

export function coordsToAddress(row: number, col: number): string {
    let colStr = "";
    let temp = col + 1;
    while (temp > 0) {
        let remainder = (temp - 1) % 26;
        colStr = String.fromCharCode(65 + remainder) + colStr;
        temp = Math.floor((temp - remainder) / 26);
    }
    return `${colStr}${row + 1}`;
}

export function expandRange(start: string, end: string): string[] {
    const s = addressToCoords(start);
    const e = addressToCoords(end);
    if (!s || !e) return [];

    const minRow = Math.min(s.row, e.row);
    const maxRow = Math.max(s.row, e.row);
    const minCol = Math.min(s.col, e.col);
    const maxCol = Math.max(s.col, e.col);

    const results: string[] = [];
    for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
            results.push(coordsToAddress(r, c));
        }
    }
    return results;
}

export function extractReferencesFromAST(node: ASTNode): string[] {
    const refs = new Set<string>();

    function traverse(n: ASTNode) {
        if (n.type === "CellReference") {
            refs.add(n.address);
        } else if (n.type === "Range") {
            const expanded = expandRange(n.start.address, n.end.address);
            expanded.forEach(r => refs.add(r));
        } else if (n.type === "BinaryExpression") {
            traverse(n.left);
            traverse(n.right);
        } else if (n.type === "FunctionCall") {
            n.args.forEach(traverse);
        }
    }

    traverse(node);
    return Array.from(refs);
}

/**
 * Extracts all unique cell references from a formula string.
 * Ranges are expanded into individual cell keys.
 */
export function extractReferences(formula: string): string[] {
    try {
        const ast = parseFormula(formula);
        return extractReferencesFromAST(ast);
    } catch (e) {
        console.error("Failed to extract references:", e);
        return [];
    }
}

export function stringifyAST(node: ASTNode): string {
    switch (node.type) {
        case "Literal":
            return node.value.toString();
        case "CellReference":
            return node.address;
        case "Range":
            return `${node.start.address}:${node.end.address}`;
        case "BinaryExpression":
            return `(${stringifyAST(node.left)} ${node.operator} ${stringifyAST(node.right)})`;
        case "FunctionCall":
            return `${node.name}(${node.args.map(stringifyAST).join(", ")})`;
        default:
            return "";
    }
}

export function shiftFormula(formula: string, rowOffset: number, colOffset: number = 0): string {
    if (!formula.startsWith("=")) return formula;
    const ast = parseFormula(formula);

    function shift(n: ASTNode): ASTNode {
        if (n.type === "CellReference") {
            const coords = addressToCoords(n.address);
            if (!coords) return n;
            const newRow = Math.max(0, coords.row + rowOffset);
            const newCol = Math.max(0, coords.col + colOffset);
            return {
                type: "CellReference",
                address: coordsToAddress(newRow, newCol)
            };
        }
        if (n.type === "Range") {
            const startCoords = addressToCoords(n.start.address);
            const endCoords = addressToCoords(n.end.address);
            if (!startCoords || !endCoords) return n;
            const startNewRow = Math.max(0, startCoords.row + rowOffset);
            const startNewCol = Math.max(0, startCoords.col + colOffset);
            const endNewRow = Math.max(0, endCoords.row + rowOffset);
            const endNewCol = Math.max(0, endCoords.col + colOffset);

            return {
                type: "Range",
                start: { type: "CellReference", address: coordsToAddress(startNewRow, startNewCol) },
                end: { type: "CellReference", address: coordsToAddress(endNewRow, endNewCol) }
            };
        }
        if (n.type === "BinaryExpression") {
            return {
                ...n,
                left: shift(n.left),
                right: shift(n.right)
            };
        }
        if (n.type === "FunctionCall") {
            return {
                ...n,
                args: n.args.map(shift)
            };
        }
        return n;
    }

    const shiftedAst = shift(ast);
    return "=" + stringifyAST(shiftedAst);
}
