import { NextResponse } from "next/server";
import {
  appendBIRProductionRecord,
  calculateProductionTime,
  findBIRProductionRecordByCardId,
  findNonBIRProductionRecordByCardId,
  findReceivedATPByCardId,
} from "@/lib/googleSheets";

type TrelloCard = {
  id: string;
  name: string;
  desc: string;
  idList: string;
  labels?: {
    name: string;
    color: string;
  }[];
};

type TrelloList = {
  id: string;
  name: string;
};

const FINAL_LISTS = ["Delivered by LIC", "Picked Up by Client"];

function isFinalList(listName: string) {
  return FINAL_LISTS.some(
    (finalList) => listName.toUpperCase() === finalList.toUpperCase()
  );
}

function getProductionStartedFallback(receivedATPRow: (string | number)[]) {
  return receivedATPRow[0]?.toString() || "";
}

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

    const listsRes = await fetch(
      `https://api.trello.com/1/boards/${boardId}/lists?key=${key}&token=${token}`,
      { cache: "no-store" }
    );

    const cardsRes = await fetch(
      `https://api.trello.com/1/boards/${boardId}/cards?key=${key}&token=${token}`,
      { cache: "no-store" }
    );

    if (!listsRes.ok || !cardsRes.ok) {
      return NextResponse.json(
        { error: "Failed to load Trello data" },
        { status: 500 }
      );
    }

    const lists = (await listsRes.json()) as TrelloList[];
    const cards = (await cardsRes.json()) as TrelloCard[];

    const listMap = new Map(lists.map((list) => [list.id, list.name]));

    const finalCards = cards.filter((card) => {
      const listName = listMap.get(card.idList) || "";
      return isFinalList(listName);
    });

    let archived = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const card of finalCards) {
      const finalStatus = listMap.get(card.idList) || "Completed";

      const alreadyArchived =
        (await findBIRProductionRecordByCardId(card.id)) ||
        (await findNonBIRProductionRecordByCardId(card.id));

      if (alreadyArchived) {
        skipped++;
        continue;
      }

      const receivedATP = await findReceivedATPByCardId(card.id);

      if (!receivedATP) {
        skipped++;
        errors.push(`No Received ATP row found for card: ${card.name}`);
        continue;
      }

      const receivedRow = receivedATP.row;

      const productionStarted = getProductionStartedFallback(receivedRow);
      const completedDate = new Date().toLocaleString();
      const releasedDate = new Date().toLocaleString();

      const productionTime = calculateProductionTime(
        productionStarted,
        completedDate
      );

      const productionRecordRow = [
        ...receivedRow,
        productionStarted,
        completedDate,
        releasedDate,
        finalStatus,
        productionTime,
      ];

      await appendBIRProductionRecord(productionRecordRow);

      archived++;
    }

    return NextResponse.json({
      success: true,
      scanned: finalCards.length,
      archived,
      skipped,
      errors,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to archive production records",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}