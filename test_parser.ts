import { parseFormula } from './src/utils/formulaParser';

const testCases = [
    "=A1",
    "=A1 + B1",
    "=10 + 20",
    "=SUM(A1:A5)",
    "=10 + SUM(A1:B2) * 2"
];

testCases.forEach(formula => {
    try {
        const ast = parseFormula(formula);
        console.log(`Formula: ${formula}`);
        console.log(JSON.stringify(ast, null, 2));
        console.log("-------------------");
    } catch (err) {
        console.error(`Error parsing formula: ${formula}`);
        console.error(err);
    }
});
