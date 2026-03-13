import type { CellModel } from "./tableUtils";

export interface Cell {
    row: number;
    col: number;
}

export interface Range {
    anchor: Cell;
    focus: Cell;
}

export interface SelectionState {
    type: 'row' | 'column' | 'range';
    ranges: Range[];
    activeRangeIndex: number;
    rowId?: number;
    colKey?: string;
}

/**
 * Returns min/max coordinates for a range
 */
export const normalizeRange = (range: Range) => {
    return {
        minRow: Math.min(range.anchor.row, range.focus.row),
        maxRow: Math.max(range.anchor.row, range.focus.row),
        minCol: Math.min(range.anchor.col, range.focus.col),
        maxCol: Math.max(range.anchor.col, range.focus.col)
    };
};

/**
 * Checks if a cell is within a specific range
 */
export const isCellInRange = (row: number, col: number, range: Range) => {
    const { minRow, maxRow, minCol, maxCol } = normalizeRange(range);
    return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
};

/**
 * Checks if two ranges overlap
 */
export const areRangesOverlapping = (r1: Range, r2: Range) => {
    const b1 = normalizeRange(r1);
    const b2 = normalizeRange(r2);
    return !(b2.minRow > b1.maxRow ||
        b2.maxRow < b1.minRow ||
        b2.minCol > b1.maxCol ||
        b2.maxCol < b1.minCol);
};

/**
 * Removes a range at a specific index
 */
export const removeRange = (ranges: Range[], index: number): Range[] => {
    return ranges.filter((_, i) => i !== index);
};

/**
 * Gets the overall bounding box of all ranges
 */
export const getBoundingBox = (ranges: Range[]): Range | null => {
    if (ranges.length === 0) return null;
    let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
    ranges.forEach(r => {
        const norm = normalizeRange(r);
        minR = Math.min(minR, norm.minRow);
        maxR = Math.max(maxR, norm.maxRow);
        minC = Math.min(minC, norm.minCol);
        maxC = Math.max(maxC, norm.maxCol);
    });
    return {
        anchor: { row: minR, col: minC },
        focus: { row: maxR, col: maxC }
    };
};

/**
 * Placeholder for merging logic - standard grids usually don't merge irregular ranges into a single range
 * unless they form a perfect rectangle. For now, this could just return the unique set or simplify overlaps.
 */
export const mergeRanges = (ranges: Range[]): Range[] => {
    // For now, simplify logic: just return as is or implement basic deduplication
    return ranges;
};

/**
 * Calculates new focus cell when expanding with shift + arrow
 */
export const expandRangeWithShift = (currentFocus: Cell, direction: 'Up' | 'Down' | 'Left' | 'Right', rowCount: number, colCount: number): Cell => {
    let { row, col } = currentFocus;
    if (direction === 'Up') row = Math.max(0, row - 1);
    if (direction === 'Down') row = Math.min(rowCount - 1, row + 1);
    if (direction === 'Left') col = Math.max(0, col - 1);
    if (direction === 'Right') col = Math.min(colCount - 1, col + 1);
    return { row, col };
};

/**
 * Detects the continuous data block containing startCell
 */
export const getDataRegion = (startCell: Cell, data: any[], columns: string[]) => {
    if (!data[startCell.row]) return { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 };

    let minR = startCell.row;
    let maxR = startCell.row;
    let minC = startCell.col;
    let maxC = startCell.col;

    const isCellEmpty = (r: number, c: number) => {
        const val = data[r]?.[columns[c]];
        return val === null || val === undefined || val === "";
    };

    const isRowEmpty = (r: number, startC: number, endC: number) => {
        if (r < 0 || r >= data.length) return true;
        for (let c = startC; c <= endC; c++) {
            if (!isCellEmpty(r, c)) return false;
        }
        return true;
    };

    const isColEmpty = (c: number, startR: number, endR: number) => {
        if (c < 0 || c >= columns.length) return true;
        for (let r = startR; r <= endR; r++) {
            if (!isCellEmpty(r, c)) return false;
        }
        return true;
    };

    let changed = true;
    while (changed) {
        changed = false;
        if (minR > 0 && !isRowEmpty(minR - 1, Math.max(0, minC - 1), Math.min(columns.length - 1, maxC + 1))) {
            minR--; changed = true;
        }
        if (maxR < data.length - 1 && !isRowEmpty(maxR + 1, Math.max(0, minC - 1), Math.min(columns.length - 1, maxC + 1))) {
            maxR++; changed = true;
        }
        if (minC > 0 && !isColEmpty(minC - 1, Math.max(0, minR - 1), Math.min(data.length - 1, maxR + 1))) {
            minC--; changed = true;
        }
        if (maxC < columns.length - 1 && !isColEmpty(maxC + 1, Math.max(0, minR - 1), Math.min(data.length - 1, maxR + 1))) {
            maxC++; changed = true;
        }
    }

    return { minRow: minR, maxRow: maxR, minCol: minC, maxCol: maxC };
};

/**
 * Jump to edge logic (Ctrl+Arrow)
 */
export const getJumpCoordinate = (startCell: Cell, data: any[], columns: string[], grid: CellModel[][], direction: 'Up' | 'Down' | 'Left' | 'Right'): Cell => {
    const isCellEmpty = (r: number, c: number) => {
        if (r < 0 || r >= grid.length || c < 0 || c >= columns.length) return true;
        const cell = grid[r]?.[c];
        return !cell || (cell.raw === "" && cell.value === null);
    };

    let currR = startCell.row;
    let currC = startCell.col;

    const move = () => {
        if (direction === 'Up') currR--;
        if (direction === 'Down') currR++;
        if (direction === 'Left') currC--;
        if (direction === 'Right') currC++;
    };

    const inBounds = (r: number, c: number) => r >= 0 && r < data.length && c >= 0 && c < columns.length;

    const startIsEmpty = isCellEmpty(currR, currC);

    if (startIsEmpty) {
        while (inBounds(currR, currC) && isCellEmpty(currR, currC)) move();
        if (!inBounds(currR, currC)) {
            if (direction === 'Up') return { row: 0, col: currC };
            if (direction === 'Down') return { row: data.length - 1, col: currC };
            if (direction === 'Left') return { row: currR, col: 0 };
            return { row: currR, col: columns.length - 1 };
        }
        return { row: currR, col: currC };
    } else {
        while (inBounds(currR, currC) && !isCellEmpty(currR, currC)) move();
        if (!inBounds(currR, currC)) {
            if (direction === 'Up') return { row: 0, col: currC };
            if (direction === 'Down') return { row: data.length - 1, col: currC };
            if (direction === 'Left') return { row: currR, col: 0 };
            return { row: currR, col: columns.length - 1 };
        }
        if (direction === 'Up') currR++;
        if (direction === 'Down') currR--;
        if (direction === 'Left') currC++;
        if (direction === 'Right') currC--;
        return {
            row: Math.max(0, Math.min(data.length - 1, currR)),
            col: Math.max(0, Math.min(columns.length - 1, currC))
        };
    }
};
