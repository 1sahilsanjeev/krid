import { parseFormula } from './src/utils/formulaParser';

const formula = "=10 + SUM(A1:A5) * 2";
const ast = parseFormula(formula);
console.log(JSON.stringify(ast, null, 2));
