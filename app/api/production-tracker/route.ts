import { NextResponse } from "next/server";
import {
  findBIRProductionRecordByCardId,
  findReceivedATPByCardId,
  findNonBIROrderByCardId,
} from "@/lib/googleSheets";

type TrelloLabel = {
  name?: string;
};

type TrelloCard = {
  id: string;
  name: string;
  desc?: string;
  url: string;
  dateLastActivity?: string;
  due?: string | null;
  labels?: TrelloLabel[];
};

type TrelloList = {
  name: string;
  cards: TrelloCard[];
};

type TrackerRow = {
  id: string;
  trackingNo: string;
  atpId: string;
  businessName: string;
  orderQuantity: number;
  serial: string;
  receiptType: string;
  paperType: string;
  ply: string;
  size: string;
  orderPriority: string;
  currentStation: string;
  arrivalDate: string;
  processingHours: number;
  dueDate: string;
  daysRemaining: number;
  url: string;
};

function clean(value?: string | null) {
  if (!value) return "";
  const trimmed = value.toString().trim();
  if (!trimmed || trimmed === "-") return "";
  return trimmed;
}

function prefer(...values: (string | undefined | null)[]) {
  return values.map(clean).find(Boolean) || "-";
}

function extractValue(desc: string, labels: string[]) {
  for (const label of labels) {
    const regex = new RegExp(`${label}:\\s*\\n?([^\\n]+)`, "gi");
    const matches = [...desc.matchAll(regex)];

    if (matches.length > 0) {
      return matches[matches.length - 1][1].trim();
    }
  }

  return "-";
}

function extractNumber(value: string) {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function hasLabel(card: TrelloCard, labelName: string) {
  return (
    card.labels?.some(
      (label) => label.name?.toLowerCase() === labelName.toLowerCase()
    ) || false
  );
}

function calculateProcessingHours({
  booklets,
  paperType,
  ply,
}: {
  booklets: number;
  paperType: string;
  ply: string;
}) {
  let base = Math.max(booklets, 1) * 0.35;

  if (paperType.toLowerCase().includes("carbon")) base *= 1.25;
  if (ply.includes("3")) base *= 1.2;

  return Number(base.toFixed(3));
}

function addWorkingDays(startDate: Date, workingDays: number) {
  const date = new Date(startDate);
  let added = 0;

  while (added < workingDays) {
    date.setDate(date.getDate() + 1);

    const day = date.getDay();

    if (day !== 0 && day !== 6) {
      added++;
    }
  }

  return date;
}

function calculateDueDate(priority: string) {
  const workingDays = priority.toLowerCase() === "rush" ? 3 : 10;
  return addWorkingDays(new Date(), workingDays).toISOString().split("T")[0];
}

function workingDaysRemaining(dueDate: string) {
  const today = new Date();
  const due = new Date(dueDate);

  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  if (due < today) {
    let overdue = 0;
    const cursor = new Date(due);

    while (cursor < today) {
      cursor.setDate(cursor.getDate() + 1);
      const day = cursor.getDay();

      if (day !== 0 && day !== 6) {
        overdue++;
      }
    }

    return overdue * -1;
  }

  let remaining = 0;
  const cursor = new Date(today);

  while (cursor < due) {
    cursor.setDate(cursor.getDate() + 1);
    const day = cursor.getDay();

    if (day !== 0 && day !== 6) {
      remaining++;
    }
  }

  return remaining;
}

const PRODUCTION_START_STATIONS = [
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

async function buildTrackerRow(card: TrelloCard, stationName: string) {
  const desc = card.desc || "";

  const productionRecord = await findBIRProductionRecordByCardId(card.id);
  const receivedATP = await findReceivedATPByCardId(card.id);
  const nonBirOrder = await findNonBIROrderByCardId(card.id);

  const isNonBir =
    !!nonBirOrder ||
    card.name.toUpperCase().includes("NON-BIR") ||
    card.name.toUpperCase().includes("NON BIR");

  const birRow = productionRecord?.row || receivedATP?.row || [];
  const nonBirRow = nonBirOrder?.row || [];

  const trackingNo = isNonBir
    ? prefer(
        nonBirRow[0],
        extractValue(desc, ["TRACKING", "TRACKING NO", "TRACKING NUMBER"])
      )
    : prefer(
        birRow[1],
        birRow[0],
        extractValue(desc, ["TRACKING", "TRACKING NO", "TRACKING NUMBER"])
      );

  const atpId = isNonBir
    ? "-"
    : prefer(birRow[3], birRow[2], extractValue(desc, ["OCN", "ATP ID"]));

  const businessName = isNonBir
    ? prefer(
        nonBirRow[2],
        extractValue(desc, ["BUSINESS", "BUSINESS NAME", "TRADE NAME"])
      )
    : prefer(
        birRow[6],
        birRow[5],
        extractValue(desc, [
          "TRADE NAME",
          "BUSINESS / TRADE NAME",
          "BUSINESS NAME",
        ])
      );

  const qtyRaw = isNonBir
    ? prefer(
        nonBirRow[4],
        extractValue(desc, ["QTY", "QUANTITY", "NO. OF BOOKLETS"])
      )
    : prefer(
        birRow[12],
        birRow[11],
        extractValue(desc, ["QTY", "QUANTITY", "NO. OF BOOKLETS"])
      );

  const booklets = extractNumber(qtyRaw);

  const serial = isNonBir
    ? prefer(nonBirRow[5], extractValue(desc, ["SERIAL", "SERIAL NUMBERS"]))
    : prefer(
        birRow[15],
        birRow[14],
        extractValue(desc, ["SERIAL", "SERIAL NUMBERS"])
      );

  const receiptType = isNonBir
    ? prefer(nonBirRow[3], extractValue(desc, ["DOCUMENT", "DESCRIPTION"]))
    : prefer(
        birRow[10],
        birRow[9],
        extractValue(desc, ["DOCUMENT", "RECEIPT TYPE", "TYPE OF RECEIPT"])
      );

  const paperType = prefer(
    extractValue(desc, ["PAPER", "PAPER TYPE"]),
    birRow[19]
  );

  const ply = prefer(extractValue(desc, ["PLY"]), birRow[20]);

  const size = prefer(extractValue(desc, ["SIZE", "PAPER SIZE"]), birRow[21]);

  const priority = hasLabel(card, "Rush")
    ? "Rush"
    : hasLabel(card, "Normal")
    ? "Normal"
    : prefer(
        extractValue(desc, ["PRIORITY", "ORDER PRIORITY"]),
        birRow[22],
        "Normal"
      );

  const processingHours = calculateProcessingHours({
    booklets,
    paperType,
    ply,
  });

  const dueDate = card.due ? card.due.split("T")[0] : calculateDueDate(priority);

  return {
    id: card.id,
    trackingNo,
    atpId,
    businessName,
    orderQuantity: booklets,
    serial,
    receiptType,
    paperType,
    ply,
    size,
    orderPriority: priority,
    currentStation: stationName,
    arrivalDate: card.dateLastActivity?.split("T")[0] || "-",
    processingHours,
    dueDate,
    daysRemaining: workingDaysRemaining(dueDate),
    url: card.url,
  };
}

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
    `https://api.trello.com/1/boards/${boardId}/lists?cards=open&card_fields=name,desc,url,dateLastActivity,due,labels&key=${key}&token=${token}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to fetch Trello data" },
      { status: res.status }
    );
  }

  const lists = (await res.json()) as TrelloList[];

  const cardsInProduction = lists
    .filter((list) =>
      PRODUCTION_START_STATIONS.some((station) =>
        list.name.toUpperCase().includes(station)
      )
    )
    .flatMap((list) =>
      list.cards.map((card) => ({
        card,
        stationName: list.name,
      }))
    );

  const rows = await Promise.all(
    cardsInProduction.map(({ card, stationName }) =>
      buildTrackerRow(card, stationName)
    )
  );

  rows.sort((a, b) => {
    if (a.orderPriority === "Rush" && b.orderPriority !== "Rush") return -1;
    if (a.orderPriority !== "Rush" && b.orderPriority === "Rush") return 1;
    return a.daysRemaining - b.daysRemaining;
  });

  return NextResponse.json({ rows });
}