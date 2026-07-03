import { NextResponse } from "next/server";
import { runProductionSync } from "@/lib/productionSyncEngine";

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Trello webhook endpoint is live.",
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const actionType = body.action?.type;

    if (actionType !== "updateCard") {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "Not a card update.",
      });
    }

    const result = await runProductionSync();

    return NextResponse.json({
      success: true,
      trigger: "trello-webhook",
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Webhook error",
      },
      { status: 500 }
    );
  }
}