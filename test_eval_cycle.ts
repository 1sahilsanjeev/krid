import { evaluateFormula } from './src/utils/formulaEvaluator';

const mockGrid = [
    [
        { raw: "=B1", formula: "B1", value: 0, dependencies: ["B1"] }, // A1 (0,0)
        { raw: "=A1", formula: "A1", value: 0, dependencies: ["A1"] }, // B1 (0,1)
        { raw: "", formula: null, value: 0, dependencies: [] }, // C1
        { raw: "=A1", formula: "A1", value: 0, dependencies: ["A1"] } // D1 (0,3)
    ]
];

const context = {
    data: [{}],
    grid: mockGrid,
    columns: ["A", "B", "C", "D"],
    stagedChanges: {}
};

const resA1 = evaluateFormula("=B1", context);
console.log("A1 evaluation:", resA1);

const resB1 = evaluateFormula("=A1", context);
console.log("B1 evaluation:", resB1);

const resD1 = evaluateFormula("=A1", context);
console.log("D1 evaluation:", resD1);
