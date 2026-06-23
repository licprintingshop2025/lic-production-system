import { NextResponse } from "next/server";

export async function GET() {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const response = await fetch(
      `${baseUrl}/api/trello/auto-move`,
      {
        method: "POST",
      }
    );

    const data = await response.json();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 }
    );
  }
}