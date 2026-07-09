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

    const params = new URLSearchParams({
      key,
      token,
      idModel: boardId,
      callbackURL,
      description: "LIC Production System Webhook",
    });

    const res = await fetch(
      `https://api.trello.com/1/webhooks?${params.toString()}`,
      {
        method: "POST",
      }
    );

    const text = await res.text();

    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          status: res.status,
          trelloResponse: text,
        },
        { status: res.status }
      );
    }

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    return NextResponse.json({
      success: true,
      webhook: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Webhook registration failed.",
      },
      { status: 500 }
    );
  }
}