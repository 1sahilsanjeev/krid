import * as XLSX from 'xlsx';

/**
 * Converts row data and column definitions to an Excel (XLSX) workbook buffer.
 * @param rows Array of objects representing the data rows.
 * @param columns Optional array of column keys to include.
 * @returns Uint8Array containing the workbook data.
 */
export function convertToXLSX(rows: any[], columns?: string[]): Uint8Array {
    // Step 2: Convert rows array to worksheet
    // If columns are provided, we use them as headers
    const worksheet = XLSX.utils.json_to_sheet(rows, { header: columns });

    // Step 3: Create workbook
    const workbook = XLSX.utils.book_new();

    // Step 4: Append worksheet
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    // Step 5: Write workbook to array buffer
    const arrayBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });

    // Step 6: Return Uint8Array
    return new Uint8Array(arrayBuffer);
}
