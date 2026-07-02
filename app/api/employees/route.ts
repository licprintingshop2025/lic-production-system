import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createEmployee } from "@/lib/googleSheets";

export async function GET() {
  try {
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "'Employee Database'!A:H",
    });

    const rows = response.data.values || [];

    const employees = rows
      .slice(1)
      .filter((row) => row[0] && row[1])
      .map((row) => ({
        employeeId: String(row[0] || "").trim(),
        name: row[1] || "",
        position: row[2] || "",
        skills: row[3]
          ? String(row[3])
              .split(",")
              .map((skill) => skill.trim())
              .filter(Boolean)
          : [],
        status: row[4] || "Inactive",
        maxStations: Number(row[5] || 1),
        shift: row[6] || "Whole Day",
        employmentType: row[7] || "Full-time",
      }));

    return NextResponse.json({ success: true, employees });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to load employees",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.employeeId || !body.name) {
      return NextResponse.json(
        { error: "Employee ID and name are required." },
        { status: 400 }
      );
    }

    await createEmployee({
      employeeId: body.employeeId,
      name: body.name,
      position: body.position || "",
      skills: Array.isArray(body.skills) ? body.skills : [],
      status: body.status || "Active",
      maxStations: Number(body.maxStations || 1),
      shift: body.shift || "Whole Day",
      employmentType: body.employmentType || "Full-time",
    });

    return NextResponse.json({
      success: true,
      message: "Employee created successfully.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create employee.",
      },
      { status: 500 }
    );
  }
}