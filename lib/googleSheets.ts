import { google } from "googleapis";
import type {
  TransactionDocument,
  TransactionInput,
  TransactionRecord,
  TransactionSheetRecord,
} from "@/lib/transactions/types";
import {
  normalizeStringArray,
  normalizeTransactionStatus,
  parseDocumentsFromSheet,
  serializeStringArray,
} from "@/lib/transactions/utils";

function getSheetsClient() {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey =
    process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!sheetId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Google Sheets environment variables",
    );
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
    ],
  });

  const sheets = google.sheets({
    version: "v4",
    auth,
  });

  return {
    sheets,
    sheetId,
  };
}

export async function appendReceivedATPRow(
  row: (string | number)[],
) {
  const { sheets, sheetId } = getSheetsClient();

  const sheetTab =
    process.env.GOOGLE_SHEET_TAB ||
    "Received ATP";

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `'${sheetTab}'!A:S`,
    valueInputOption: "RAW",
    requestBody: {
      values: [row],
    },
  });
}

export async function appendDailyAssignmentsRows(
  rows: (string | number)[][],
) {
  const { sheets, sheetId } = getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "'Daily Assignments'!A:F",
    valueInputOption: "RAW",
    requestBody: {
      values: rows,
    },
  });
}

export async function getReceivedATPRows() {
  const { sheets, sheetId } = getSheetsClient();

  const response =
    await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "'Received ATP'!A:S",
    });

  return response.data.values || [];
}

export async function findReceivedATPByCardId(
  cardId: string,
) {
  const rows = await getReceivedATPRows();

  const rowIndex = rows.findIndex(
    (row, index) => {
      if (index === 0) {
        return false;
      }

      return row[18] === cardId;
    },
  );

  if (rowIndex === -1) {
    return null;
  }

  return {
    rowIndex: rowIndex + 1,
    row: rows[rowIndex],
  };
}

export async function appendBIRProductionRecord(
  row: unknown[],
) {
  const { sheets, sheetId } = getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "'BIR Production Records'!A:W",
    valueInputOption: "RAW",
    requestBody: {
      values: [row],
    },
  });
}

export async function appendNonBIRProductionRecord(
  row: unknown[],
) {
  const { sheets, sheetId } = getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "'Non-BIR Production Records'!A:L",
    valueInputOption: "RAW",
    requestBody: {
      values: [row],
    },
  });
}

export async function findBIRProductionRecordByCardId(
  cardId: string,
) {
  const { sheets, sheetId } = getSheetsClient();

  const response =
    await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "'BIR Production Records'!A:W",
    });

  const rows = response.data.values || [];

  const index = rows.findIndex(
    (row) => row[17] === cardId,
  );

  if (index === -1) {
    return null;
  }

  return {
    row: rows[index],
    rowNumber: index + 1,
  };
}

export async function findNonBIRProductionRecordByCardId(
  cardId: string,
) {
  const { sheets, sheetId } = getSheetsClient();

  const response =
    await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range:
        "'Non-BIR Production Records'!A:L",
    });

  const rows = response.data.values || [];

  const index = rows.findIndex(
    (row) => row[6] === cardId,
  );

  if (index === -1) {
    return null;
  }

  return {
    row: rows[index],
    rowNumber: index + 1,
  };
}

export function calculateProductionTime(
  startDate: string,
  completedDate: string,
) {
  const start = new Date(startDate);
  const completed = new Date(completedDate);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(completed.getTime())
  ) {
    return "";
  }

  const diffMs =
    completed.getTime() - start.getTime();

  if (diffMs < 0) {
    return "";
  }

  const totalMinutes = Math.floor(
    diffMs / (1000 * 60),
  );

  const days = Math.floor(
    totalMinutes / (60 * 24),
  );

  const hours = Math.floor(
    (totalMinutes % (60 * 24)) / 60,
  );

  const minutes = totalMinutes % 60;

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days}d`);
  }

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (
    minutes > 0 ||
    parts.length === 0
  ) {
    parts.push(`${minutes}m`);
  }

  return parts.join(" ");
}

export type EmployeeInput = {
  employeeId: string;
  name: string;
  position: string;
  skills: string[];
  status: string;
  maxStations: number;
  shift: string;
  employmentType: string;
};

export async function createEmployee(
  employee: EmployeeInput,
) {
  const { sheets, sheetId } =
    getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "'Employee Database'!A:H",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          employee.employeeId,
          employee.name,
          employee.position,
          employee.skills.join(", "),
          employee.status,
          employee.maxStations,
          employee.shift,
          employee.employmentType,
        ],
      ],
    },
  });

  return {
    success: true,
  };
}

export async function updateEmployee(
  employee: EmployeeInput,
) {
  const { sheets, sheetId } =
    getSheetsClient();

  const response =
    await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "'Employee Database'!A:H",
    });

  const rows = response.data.values || [];

  const rowIndex = rows.findIndex(
    (row, index) => {
      if (index === 0) {
        return false;
      }

      return (
        String(row[0] || "").trim() ===
        employee.employeeId
      );
    },
  );

  if (rowIndex === -1) {
    throw new Error("Employee not found");
  }

  const sheetRowNumber = rowIndex + 1;

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `'Employee Database'!A${sheetRowNumber}:H${sheetRowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          employee.employeeId,
          employee.name,
          employee.position,
          employee.skills.join(", "),
          employee.status,
          employee.maxStations,
          employee.shift,
          employee.employmentType,
        ],
      ],
    },
  });

  return {
    success: true,
    row: sheetRowNumber,
  };
}

export async function appendNonBIROrderRow(
  row: (string | number)[],
) {
  const { sheets, sheetId } =
    getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "'Non-BIR Orders'!A:I",
    valueInputOption: "RAW",
    requestBody: {
      values: [row],
    },
  });
}

export async function getNonBIROrderRows() {
  const { sheets, sheetId } =
    getSheetsClient();

  const response =
    await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "'Non-BIR Orders'!A:I",
    });

  return response.data.values || [];
}

export async function getBIRProductionRecordRows() {
  const { sheets, sheetId } =
    getSheetsClient();

  const response =
    await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "'BIR Production Records'!A:W",
    });

  return response.data.values || [];
}

export async function getNonBIRProductionRecordRows() {
  const { sheets, sheetId } =
    getSheetsClient();

  const response =
    await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range:
        "'Non-BIR Production Records'!A:L",
    });

  return response.data.values || [];
}

export async function findNonBIROrderByCardId(
  cardId: string,
) {
  const rows =
    await getNonBIROrderRows();

  const rowIndex = rows.findIndex(
    (row, index) => {
      if (index === 0) {
        return false;
      }

      return row[7] === cardId;
    },
  );

  if (rowIndex === -1) {
    return null;
  }

  return {
    rowIndex: rowIndex + 1,
    row: rows[rowIndex],
  };
}

export async function replaceDailyAssignmentsRows(
  date: string,
  rows: (string | number)[][],
) {
  const { sheets, sheetId } =
    getSheetsClient();

  const response =
    await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "'Daily Assignments'!A:F",
    });

  const existingRows =
    response.data.values || [];

  const header =
    existingRows[0] || [
      "Date",
      "Station",
      "Primary",
      "Support",
      "Jobs",
      "Generated Time",
    ];

  const remainingRows = existingRows
    .slice(1)
    .filter((row) => row[0] !== date);

  const finalRows = [
    header,
    ...remainingRows,
    ...rows,
  ];

  await sheets.spreadsheets.values.clear({
    spreadsheetId: sheetId,
    range: "'Daily Assignments'!A:F",
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: "'Daily Assignments'!A1",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: finalRows,
    },
  });
}

export async function getDailyAssignmentsRows() {
  const { sheets, sheetId } =
    getSheetsClient();

  const response =
    await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "'Daily Assignments'!A:F",
    });

  return response.data.values || [];
}

// ============================================================
// TRANSACTIONS
// Google Sheet columns: A:V
// ============================================================

const TRANSACTIONS_LAST_COLUMN = "V";

function getTransactionsSheetTab(): string {
  return (
    process.env
      .GOOGLE_TRANSACTIONS_SHEET_TAB ||
    "Transactions"
  );
}

function cleanSheetValue(
  value: unknown,
): string {
  return String(value ?? "").trim();
}

function serializeTransactionQuantities(
  quantities: number[],
): string | number {
  if (quantities.length === 0) {
    return "";
  }

  if (quantities.length === 1) {
    return quantities[0];
  }

  return quantities.join(" | ");
}

function parseTransactionDocumentsFromColumns(
  documentTypeValue: unknown,
  taxTypeValue: unknown,
  quantityValue: unknown,
): TransactionDocument[] {
  /*
   * Backward compatibility for rows previously
   * stored as:
   *
   * INVOICE [NON-VAT] x 10
   */
  const legacyDocuments =
    parseDocumentsFromSheet(
      documentTypeValue,
    );

  if (legacyDocuments.length > 0) {
    return legacyDocuments;
  }

  const documentTypes =
    normalizeStringArray(
      documentTypeValue,
    );

  const taxTypes =
    normalizeStringArray(taxTypeValue);

  const quantities =
    normalizeStringArray(quantityValue).map(
      (value) => Number(value),
    );

  return documentTypes
    .map((documentType, index) => {
      const taxType =
        taxTypes[index] ||
        (taxTypes.length === 1
          ? taxTypes[0]
          : "");

      const quantity =
        quantities[index] ??
        (quantities.length === 1
          ? quantities[0]
          : Number.NaN);

      if (
        !documentType ||
        !taxType ||
        !Number.isFinite(quantity) ||
        !Number.isInteger(quantity) ||
        quantity < 1
      ) {
        return null;
      }

      return {
        documentType,
        taxType,
        quantity,
      };
    })
    .filter(
      (
        document,
      ): document is TransactionDocument =>
        document !== null,
    );
}

export function buildTransactionSheetRow(
  transaction: TransactionRecord,
): (string | number)[] {
  const documentTypes =
    transaction.documents.map(
      (document) =>
        document.documentType,
    );

  const taxTypes =
    transaction.documents.map(
      (document) => document.taxType,
    );

  const quantities =
    transaction.documents.map(
      (document) => document.quantity,
    );

  return [
    // A — Date Received of Application
    transaction.dateReceived,

    // B — Manual or ORUS
    transaction.applicationMethod,

    // C — Form Used
    serializeStringArray(
      transaction.formUsed,
    ),

    // D — Taxpayer Name
    transaction.taxpayerName,

    // E — Business / Tradename
    transaction.businessName,

    // F — TIN
    transaction.tin,

    // G — RDO Code
    transaction.rdoCode,

    // H — 1905
    serializeStringArray(
      transaction.form1905,
    ),

    // I — Compute Penalty (0605)
    serializeStringArray(
      transaction.computePenalty,
    ),

    // J — Description / Kind of Invoice or Receipt
    serializeStringArray(documentTypes),

    // K — Tax Type
    serializeStringArray(taxTypes),

    // L — No. of Booklets or Pads
    serializeTransactionQuantities(
      quantities,
    ),

    // M — Mobile / Viber Number
    transaction.mobileNumber,

    // N — Email
    transaction.email,

    // O — Assisted By
    transaction.assistedBy,

    // P — Books
    serializeStringArray(
      transaction.books,
    ),

    // Q — Transaction No.
    transaction.transactionNo,

    // R — Status
    transaction.status,

    // S — Created At
    transaction.createdAt,

    // T — Updated At
    transaction.updatedAt,

    // U — Trello Card ID
    transaction.trelloCardId,

    // V — Trello Card URL
    transaction.trelloCardUrl,
  ];
}

export function parseTransactionSheetRow(
  row: unknown[],
  rowNumber: number,
): TransactionSheetRecord {
  return {
    rowNumber,

    dateReceived:
      cleanSheetValue(row[0]),

    applicationMethod:
      cleanSheetValue(row[1]),

    formUsed:
      normalizeStringArray(row[2]),

    taxpayerName:
      cleanSheetValue(row[3]),

    businessName:
      cleanSheetValue(row[4]),

    tin:
      cleanSheetValue(row[5]),

    rdoCode:
      cleanSheetValue(row[6]).toUpperCase(),

    form1905:
      normalizeStringArray(row[7]),

    computePenalty:
      normalizeStringArray(row[8]),

    documents:
      parseTransactionDocumentsFromColumns(
        row[9],
        row[10],
        row[11],
      ),

    mobileNumber:
      cleanSheetValue(row[12]),

    email:
      cleanSheetValue(row[13]),

    assistedBy:
      cleanSheetValue(row[14]),

    books:
      normalizeStringArray(row[15]),

    transactionNo:
      cleanSheetValue(row[16]),

    status:
      normalizeTransactionStatus(
        row[17],
      ),

    createdAt:
      cleanSheetValue(row[18]),

    updatedAt:
      cleanSheetValue(row[19]),

    trelloCardId:
      cleanSheetValue(row[20]),

    trelloCardUrl:
      cleanSheetValue(row[21]),
  };
}

export async function appendTransactionRow(
  transaction: TransactionRecord,
) {
  const { sheets, sheetId } =
    getSheetsClient();

  const sheetTab =
    getTransactionsSheetTab();

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `'${sheetTab}'!A:${TRANSACTIONS_LAST_COLUMN}`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [
        buildTransactionSheetRow(
          transaction,
        ),
      ],
    },
  });

  return {
    success: true,
    transactionNo:
      transaction.transactionNo,
  };
}

export async function getTransactionRows() {
  const { sheets, sheetId } =
    getSheetsClient();

  const sheetTab =
    getTransactionsSheetTab();

  const response =
    await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'${sheetTab}'!A:${TRANSACTIONS_LAST_COLUMN}`,
    });

  return response.data.values || [];
}

export async function getTransactionRecords(): Promise<
  TransactionSheetRecord[]
> {
  const rows =
    await getTransactionRows();

  return rows
    .slice(1)
    .map((row, index) =>
      parseTransactionSheetRow(
        row,
        index + 2,
      ),
    )
    .filter((transaction) => {
      return Boolean(
        transaction.transactionNo ||
          transaction.taxpayerName ||
          transaction.businessName ||
          transaction.trelloCardId,
      );
    });
}

export async function findTransactionByNumber(
  transactionNo: string,
): Promise<TransactionSheetRecord | null> {
  const normalizedTransactionNo =
    transactionNo
      .trim()
      .toLowerCase();

  if (!normalizedTransactionNo) {
    return null;
  }

  const transactions =
    await getTransactionRecords();

  return (
    transactions.find(
      (transaction) =>
        transaction.transactionNo
          .trim()
          .toLowerCase() ===
        normalizedTransactionNo,
    ) || null
  );
}

export async function findTransactionByCardId(
  trelloCardId: string,
): Promise<TransactionSheetRecord | null> {
  const normalizedCardId =
    trelloCardId.trim();

  if (!normalizedCardId) {
    return null;
  }

  const transactions =
    await getTransactionRecords();

  return (
    transactions.find(
      (transaction) =>
        transaction.trelloCardId.trim() ===
        normalizedCardId,
    ) || null
  );
}

export async function updateTransactionRow(
  rowNumber: number,
  transaction: TransactionRecord,
) {
  if (
    !Number.isInteger(rowNumber) ||
    rowNumber < 2
  ) {
    throw new Error(
      "Invalid Transactions sheet row number.",
    );
  }

  const { sheets, sheetId } =
    getSheetsClient();

  const sheetTab =
    getTransactionsSheetTab();

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `'${sheetTab}'!A${rowNumber}:${TRANSACTIONS_LAST_COLUMN}${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        buildTransactionSheetRow(
          transaction,
        ),
      ],
    },
  });

  return {
    success: true,
    rowNumber,
    transactionNo:
      transaction.transactionNo,
  };
}

export async function updateTransactionByNumber(
  transactionNo: string,
  transaction: TransactionRecord,
) {
  const existingTransaction =
    await findTransactionByNumber(
      transactionNo,
    );

  if (!existingTransaction) {
    throw new Error(
      `Transaction "${transactionNo}" was not found.`,
    );
  }

  return updateTransactionRow(
    existingTransaction.rowNumber,
    transaction,
  );
}

export async function updateTransactionByCardId(
  trelloCardId: string,
  transaction: TransactionRecord,
) {
  const existingTransaction =
    await findTransactionByCardId(
      trelloCardId,
    );

  if (!existingTransaction) {
    throw new Error(
      `Transaction with Trello card ID "${trelloCardId}" was not found.`,
    );
  }

  return updateTransactionRow(
    existingTransaction.rowNumber,
    transaction,
  );
}

export async function deleteTransactionRow(
  rowNumber: number,
) {
  if (
    !Number.isInteger(rowNumber) ||
    rowNumber < 2
  ) {
    throw new Error(
      "Invalid Transactions sheet row number.",
    );
  }

  const { sheets, sheetId } =
    getSheetsClient();

  const sheetTab =
    getTransactionsSheetTab();

  const spreadsheet =
    await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
    });

  const targetSheet =
    spreadsheet.data.sheets?.find(
      (sheet) =>
        sheet.properties?.title ===
        sheetTab,
    );

  const sheetNumericId =
    targetSheet?.properties?.sheetId;

  if (
    sheetNumericId === undefined ||
    sheetNumericId === null
  ) {
    throw new Error(
      `Transactions sheet tab "${sheetTab}" was not found.`,
    );
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheetNumericId,
              dimension: "ROWS",
              startIndex:
                rowNumber - 1,
              endIndex: rowNumber,
            },
          },
        },
      ],
    },
  });

  return {
    success: true,
    deletedRow: rowNumber,
  };
}

export function mergeTransactionRecord(
  existing: TransactionRecord,
  updates: Partial<TransactionInput>,
): TransactionRecord {
  return {
    ...existing,
    ...updates,

    dateReceived:
      updates.dateReceived ??
      existing.dateReceived,

    applicationMethod:
      updates.applicationMethod ??
      existing.applicationMethod,

    formUsed:
      updates.formUsed ??
      existing.formUsed,

    form1905:
      updates.form1905 ??
      existing.form1905,

    computePenalty:
      updates.computePenalty ??
      existing.computePenalty,

    taxpayerName:
      updates.taxpayerName ??
      existing.taxpayerName,

    businessName:
      updates.businessName ??
      existing.businessName,

    tin:
      updates.tin ??
      existing.tin,

    documents:
      updates.documents ??
      existing.documents,

    mobileNumber:
      updates.mobileNumber ??
      existing.mobileNumber,

    email:
      updates.email ??
      existing.email,

    assistedBy:
      updates.assistedBy ??
      existing.assistedBy,

    books:
      updates.books ??
      existing.books,

    status:
      updates.status ??
      existing.status,

    transactionNo:
      existing.transactionNo,

    createdAt:
      existing.createdAt,

    updatedAt:
      new Date().toISOString(),

    trelloCardId:
      existing.trelloCardId,

    trelloCardUrl:
      existing.trelloCardUrl,
  };
}
export async function updateReceivedATPRow(
  rowNumber: number,
  row: (string | number)[],
) {
  if (!Number.isInteger(rowNumber) || rowNumber < 2) {
    throw new Error("Invalid Received ATP row number.");
  }

  const { sheets, sheetId } = getSheetsClient();
  const sheetTab = process.env.GOOGLE_SHEET_TAB || "Received ATP";

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `'${sheetTab}'!A${rowNumber}:S${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [row] },
  });

  return { success: true, rowNumber };
}

export async function updateNonBIROrderRow(
  rowNumber: number,
  row: (string | number)[],
) {
  if (!Number.isInteger(rowNumber) || rowNumber < 2) {
    throw new Error("Invalid Non-BIR Orders row number.");
  }

  const { sheets, sheetId } = getSheetsClient();

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `'Non-BIR Orders'!A${rowNumber}:H${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [row] },
  });

  return { success: true, rowNumber };
}
