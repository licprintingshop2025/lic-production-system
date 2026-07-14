import { NextResponse } from "next/server";
import { appendNonBIROrderRow } from "@/lib/googleSheets";
import { generateTrackingNumber } from "@/lib/tracking";
import type { NonBIROrder } from "@/lib/orders/types";
import { clean, normalizeDocuments } from "@/lib/orders/utils";
import {
  buildNonBIRCardDescription,
  buildNonBIRCardName,
} from "@/lib/orders/trello";
import { buildNonBIRRow } from "@/lib/orders/sheets";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const key = process.env.TRELLO_KEY;
    const token = process.env.TRELLO_TOKEN;
    const intakeListId = process.env.TRELLO_NON_BIR_INTAKE_LIST_ID;

    if (!key || !token || !intakeListId) {
      return NextResponse.json(
        { error: "Missing Trello environment variables." },
        { status: 500 },
      );
    }

    const trackingNumber = body.trackingNumber || generateTrackingNumber();
    const documents = normalizeDocuments(body.documents);

    if (documents.length === 0) {
      return NextResponse.json(
        { error: "Please add at least one document." },
        { status: 400 },
      );
    }

    const order: NonBIROrder = {
      ...body,
      trackingNumber,
      businessName: clean(body.businessName),
      salesAssigned: clean(body.salesAssigned) || "-",
      documents,
    };

    const cardName = buildNonBIRCardName(order);
    const cardDesc = buildNonBIRCardDescription(order);

    const trelloRes = await fetch(
      `https://api.trello.com/1/cards?key=${key}&token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idList: intakeListId,
          name: cardName,
          desc: cardDesc,
        }),
      },
    );

    if (!trelloRes.ok) {
      return NextResponse.json(
        {
          error: "Failed to create Trello card.",
          details: await trelloRes.text(),
        },
        { status: trelloRes.status },
      );
    }

    const trelloCard = await trelloRes.json();

    await appendNonBIROrderRow(buildNonBIRRow(order, trelloCard.id));

    return NextResponse.json({
      success: true,
      trackingNumber,
      trelloCardId: trelloCard.id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save Non-BIR order.",
      },
      { status: 500 },
    );
  }
}
