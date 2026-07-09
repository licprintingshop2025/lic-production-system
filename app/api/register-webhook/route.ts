import { NextResponse } from "next/server";

export async function GET() {
  try {
    const key = process.env.TRELLO_KEY;
    const token = process.env.TRELLO_TOKEN;
    const boardId = process.env.TRELLO_BOARD_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!key || !token || !boardId || !appUrl) {
      return NextResponse.json(
        { error: "Missing Trello or app environment variables." },
        { status: 500 }
      );
    }

    const callbackURL = `${appUrl}/api/trello/webhook`;

    const res = await fetch(
      `https://api.trello.com/1/webhooks?key=${key}&token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: "LIC Production System Webhook",
          callbackURL,
          idModel: boardId,
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to register webhook.", details: data },
        { status: res.status }
      );
    }

    return NextResponse.json({
      success: true,
      webhook: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Webhook registration failed.",
      },
      { status: 500 }
    );
  }
}