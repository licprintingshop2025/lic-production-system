import { NextResponse } from "next/server";
import { getPHDate, getPHDateTime } from "@/lib/dateTime";
import {
  getDailyAssignmentsRows,
  replaceDailyAssignmentsRows,
} from "@/lib/googleSheets";

type Assignment = {
  station: string;
  jobs: number;
  primary: string;
  support: string;
  status: string;
  notes?: string;
};

function getTodayDate() {
  return getPHDate();
}

export async function GET() {
  try {
    const date = getTodayDate();
    const rows = await getDailyAssignmentsRows();

    const todayRows = rows
      .slice(1)
      .filter((row) => row[0] === date)
      .map((row) => ({
        station: row[1] || "",
        primary: row[2] || "—",
        support: row[3] || "—",
        jobs: Number(row[4] || 0),
        generatedTime: row[5] || "",
      }));

    return NextResponse.json({
      success: true,
      date,
      assignments: todayRows,
      generatedAt: todayRows[0]?.generatedTime || "",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load daily assignments",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const assignments = body.assignments as Assignment[];

    if (!assignments || !Array.isArray(assignments)) {
      return NextResponse.json(
        { error: "Invalid assignments data" },
        { status: 400 },
      );
    }

    const date = getTodayDate();
    const generatedTime = getPHDateTime();

    const rows = assignments.map((item) => [
      date,
      item.station,
      item.primary,
      item.support,
      item.jobs,
      generatedTime,
    ]);

    await replaceDailyAssignmentsRows(date, rows);

    return NextResponse.json({
      success: true,
      saved: rows.length,
      generatedAt: generatedTime,
      mode: "daily-snapshot-replaced",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to save daily assignments",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
