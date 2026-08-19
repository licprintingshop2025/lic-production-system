import { NextResponse } from "next/server";
import {
  getNonBIROrderRows,
  updateNonBIROrderRow,
} from "@/lib/googleSheets";
import type { NonBIROrder } from "@/lib/orders/types";
import { clean, normalizeDocuments } from "@/lib/orders/utils";
import {
  buildNonBIRCardDescription,
  buildNonBIRCardName,
} from "@/lib/orders/trello";
import {
  buildNonBIRRow,
  parseNonBIROrderRow,
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
  const rows = await getNonBIROrderRows();
  const target = normalize(trackingNumber);
  const index = rows.findIndex(
    (row, rowIndex) => rowIndex > 0 && normalize(String(row[0] || "")) === target,
  );

  if (index === -1) return null;

  return {
    rowNumber: index + 1,
    rawRow: rows[index],
    order: parseNonBIROrderRow(rows[index]),
    cardId: String(rows[index][7] || "").trim(),
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
      return NextResponse.json({ error: "Non-BIR printing order not found." }, { status: 404 });
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
        error: "Failed to load Non-BIR printing order.",
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
      return NextResponse.json({ error: "Non-BIR printing order not found." }, { status: 404 });
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

    const order: NonBIROrder = {
      ...found.order,
      ...body,
      trackingNumber: found.order.trackingNumber,
      businessName: clean(body.businessName),
      salesAssigned: clean(body.salesAssigned) || "-",
      documents,
    };

    const currentCard = await loadTrelloCardForEdit(found.cardId, key, token);
    const expectedName = buildNonBIRCardName(order);
    const expectedSourceDesc = buildNonBIRCardDescription(order);
    const expectedDesc = preserveProductionDescription(currentCard.desc || "", expectedSourceDesc);

    await updateTrelloCardNameAndDescription({
      cardId: found.cardId,
      name: expectedName,
      desc: expectedDesc,
      key,
      token,
    });

    try {
      await updateNonBIROrderRow(
        found.rowNumber,
        buildNonBIRRow(order, found.cardId),
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
      trackingNumber: order.trackingNumber,
      trelloCardId: found.cardId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to update Non-BIR printing order.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
