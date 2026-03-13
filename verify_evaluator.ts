import { evaluateFormula } from './src/utils/formulaEvaluator';
import { parseCellValue } from './src/utils/tableUtils';

const columns = ["A", "B", "C"];
const grid = [
    [parseCellValue("10"), parseCellValue("20"), parseCellValue("=A1+B1")], // Row 0: A1=10, B1=20, C1=30
    [parseCellValue("=C1*2"), parseCellValue("5"), parseCellValue("=SUM(A1:B2)")], // Row 1: A2=60, B2=5, C2=95
    [parseCellValue("=A3"), parseCellValue("=B3"), parseCellValue("text")] // Row 2: A3/B3 cycle
];

const context = {
    data: [],
    grid,
    columns,
    stagedChanges: {}
};

console.log("Starting verification of Formula Evaluator...");

const testCases = [
    { formula: "=10+20", expected: 30 },
    { formula: "=A1+B1", expected: 30 },
    { formula: "=C1*2", expected: 60 },
    { formula: "=SUM(A1:B1)", expected: 30 },
    { formula: "=SUM(A1:B2)", expected: 95 },
    { formula: "=A1/0", expected: 0 },
    { formula: "=A3", expected: "#CIRCULAR" },
    { formula: "=SUM(A1:C3)", expected: "#CIRCULAR" },
];

let passed = 0;
testCases.forEach((tc, i) => {
    const res = evaluateFormula(tc.formula, context);
    if (res.value === tc.expected) {
        console.log(`[PASS] Case ${i + 1}: ${tc.formula} = ${res.value}`);
        passed++;
    } else {
        console.error(`[FAIL] Case ${i + 1}: ${tc.formula}`);
        console.error(`       Expected: ${tc.expected}`);
        console.error(`       Got:      ${res.value}`);
    }
});

console.log(`\nVerification complete: ${passed}/${testCases.length} passed.`);
if (passed === testCases.length) {
    process.exit(0);
} else {
    process.exit(1);
}
