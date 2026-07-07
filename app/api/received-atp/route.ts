import { NextResponse } from "next/server";
import { appendReceivedATPRow } from "@/lib/googleSheets";
import { generateTrackingNumber } from "@/lib/tracking";
import type { ReceivedATPOrder } from "@/lib/orders/types";
import { normalizeDocuments } from "@/lib/orders/utils";
import {
  buildReceivedATPCardDescription,
  buildReceivedATPCardName,
} from "@/lib/orders/trello";
import { buildReceivedATPRow } from "@/lib/orders/sheets";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const key = process.env.TRELLO_KEY;
    const token = process.env.TRELLO_TOKEN;
    const listId = process.env.TRELLO_ATP_INTAKE_LIST_ID;

    if (!key || !token || !listId) {
      return NextResponse.json(
        { error: "Missing Trello environment variables" },
        { status: 500 }
      );
    }

    const trackingNo = generateTrackingNumber();
    const documents = normalizeDocuments(body.documents);

    if (documents.length === 0) {
      return NextResponse.json(
        { error: "Please add at least one document." },
        { status: 400 }
      );
    }

    const order: ReceivedATPOrder = {
      ...body,
      trackingNo,
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
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      return NextResponse.json(
        { error: "Failed to create Trello card", details: errorText },
        { status: response.status }
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
        { status: 500 }
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
      { status: 500 }
    );
  }
}