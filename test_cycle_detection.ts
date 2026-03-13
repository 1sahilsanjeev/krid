import { DependencyGraph } from './src/utils/dependencyGraph';

const dg = new DependencyGraph();

console.log("Starting verification of Circular Reference Detection...");

// Scenario: 3-hop Cycle (A1 -> B1 -> C1 -> A1)
dg.register("A1", ["C1"]);
dg.register("B1", ["A1"]);
dg.register("C1", ["B1"]);

const { order, circular } = dg.getBatchRecalculationOrder(["A1"]);

console.log("Order:", order);
console.log("Circular references identified:", circular);

if (circular.length > 0) {
    console.log("[PASS] Cycle accurately detected and stopped DFS.");
} else {
    console.error("[FAIL] Cycle detection failed to identify the loop.");
    process.exit(1);
}

// Scenario: Spanning Cycle (A1 -> B1 -> A1) plus an independent branch (A1 -> D1)
dg.register("A1", ["B1"]);
dg.register("B1", ["A1"]);
dg.register("D1", ["A1"]);

const { order: order2, circular: circular2 } = dg.getBatchRecalculationOrder(["B1"]);
console.log("\nScenario 2 Order:", order2);
console.log("Scenario 2 Circular:", circular2);

if (circular2.length > 0 && order2.includes("D1")) {
    console.log("[PASS] Mixed branch cycle accurately resolved and stopped DFS.");
} else {
    console.error("[FAIL] Mixed branch cycle detection failed.");
    process.exit(1);
}

console.log("\nAll Circular Verification passed!");
process.exit(0);
