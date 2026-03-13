export class DependencyGraph {
    private dependenciesMap = new Map<string, Set<string>>();
    private dependentsMap = new Map<string, Set<string>>();

    /**
     * Registers a cell and its dependencies.
     * Note: Cycles are permitted in the graph so they can be explicitly reported during recalculation.
     */
    register(cellId: string, references: string[]) {
        // 1. Remove old dependencies from graph
        const oldRefs = this.dependenciesMap.get(cellId);
        if (oldRefs) {
            oldRefs.forEach(ref => {
                this.dependentsMap.get(ref)?.delete(cellId);
            });
        }

        // 2. Register new dependencies
        if (references.length === 0) {
            this.dependenciesMap.delete(cellId);
            return;
        }

        const newRefs = new Set(references);
        this.dependenciesMap.set(cellId, newRefs);

        newRefs.forEach(ref => {
            if (!this.dependentsMap.has(ref)) {
                this.dependentsMap.set(ref, new Set());
            }
            this.dependentsMap.get(ref)!.add(cellId);
        });
    }

    /**
     * Finds all unique cell keys that depend on startId recursively.
     * Returns them in BFS order for basic reachability (deprecated for recalc).
     */
    getAffectedCells(startId: string): string[] {
        const affected = new Set<string>();
        const queue = [startId];
        const visited = new Set<string>();

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) continue;
            visited.add(current);

            const children = this.dependentsMap.get(current);
            if (children) {
                children.forEach(child => {
                    affected.add(child);
                    queue.push(child);
                });
            }
        }

        return Array.from(affected);
    }

    /**
     * Returns all dependents in a safe recalculation order (topological sort).
     * Now returns a set of circular nodes if cycles are detected.
     */
    getRecalculationOrder(startId: string): { order: string[], circular: string[] } {
        return this.getBatchRecalculationOrder([startId]);
    }

    /**
     * Returns a unified recalculation order for several changed cells.
     * Gracefully detects cycles via DFS stack tracking.
     */
    getBatchRecalculationOrder(startIds: string[]): { order: string[], circular: string[] } {
        const visited = new Set<string>();
        const stack = new Set<string>();
        const order: string[] = [];
        const circular = new Set<string>();
        const subgraph = new Set<string>();

        // 1. Find the union of all reachable nodes
        startIds.forEach(id => {
            this.getAffectedCells(id).forEach(node => subgraph.add(node));
        });

        // 2. DFS for topological sort with cycle detection
        const visit = (node: string) => {
            if (stack.has(node)) {
                // Cycle detected in current DFS branch
                circular.add(node);
                return;
            }
            if (visited.has(node)) return;

            stack.add(node);
            visited.add(node);

            const dependents = this.dependentsMap.get(node);
            if (dependents) {
                dependents.forEach(dep => {
                    if (subgraph.has(dep)) {
                        visit(dep);
                    }
                });
            }
            order.push(node);
            stack.delete(node);
        };

        startIds.forEach(id => {
            const directs = this.dependentsMap.get(id);
            if (directs) {
                directs.forEach(dep => visit(dep));
            }
        });

        return { order: order.reverse(), circular: Array.from(circular) };
    }

    getDependencies(cellId: string): string[] {
        const refs = this.dependenciesMap.get(cellId);
        return refs ? Array.from(refs) : [];
    }
}

export const globalDependencyGraph = new DependencyGraph();
