import { NextResponse } from "next/server";

type TrelloList = {
  name: string;
  cards?: unknown[];
};

export async function GET() {
  const key = process.env.TRELLO_KEY!;
  const token = process.env.TRELLO_TOKEN!;
  const boardId = process.env.TRELLO_BOARD_ID!;

  const limits: Record<string, number> = {
    "Station 1 & 2 (Layouting & Encoding)": 20,
    "Admin Head - (For approval to printing)": 20,
    "Quality Checking": 20,
    "Receiving & Pre-Print Formatting": 20,
    "Running": 20,
    "Numbering": 20,
    "Collating": 20,
    "Stapling/Padding": 20,
    "Cutting & Trimming": 20,
    "Browning": 20,
    "Stamping": 20,
    "Packaging & Labelling": 20,
    "Finish Receipt": 20,
  };

  const listsRes = await fetch(
    `https://api.trello.com/1/boards/${boardId}/lists?cards=open&card_fields=name&key=${key}&token=${token}`
  );

  const lists = (await listsRes.json()) as TrelloList[];

  const data = lists.map((list) => ({
    station: list.name,
    jobs: list.cards?.length || 0,
    limit: limits[list.name] || 999,
  }));

  return NextResponse.json(data);
}
