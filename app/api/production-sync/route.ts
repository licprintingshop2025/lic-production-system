import { NextResponse } from "next/server";
import { runProductionSync } from "@/lib/productionSyncEngine";

export async function GET() {
  try {
    const result = await runProductionSync();

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Production sync failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
