import { NextResponse } from "next/server";
import {
  findReceivedATPByCardId,
  findNonBIROrderByCardId,
} from "@/lib/googleSheets";

type RouteContext = {
  params: Promise<{ cardId: string }>;
};

type TrelloLabel = {
  id: string;
  name?: string;
};

type ProductionDetailsPayload = {
  paperType: string;
  ply: string;
  size: string;
  orderPriority: string;
  specialInstructions?: string;
};

function value(data: unknown) {
  const text = String(data || "").trim();
  return text || "-";
}

async function getOrCreatePriorityLabel(
  key: string,
  token: string,
  boardId: string,
  priority: string
) {
  const isRush = priority.toLowerCase() === "rush";
  const labelName = isRush ? "Rush" : "Normal";
  const labelColor = isRush ? "red" : "green";

  const labelsRes = await fetch(
    `https://api.trello.com/1/boards/${boardId}/labels?key=${key}&token=${token}`,
    { cache: "no-store" }
  );

  const labels = (await labelsRes.json()) as TrelloLabel[];

  const existingLabel = labels.find(
    (label) => label.name?.toLowerCase() === labelName.toLowerCase()
  );

  if (existingLabel) return existingLabel.id;

  const createRes = await fetch(
    `https://api.trello.com/1/labels?key=${key}&token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: labelName,
        color: labelColor,
        idBoard: boardId,
      }),
    }
  );

  const newLabel = await createRes.json();
  return newLabel.id;
}

async function removeOldPriorityLabels(
  cardId: string,
  key: string,
  token: string
) {
  const res = await fetch(
    `https://api.trello.com/1/cards/${cardId}/labels?key=${key}&token=${token}`,
    { cache: "no-store" }
  );

  if (!res.ok) return;

  const labels = (await res.json()) as TrelloLabel[];

  for (const label of labels) {
    if (
      label.name?.toLowerCase() === "rush" ||
      label.name?.toLowerCase() === "normal"
    ) {
      await fetch(
        `https://api.trello.com/1/cards/${cardId}/idLabels/${label.id}?key=${key}&token=${token}`,
        { method: "DELETE" }
      );
    }
  }
}

async function resetChecklist(cardId: string, key: string, token: string) {
  const checklistsRes = await fetch(
    `https://api.trello.com/1/cards/${cardId}/checklists?key=${key}&token=${token}`,
    { cache: "no-store" }
  );

  const checklists = await checklistsRes.json();

  for (const checklist of checklists) {
    await fetch(
      `https://api.trello.com/1/checklists/${checklist.id}?key=${key}&token=${token}`,
      { method: "DELETE" }
    );
  }

  const newChecklistRes = await fetch(
    `https://api.trello.com/1/cards/${cardId}/checklists?key=${key}&token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Status" }),
    }
  );

  const checklist = await newChecklistRes.json();

  await fetch(
    `https://api.trello.com/1/checklists/${checklist.id}/checkItems?key=${key}&token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Done" }),
    }
  );
}

export async function PUT(req: Request, context: RouteContext) {
  try {
    const { cardId } = await context.params;
    const body = (await req.json()) as ProductionDetailsPayload;

    const key = process.env.TRELLO_KEY;
    const token = process.env.TRELLO_TOKEN;
    const boardId = process.env.TRELLO_BOARD_ID;
    const station4ListId = process.env.TRELLO_STATION4_LIST_ID;

    if (!key || !token || !boardId || !station4ListId) {
      return NextResponse.json(
        { error: "Missing Trello environment variables." },
        { status: 500 }
      );
    }

    const getCardRes = await fetch(
      `https://api.trello.com/1/cards/${cardId}?fields=name,desc&key=${key}&token=${token}`,
      { cache: "no-store" }
    );

    if (!getCardRes.ok) {
      return NextResponse.json(
        { error: "Card not found.", details: await getCardRes.text() },
        { status: getCardRes.status }
      );
    }

    const card = await getCardRes.json();

    const birRecord = await findReceivedATPByCardId(cardId);
    const nonBirRecord = await findNonBIROrderByCardId(cardId);

    const birRow = birRecord?.row || [];
    const nonBirRow = nonBirRecord?.row || [];

    const isNonBir =
      !!nonBirRecord ||
      String(card.name || "").toUpperCase().includes("NON-BIR") ||
      String(card.name || "").toUpperCase().includes("NON BIR");

    const trackingNo = isNonBir ? value(nonBirRow[0]) : value(birRow[1]);
    const tradeName = isNonBir ? value(nonBirRow[2]) : value(birRow[6]);
    const ocn = isNonBir ? "-" : value(birRow[3]);
    const tin = isNonBir ? "-" : value(birRow[4]);
    const rdo = isNonBir ? "-" : value(birRow[8]);
    const documentType = isNonBir ? value(nonBirRow[3]) : value(birRow[10]);
    const taxType = isNonBir ? "NON-BIR" : value(birRow[11]);
    const atp = isNonBir ? "-" : value(birRow[16]);
    const qty = isNonBir ? value(nonBirRow[4]) : value(birRow[12]);
    const serial = isNonBir ? value(nonBirRow[5]) : value(birRow[15]);

    const compactDescription = `
TRACKING: ${trackingNo}

OCN: ${ocn}
TIN: ${tin}

TRADE NAME: ${tradeName}
RDO: ${rdo}

DOCUMENT: ${documentType}
TAX TYPE: ${taxType}
ATP: ${atp}

QTY: ${qty}
SERIAL: ${serial}

PRIORITY: ${body.orderPriority}

PRODUCTION:
PAPER: ${body.paperType}
PLY: ${body.ply}
SIZE: ${body.size}
SPECIAL: ${body.specialInstructions || "-"}
STATUS: Production Details Complete
`.trim();

    const updateRes = await fetch(
      `https://api.trello.com/1/cards/${cardId}?key=${key}&token=${token}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          desc: compactDescription,
          idList: station4ListId,
        }),
      }
    );

    if (!updateRes.ok) {
      return NextResponse.json(
        {
          error: "Failed to update Trello card.",
          details: await updateRes.text(),
        },
        { status: updateRes.status }
      );
    }

    await removeOldPriorityLabels(cardId, key, token);

    const priorityLabelId = await getOrCreatePriorityLabel(
      key,
      token,
      boardId,
      body.orderPriority
    );

    await fetch(
      `https://api.trello.com/1/cards/${cardId}/idLabels?key=${key}&token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: priorityLabelId }),
      }
    );

    await resetChecklist(cardId, key, token);

    return NextResponse.json({
      success: true,
      card: await updateRes.json(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Server error while saving production details.",
      },
      { status: 500 }
    );
  }
}