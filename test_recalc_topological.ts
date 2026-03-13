import { DependencyGraph } from './src/utils/dependencyGraph';

const dg = new DependencyGraph();

console.log("Starting verification of Topological Recalculation Order...");

// Scenario: Diamond Dependency
// A1 (input)
// B1 = A1 + 1
// C1 = A1 + 2
// D1 = B1 + C1
// Expected Order for A1 change: [B1, C1, D1] or [C1, B1, D1]
// Crucially, D1 MUST be after B1 and C1.

dg.register("A1", []);
dg.register("B1", ["A1"]);
dg.register("C1", ["A1"]);
dg.register("D1", ["B1", "C1"]);

const orderA1 = dg.getRecalculationOrder("A1");
console.log("Recalc order for A1:", orderA1);

const d1Idx = orderA1.indexOf("D1");
const b1Idx = orderA1.indexOf("B1");
const c1Idx = orderA1.indexOf("C1");

if (d1Idx > b1Idx && d1Idx > c1Idx && orderA1.length === 3) {
    console.log("[PASS] Diamond dependency order correct.");
} else {
    console.error("[FAIL] Diamond dependency order incorrect.");
    process.exit(1);
}

// Scenario: Batch Change
// A1 (input), E1 (input)
// F1 = A1 + E1
// G1 = F1 + 1
// If A1 and E1 change together.
dg.register("E1", []);
dg.register("F1", ["A1", "E1"]);
dg.register("G1", ["F1"]);

const batchOrder = dg.getBatchRecalculationOrder(["A1", "E1"]);
console.log("Batch recalc order for [A1, E1]:", batchOrder);

const f1Idx = batchOrder.indexOf("F1");
const g1Idx = batchOrder.indexOf("G1");

if (f1Idx < g1Idx && batchOrder.includes("F1") && batchOrder.includes("G1")) {
    console.log("[PASS] Batch dependency order correct.");
} else {
    console.error("[FAIL] Batch dependency order incorrect.");
    process.exit(1);
}

console.log("\nAll topological verification passed.");
process.exit(0);
