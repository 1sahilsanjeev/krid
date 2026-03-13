import { extractReferences } from './src/utils/formulaParser';

const testCases = [
    { formula: "=A1", expected: ["A1"] },
    { formula: "=A1+B2", expected: ["A1", "B2"] },
    { formula: "=SUM(A1:A3)", expected: ["A1", "A2", "A3"] },
    { formula: "=A1 + SUM(B1:B2)", expected: ["A1", "B1", "B2"] },
    { formula: "=A1:B2", expected: ["A1", "A2", "B1", "B2"] },
    { formula: "=10 + 20", expected: [] },
    { formula: "=SUM(A1:A3, C1)", expected: ["A1", "A2", "A3", "C1"] },
    { formula: "=AA1", expected: ["AA1"] },
];

console.log("Starting verification of extractReferences...");

let passed = 0;
testCases.forEach(({ formula, expected }, i) => {
    const rawResult = extractReferences(formula);
    const result = rawResult.sort();
    const sortedExpected = expected.sort();

    const matches = JSON.stringify(result) === JSON.stringify(sortedExpected);
    if (matches) {
        console.log(`[PASS] Case ${i + 1}: ${formula}`);
        passed++;
    } else {
        console.error(`[FAIL] Case ${i + 1}: ${formula}`);
        console.error(`       Expected: ${JSON.stringify(sortedExpected)}`);
        console.error(`       Got:      ${JSON.stringify(result)}`);
    }
});

console.log(`\nVerification complete: ${passed}/${testCases.length} passed.`);
if (passed === testCases.length) {
    process.exit(0);
} else {
    process.exit(1);
}
