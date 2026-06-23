import { NextResponse } from "next/server";

export async function GET() {
  try {
    const key = process.env.TRELLO_KEY;
    const token = process.env.TRELLO_TOKEN;
    const boardId = process.env.TRELLO_BOARD_ID;

    const response = await fetch(
      `https://api.trello.com/1/boards/${boardId}/lists?cards=open&key=${key}&token=${token}`,
      {
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch lists" },
        { status: response.status }
      );
    }

    const lists = await response.json();

    return NextResponse.json({ lists });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
