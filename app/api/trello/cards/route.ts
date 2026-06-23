import { NextResponse } from "next/server";

export async function GET() {
  try {
    const key = process.env.TRELLO_KEY;
    const token = process.env.TRELLO_TOKEN;
    const boardId = process.env.TRELLO_BOARD_ID;

    if (!key || !token || !boardId) {
      return NextResponse.json(
        { error: "Missing Trello environment variables" },
        { status: 500 }
      );
    }

    const url = `https://api.trello.com/1/boards/${boardId}/cards?key=${key}&token=${token}&fields=name,desc,due,idList,labels,url`;

    const response = await fetch(url, {
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch Trello cards" },
        { status: response.status }
      );
    }

    const cards = await response.json();

    return NextResponse.json({ cards });
  } catch {
    return NextResponse.json(
      { error: "Server error while fetching Trello cards" },
      { status: 500 }
    );
  }
}