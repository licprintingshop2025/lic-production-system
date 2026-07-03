import { NextResponse } from "next/server";

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

    console.log("Trello webhook received:", {
      actionType: body.action?.type,
      cardName: body.action?.data?.card?.name,
      listBefore: body.action?.data?.listBefore?.name,
      listAfter: body.action?.data?.listAfter?.name,
    });

    return NextResponse.json({ success: true });
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