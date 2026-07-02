import { NextResponse } from "next/server";
import { appendNonBIROrderRow } from "@/lib/googleSheets";

type NonBIROrderPayload = {
  trackingNumber: string;
  dateReceived: string;
  businessName: string;
  description: string;
  booklets: string;
  serialNumbers: string;
  salesAssigned: string;
};

function generateTrackingNumber() {
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let random = "";

  for (let i = 0; i < 6; i++) {
    random += chars[Math.floor(Math.random() * chars.length)];
  }

  return `NB${year}${month}${day}${random}`;
}

function formatDateForTitle(dateString: string) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return dateString.toUpperCase();
  }

  return date
    .toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as NonBIROrderPayload;

    const key = process.env.TRELLO_KEY;
    const token = process.env.TRELLO_TOKEN;
    const intakeListId = process.env.TRELLO_NON_BIR_INTAKE_LIST_ID;

    if (!key || !token || !intakeListId) {
      return NextResponse.json(
        { error: "Missing Trello environment variables." },
        { status: 500 }
      );
    }

    const trackingNumber = body.trackingNumber || generateTrackingNumber();

    const cardName = `(AY) ${body.businessName}
${body.description}-${body.booklets}
${formatDateForTitle(body.dateReceived)}
(NON-BIR)`;

    const cardDesc = `
Tracking Number
${trackingNumber}

Business
${body.businessName}

Description
${body.description}

Booklets
${body.booklets}

Serial Numbers
${body.serialNumbers || "-"}

Sales Assigned
${body.salesAssigned || "-"}

Order Type
NON-BIR
`.trim();

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
      }
    );

    if (!trelloRes.ok) {
      return NextResponse.json(
        {
          error: "Failed to create Trello card.",
          details: await trelloRes.text(),
        },
        { status: trelloRes.status }
      );
    }

    const trelloCard = await trelloRes.json();

    await appendNonBIROrderRow([
      trackingNumber,
      body.dateReceived,
      body.businessName,
      body.description,
      body.booklets,
      body.serialNumbers || "",
      body.salesAssigned || "",
      trelloCard.id,
    ]);

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
      { status: 500 }
    );
  }
}