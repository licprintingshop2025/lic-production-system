import { NextResponse } from "next/server";
import { runProductionSync } from "@/lib/productionSyncEngine";

let isRunning = false;

export async function GET() {
  if (isRunning) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "Production sync already running",
    });
  }

  isRunning = true;

  try {
    const result = await runProductionSync();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Production sync failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    isRunning = false;
  }
}