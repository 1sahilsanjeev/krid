import type { CellModel } from './tableUtils';

export type ActionType = 'UPDATE_CELL' | 'PASTE_BATCH' | 'CLEAR_BATCH' | 'REORDER_PIPELINE' | 'LOAD_SNAPSHOT';

export interface CellChange {
    rowId: number;
    colKey: string;
    oldValue: CellModel | any; // Any if it was from raw data, CellModel if staged
    newValue: CellModel;
}

export interface Action {
    type: ActionType;
    changes?: CellChange[];
    undo?: () => void;
    redo?: () => void;
}

export class HistoryManager {
    private history: Action[] = [];
    private future: Action[] = [];
    private maxHistory: number = 50;

    push(action: Action) {
        this.history.push(action);
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
        this.future = []; // Clear redo stack on new action
    }

    undo(): Action | null {
        const action = this.history.pop();
        if (action) {
            this.future.push(action);
            return action;
        }
        return null;
    }

    redo(): Action | null {
        const action = this.future.pop();
        if (action) {
            this.history.push(action);
            return action;
        }
        return null;
    }

    canUndo(): boolean {
        return this.history.length > 0;
    }

    canRedo(): boolean {
        return this.future.length > 0;
    }

    getHistorySize(): number {
        return this.history.length;
    }

    clear() {
        this.history = [];
        this.future = [];
    }
}

export const globalHistory = new HistoryManager();
