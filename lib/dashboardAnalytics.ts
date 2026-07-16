import {
  getBIRProductionRecordRows,
  getNonBIRProductionRecordRows,
  getNonBIROrderRows,
  getReceivedATPRows,
} from "@/lib/googleSheets";

export type DashboardTrackerRow = {
  currentStation: string;
  orderQuantity: number;
};

export type ProductionVolume = {
  enteredToday: number;
  enteredThisWeek: number;
  enteredThisMonth: number;
  currentlyInProduction: number;
  completedThisMonth: number;
};

function parseQuantity(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  if (typeof value !== "string") return 0;

  const normalized = value
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "")
    .trim();

  if (!normalized) return 0;

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed < 0) return 0;

  return parsed;
}

function parseSheetDate(value: unknown) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const raw = String(value).trim();

  if (!raw) return null;

  const yearFirstMatch = raw.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/,
  );

  if (yearFirstMatch) {
    const [, year, month, day] = yearFirstMatch;

    const parsed = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
    );

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const slashMatch = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+.*)?$/,
  );

  if (slashMatch) {
    const [, first, second, year] = slashMatch;

    let month = Number(first);
    let day = Number(second);

    if (month > 12) {
      day = Number(first);
      month = Number(second);
    }

    const parsed = new Date(Number(year), month - 1, day);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const fallback = new Date(raw);

  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function getStartOfDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0,
  );
}

function getStartOfWeek(date: Date) {
  const start = getStartOfDay(date);
  const currentDay = start.getDay();

  const daysSinceMonday = currentDay === 0 ? 6 : currentDay - 1;

  start.setDate(start.getDate() - daysSinceMonday);

  return start;
}

function getStartOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isWithinRange(date: Date, startDate: Date, endDate: Date) {
  const timestamp = date.getTime();

  return (
    timestamp >= startDate.getTime() &&
    timestamp <= endDate.getTime()
  );
}

function sumRowsWithinRange({
  rows,
  dateColumnIndex,
  quantityColumnIndex,
  startDate,
  endDate,
}: {
  rows: unknown[][];
  dateColumnIndex: number;
  quantityColumnIndex: number;
  startDate: Date;
  endDate: Date;
}) {
  return rows.slice(1).reduce((total, row) => {
    const rowDate = parseSheetDate(row[dateColumnIndex]);

    if (!rowDate || !isWithinRange(rowDate, startDate, endDate)) {
      return total;
    }

    return total + parseQuantity(row[quantityColumnIndex]);
  }, 0);
}

function isCurrentlyInProduction(stationName: string) {
  const station = stationName.trim().toUpperCase();

  if (!station) return false;

  return (
    !station.includes("ATP INTAKE") &&
    !station.includes("NON-BIR INTAKE") &&
    !station.includes("TEXT MESSAGING") &&
    !station.includes("STATION 3") &&
    !station.includes("HOLD WITH PROBLEMS") &&
    !station.includes("READY FOR RELEASE") &&
    !station.includes("DELIVERED") &&
    !station.includes("PICKED UP")
  );
}

export async function getDashboardProductionVolume(
  trackerRows: DashboardTrackerRow[],
): Promise<ProductionVolume> {
  try {
    const [
      receivedATPRows,
      nonBIROrderRows,
      birProductionRecordRows,
      nonBIRProductionRecordRows,
    ] = await Promise.all([
      getReceivedATPRows(),
      getNonBIROrderRows(),
      getBIRProductionRecordRows(),
      getNonBIRProductionRecordRows(),
    ]);

    const now = new Date();

    const startOfToday = getStartOfDay(now);
    const startOfWeek = getStartOfWeek(now);
    const startOfMonth = getStartOfMonth(now);

    const endOfToday = new Date(startOfToday);
    endOfToday.setHours(23, 59, 59, 999);

    const endOfCurrentPeriod = endOfToday;

    /*
     * Received ATP
     * Timestamp: column A = index 0
     * Booklets: column M = index 12
     */
    const receivedATPToday = sumRowsWithinRange({
      rows: receivedATPRows,
      dateColumnIndex: 0,
      quantityColumnIndex: 12,
      startDate: startOfToday,
      endDate: endOfToday,
    });

    const receivedATPThisWeek = sumRowsWithinRange({
      rows: receivedATPRows,
      dateColumnIndex: 0,
      quantityColumnIndex: 12,
      startDate: startOfWeek,
      endDate: endOfCurrentPeriod,
    });

    const receivedATPThisMonth = sumRowsWithinRange({
      rows: receivedATPRows,
      dateColumnIndex: 0,
      quantityColumnIndex: 12,
      startDate: startOfMonth,
      endDate: endOfCurrentPeriod,
    });

    /*
     * Non-BIR Orders
     * Date Received: column B = index 1
     * No. of Booklets: column E = index 4
     */
    const nonBIRToday = sumRowsWithinRange({
      rows: nonBIROrderRows,
      dateColumnIndex: 1,
      quantityColumnIndex: 4,
      startDate: startOfToday,
      endDate: endOfToday,
    });

    const nonBIRThisWeek = sumRowsWithinRange({
      rows: nonBIROrderRows,
      dateColumnIndex: 1,
      quantityColumnIndex: 4,
      startDate: startOfWeek,
      endDate: endOfCurrentPeriod,
    });

    const nonBIRThisMonth = sumRowsWithinRange({
      rows: nonBIROrderRows,
      dateColumnIndex: 1,
      quantityColumnIndex: 4,
      startDate: startOfMonth,
      endDate: endOfCurrentPeriod,
    });

    /*
     * BIR Production Records
     * Booklets: column L = index 11
     * Released Date: column U = index 20
     */
    const completedBIRThisMonth = sumRowsWithinRange({
      rows: birProductionRecordRows,
      dateColumnIndex: 20,
      quantityColumnIndex: 11,
      startDate: startOfMonth,
      endDate: endOfCurrentPeriod,
    });

    /*
     * Non-BIR Production Records
     * Quantity: column D = index 3
     * Released Date: column J = index 9
     */
    const completedNonBIRThisMonth = sumRowsWithinRange({
      rows: nonBIRProductionRecordRows,
      dateColumnIndex: 9,
      quantityColumnIndex: 3,
      startDate: startOfMonth,
      endDate: endOfCurrentPeriod,
    });

    const currentlyInProduction = trackerRows
      .filter((row) => isCurrentlyInProduction(row.currentStation))
      .reduce(
        (total, row) => total + parseQuantity(row.orderQuantity),
        0,
      );

    return {
      enteredToday: receivedATPToday + nonBIRToday,
      enteredThisWeek: receivedATPThisWeek + nonBIRThisWeek,
      enteredThisMonth:
        receivedATPThisMonth + nonBIRThisMonth,
      currentlyInProduction,
      completedThisMonth:
        completedBIRThisMonth + completedNonBIRThisMonth,
    };
  } catch (error) {
    console.error(
      "Failed to calculate dashboard production volume:",
      error,
    );

    return {
      enteredToday: 0,
      enteredThisWeek: 0,
      enteredThisMonth: 0,
      currentlyInProduction: 0,
      completedThisMonth: 0,
    };
  }
}

export function formatProductionVolume(value: number) {
  return new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: 0,
  }).format(value);
}