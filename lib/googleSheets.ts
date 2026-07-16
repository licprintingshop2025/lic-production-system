import { google } from "googleapis";

function getSheetsClient() {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!sheetId || !clientEmail || !privateKey) {
    throw new Error("Missing Google Sheets environment variables");
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  return { sheets, sheetId };
}

export async function appendReceivedATPRow(row: (string | number)[]) {
  const { sheets, sheetId } = getSheetsClient();
  const sheetTab = process.env.GOOGLE_SHEET_TAB || "Received ATP";

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `'${sheetTab}'!A:S`,
    valueInputOption: "RAW",
    requestBody: {
      values: [row],
    },
  });
}

export async function appendDailyAssignmentsRows(rows: (string | number)[][]) {
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

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "'Received ATP'!A:S",
  });

  return response.data.values || [];
}

export async function findReceivedATPByCardId(cardId: string) {
  const rows = await getReceivedATPRows();

  const rowIndex = rows.findIndex((row, index) => {
    if (index === 0) return false;
    return row[18] === cardId;
  });

  if (rowIndex === -1) return null;

  return {
    rowIndex: rowIndex + 1,
    row: rows[rowIndex],
  };
}

export async function appendBIRProductionRecord(row: unknown[]) {
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

export async function appendNonBIRProductionRecord(row: unknown[]) {
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

export async function findBIRProductionRecordByCardId(cardId: string) {
  const { sheets, sheetId } = getSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "'BIR Production Records'!A:W",
  });

  const rows = response.data.values || [];
  const index = rows.findIndex((row) => row[17] === cardId);

  if (index === -1) return null;

  return {
    row: rows[index],
    rowNumber: index + 1,
  };
}

export async function findNonBIRProductionRecordByCardId(cardId: string) {
  const { sheets, sheetId } = getSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "'Non-BIR Production Records'!A:L",
  });

  const rows = response.data.values || [];
  const index = rows.findIndex((row) => row[6] === cardId);

  if (index === -1) return null;

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

  if (Number.isNaN(start.getTime()) || Number.isNaN(completed.getTime())) {
    return "";
  }

  const diffMs = completed.getTime() - start.getTime();

  if (diffMs < 0) return "";

  const totalMinutes = Math.floor(diffMs / (1000 * 60));

  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);

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

export async function createEmployee(employee: EmployeeInput) {
  const { sheets, sheetId } = getSheetsClient();

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

  return { success: true };
}

export async function updateEmployee(employee: EmployeeInput) {
  const { sheets, sheetId } = getSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "'Employee Database'!A:H",
  });

  const rows = response.data.values || [];

  const rowIndex = rows.findIndex((row, index) => {
    if (index === 0) return false;
    return String(row[0] || "").trim() === employee.employeeId;
  });

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

  return { success: true, row: sheetRowNumber };
}

export async function appendNonBIROrderRow(row: (string | number)[]) {
  const { sheets, sheetId } = getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "'Non-BIR Orders'!A:H",
    valueInputOption: "RAW",
    requestBody: {
      values: [row],
    },
  });
}

export async function getNonBIROrderRows() {
  const { sheets, sheetId } = getSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "'Non-BIR Orders'!A:H",
  });

  return response.data.values || [];
}

export async function getBIRProductionRecordRows() {
  const { sheets, sheetId } = getSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "'BIR Production Records'!A:W",
  });

  return response.data.values || [];
}

export async function getNonBIRProductionRecordRows() {
  const { sheets, sheetId } = getSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "'Non-BIR Production Records'!A:L",
  });

  return response.data.values || [];
}

export async function findNonBIROrderByCardId(cardId: string) {
  const rows = await getNonBIROrderRows();

  const rowIndex = rows.findIndex((row, index) => {
    if (index === 0) return false;
    return row[7] === cardId;
  });

  if (rowIndex === -1) return null;

  return {
    rowIndex: rowIndex + 1,
    row: rows[rowIndex],
  };
}

export async function replaceDailyAssignmentsRows(
  date: string,
  rows: (string | number)[][],
) {
  const { sheets, sheetId } = getSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "'Daily Assignments'!A:F",
  });

  const existingRows = response.data.values || [];
  const header = existingRows[0] || [
    "Date",
    "Station",
    "Primary",
    "Support",
    "Jobs",
    "Generated Time",
  ];

  const remainingRows = existingRows.slice(1).filter((row) => row[0] !== date);

  const finalRows = [header, ...remainingRows, ...rows];

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
  const { sheets, sheetId } = getSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "'Daily Assignments'!A:F",
  });

  return response.data.values || [];
}
