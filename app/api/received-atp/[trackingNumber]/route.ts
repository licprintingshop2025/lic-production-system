import { NextResponse } from "next/server";
import {
  getReceivedATPRows,
  updateReceivedATPRow,
} from "@/lib/googleSheets";
import type { ReceivedATPOrder } from "@/lib/orders/types";
import { normalizeDocuments } from "@/lib/orders/utils";
import {
  buildReceivedATPCardDescription,
  buildReceivedATPCardName,
} from "@/lib/orders/trello";
import {
  buildReceivedATPRow,
  parseReceivedATPRow,
} from "@/lib/orders/sheets";
import {
  loadTrelloCardForEdit,
  preserveProductionDescription,
  updateTrelloCardNameAndDescription,
} from "@/lib/orders/trelloUpdate";

function normalize(value: string) {
  return value.trim().toLowerCase();
}

async function findOrder(trackingNumber: string) {
  const rows = await getReceivedATPRows();
  const target = normalize(trackingNumber);
  const index = rows.findIndex(
    (row, rowIndex) => rowIndex > 0 && normalize(String(row[1] || "")) === target,
  );

  if (index === -1) return null;

  return {
    rowNumber: index + 1,
    rawRow: rows[index],
    order: parseReceivedATPRow(rows[index]),
    cardId: String(rows[index][18] || "").trim(),
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ trackingNumber: string }> },
) {
  try {
    const { trackingNumber } = await context.params;
    const found = await findOrder(decodeURIComponent(trackingNumber));

    if (!found) {
      return NextResponse.json({ error: "BIR printing order not found." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      rowNumber: found.rowNumber,
      trelloCardId: found.cardId,
      order: found.order,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load BIR printing order.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ trackingNumber: string }> },
) {
  try {
    const { trackingNumber } = await context.params;
    const found = await findOrder(decodeURIComponent(trackingNumber));

    if (!found) {
      return NextResponse.json({ error: "BIR printing order not found." }, { status: 404 });
    }

    if (!found.cardId) {
      return NextResponse.json(
        { error: "This order has no Trello Card ID and cannot be synchronized safely." },
        { status: 409 },
      );
    }

    const key = process.env.TRELLO_KEY;
    const token = process.env.TRELLO_TOKEN;
    if (!key || !token) {
      return NextResponse.json({ error: "Missing Trello environment variables." }, { status: 500 });
    }

    const body = await request.json();
    const documents = normalizeDocuments(body.documents);
    if (documents.length === 0) {
      return NextResponse.json({ error: "Please add at least one document." }, { status: 400 });
    }

    const order: ReceivedATPOrder = {
      ...found.order,
      ...body,
      trackingNo: found.order.trackingNo,
      submittedAt: found.order.submittedAt,
      documents,
      atpStatus: body.atpReceived || body.atpStatus || found.order.atpStatus,
    };

    const currentCard = await loadTrelloCardForEdit(found.cardId, key, token);
    const expectedName = buildReceivedATPCardName(order);
    const expectedSourceDesc = buildReceivedATPCardDescription(order);
    const expectedDesc = preserveProductionDescription(currentCard.desc || "", expectedSourceDesc);

    await updateTrelloCardNameAndDescription({
      cardId: found.cardId,
      name: expectedName,
      desc: expectedDesc,
      key,
      token,
    });

    try {
      await updateReceivedATPRow(
        found.rowNumber,
        buildReceivedATPRow(order, found.cardId),
      );
    } catch (sheetError) {
      try {
        await updateTrelloCardNameAndDescription({
          cardId: found.cardId,
          name: currentCard.name,
          desc: currentCard.desc || "",
          key,
          token,
        });
      } catch (rollbackError) {
        console.error("Failed to roll back Trello card after sheet update failure:", rollbackError);
      }
      throw sheetError;
    }

    return NextResponse.json({
      success: true,
      trackingNumber: order.trackingNo,
      trelloCardId: found.cardId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to update BIR printing order.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
