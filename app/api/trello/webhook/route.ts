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

    const allowedActions = ["updateCard", "updateCheckItemStateOnCard"];

    if (!allowedActions.includes(actionType)) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: `Ignored action: ${actionType}`,
      });
    }

    const syncResult = await runProductionSync();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    let autoMoveResult = null;

    if (appUrl) {
      const autoMoveRes = await fetch(`${appUrl}/api/trello/auto-move`, {
        method: "POST",
      });

      autoMoveResult = await autoMoveRes.json();
    }

    return NextResponse.json({
      success: true,
      trigger: "trello-webhook",
      actionType,
      syncResult,
      autoMoveResult,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Webhook error",
      },
      { status: 500 },
    );
  }
}
