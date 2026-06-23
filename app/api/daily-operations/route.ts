import { NextResponse } from "next/server";

type TrelloLabel = {
  name?: string;
};

type TrelloCard = {
  name: string;
  labels?: TrelloLabel[];
};

type TrelloList = {
  name: string;
  cards?: TrelloCard[];
};

const ACTIVE_PRODUCTION_STATIONS = [
  "STATION 1 & 2",
  "ADMIN HEAD",
  "QUALITY CHECKING",
  "RECEIVING & PRE-PRINT",
  "RUNNING",
  "NUMBERING",
  "COLLATING",
  "STAPLING",
  "CUTTING",
  "BROWNING",
  "STAMPING",
  "PACKAGING",
  "FINISH RECEIPT",
  "READY FOR RELEASE",
];

export async function GET() {
  const key = process.env.TRELLO_KEY;
  const token = process.env.TRELLO_TOKEN;
  const boardId = process.env.TRELLO_BOARD_ID;

  if (!key || !token || !boardId) {
    return NextResponse.json(
      { error: "Missing Trello environment variables" },
      { status: 500 }
    );
  }

  const res = await fetch(
    `https://api.trello.com/1/boards/${boardId}/lists?cards=open&card_fields=name,desc,labels&key=${key}&token=${token}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to fetch Trello data" },
      { status: res.status }
    );
  }

  const lists = (await res.json()) as TrelloList[];

  const activeLists = lists.filter((list) =>
    ACTIVE_PRODUCTION_STATIONS.some((station) =>
      list.name.toUpperCase().includes(station)
    )
  );

  const stations = activeLists.map((list) => ({
    name: list.name,
    jobs: list.cards?.length || 0,
  }));

  const rushOrders = activeLists.flatMap((list) =>
    (list.cards || [])
      .filter((card) =>
        card.labels?.some((label) => label.name?.toLowerCase() === "rush")
      )
      .map((card) => ({
        station: list.name,
        name: card.name,
      }))
  );

  return NextResponse.json({
    stations,
    rushOrders,
  });
}