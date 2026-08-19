import { NextResponse } from "next/server";
import { appendReceivedATPRow, getReceivedATPRows } from "@/lib/googleSheets";
import { generateTrackingNumber } from "@/lib/tracking";
import type { ReceivedATPOrder } from "@/lib/orders/types";
import { normalizeDocuments } from "@/lib/orders/utils";
import {
  buildReceivedATPCardDescription,
  buildReceivedATPCardName,
} from "@/lib/orders/trello";
import { buildReceivedATPRow } from "@/lib/orders/sheets";


type DashboardCard = {
  id: string;
  idList: string;
  url?: string;
};

type DashboardList = {
  id: string;
  name: string;
};

function classifyPrintingStatus(listName: string) {
  const normalized = listName.trim().toUpperCase();

  if (!normalized) return "Unknown" as const;
  if (normalized.includes("READY FOR RELEASE")) return "Ready for Release" as const;
  if (normalized.includes("DELIVERED") || normalized.includes("PICKED UP")) return "Completed" as const;
  if (
    normalized.includes("ATP INTAKE") ||
    normalized.includes("STATION 4") ||
    normalized.includes("TEXT MESSAGING") ||
    normalized.includes("STATION 3") ||
    normalized.includes("HOLD WITH PROBLEMS")
  ) {
    return "Intake" as const;
  }

  return "In Production" as const;
}

async function getPrintingBoardState() {
  const key = process.env.TRELLO_KEY;
  const token = process.env.TRELLO_TOKEN;
  const boardId = process.env.TRELLO_BOARD_ID;

  if (!key || !token || !boardId) {
    return { cards: new Map<string, DashboardCard>(), lists: new Map<string, string>(), warning: "Missing Trello environment variables." };
  }

  try {
    const [cardsResponse, listsResponse] = await Promise.all([
      fetch(`https://api.trello.com/1/boards/${boardId}/cards?filter=all&fields=id,idList,url&key=${key}&token=${token}`, { cache: "no-store" }),
      fetch(`https://api.trello.com/1/boards/${boardId}/lists?fields=id,name&key=${key}&token=${token}`, { cache: "no-store" }),
    ]);

    if (!cardsResponse.ok || !listsResponse.ok) {
      throw new Error("Failed to load Trello board status.");
    }

    const cards = (await cardsResponse.json()) as DashboardCard[];
    const lists = (await listsResponse.json()) as DashboardList[];

    return {
      cards: new Map(cards.map((card) => [card.id, card])),
      lists: new Map(lists.map((list) => [list.id, list.name])),
      warning: "",
    };
  } catch (error) {
    return {
      cards: new Map<string, DashboardCard>(),
      lists: new Map<string, string>(),
      warning: error instanceof Error ? error.message : "Trello status unavailable.",
    };
  }
}

export async function GET() {
  try {
    const rows = await getReceivedATPRows();
    const boardState = await getPrintingBoardState();

    const orders = rows
      .slice(1)
      .map((row, index) => {
        const cardId = String(row[18] || "").trim();
        const card = boardState.cards.get(cardId);
        const currentStage = card ? boardState.lists.get(card.idList) || "Unknown" : "Unknown";

        return {
          rowNumber: index + 2,
          trackingNumber: String(row[1] || "").trim(),
          submittedAt: String(row[0] || "").trim(),
          businessName: String(row[6] || row[5] || "").trim(),
          orderSummary: String(row[10] || "").trim(),
          quantitySummary: String(row[12] || "").trim(),
          salesAssigned: String(row[17] || "").trim(),
          trelloCardId: cardId,
          trelloCardUrl: card?.url || "",
          currentStage,
          currentListId: card?.idList || "",
          status: classifyPrintingStatus(currentStage),
        };
      })
      .filter((order) => order.trackingNumber || order.businessName || order.trelloCardId);

    return NextResponse.json({
      success: true,
      orders,
      warning: boardState.warning || undefined,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load BIR printing orders.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const key = process.env.TRELLO_KEY;
    const token = process.env.TRELLO_TOKEN;
    const listId = process.env.TRELLO_ATP_INTAKE_LIST_ID;

    if (!key || !token || !listId) {
      return NextResponse.json(
        { error: "Missing Trello environment variables" },
        { status: 500 },
      );
    }

    const trackingNo = generateTrackingNumber();
    const submittedAt = new Date().toISOString();
    const documents = normalizeDocuments(body.documents);

    if (documents.length === 0) {
      return NextResponse.json(
        { error: "Please add at least one document." },
        { status: 400 },
      );
    }

    const order: ReceivedATPOrder = {
      ...body,
      trackingNo,
      submittedAt,
      documents,
    };

    const cardName = buildReceivedATPCardName(order);
    const description = buildReceivedATPCardDescription(order);

    const response = await fetch(
      `https://api.trello.com/1/cards?key=${key}&token=${token}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idList: listId,
          name: cardName,
          desc: description,
          pos: "top",
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();

      return NextResponse.json(
        { error: "Failed to create Trello card", details: errorText },
        { status: response.status },
      );
    }

    const card = await response.json();

    try {
      await appendReceivedATPRow(buildReceivedATPRow(order, card.id));
    } catch (sheetError) {
      return NextResponse.json(
        {
          error: "Trello card created, but failed to save to Google Sheet",
          trackingNo,
          card,
          details:
            sheetError instanceof Error ? sheetError.message : "Unknown error",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      trackingNo,
      card,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Server error while creating ATP record",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
