import { NextResponse } from "next/server";
import { calculateOrderHours } from "@/lib/production/calculator";

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
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const regex = new RegExp(
      `^${escapedLabel}:\\s*([^\\n]+)`,
      "gim"
    );

    const matches = [...desc.matchAll(regex)];

    if (matches.length > 0) {
      return matches[matches.length - 1][1].trim();
    }
  }

  return "-";
}

function extractTotalBooklets(value: string) {
  if (!value || value === "-") return 0;

  const numbers = value.match(/\d+/g);

  if (!numbers) return 0;

  return numbers.reduce((total, number) => total + Number(number), 0);
}

function extractBookletItems(value: string) {
  const numbers = value.match(/\d+/g);
  if (!numbers) return [];

  return numbers.map((number) => Number(number));
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

  if (Number.isNaN(due.getTime())) return 0;

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

function buildTrackerRow(card: TrelloCard, stationName: string) {
  const desc = card.desc || "";

  const trackingNo = extractValue(desc, [
    "TRACKING",
    "TRACKING NO",
    "TRACKING NUMBER",
  ]);

  const atpId = prefer(extractValue(desc, ["OCN", "ATP ID"]));

  const businessName = prefer(
    extractValue(desc, ["TRADE NAME"]),
    extractValue(desc, ["BUSINESS", "BUSINESS NAME"])
  );

  const qtyRaw = extractValue(desc, ["QTY", "QUANTITY", "NO. OF BOOKLETS"]);
  const booklets = extractTotalBooklets(qtyRaw);

  const serial = extractValue(desc, ["SERIAL", "SERIAL NUMBERS"]);

  const receiptType = extractValue(desc, [
    "DOCUMENT",
    "DESCRIPTION",
    "RECEIPT TYPE",
    "TYPE OF RECEIPT",
  ]);

  const paperType = extractValue(desc, ["PAPER", "PAPER TYPE"]);

  const ply = extractValue(desc, ["PLY"]);

  const size = extractValue(desc, ["SIZE", "PAPER SIZE"]);

  const priority = hasLabel(card, "Rush")
    ? "Rush"
    : hasLabel(card, "Normal")
    ? "Normal"
    : prefer(extractValue(desc, ["PRIORITY", "ORDER PRIORITY"]), "Normal");

  const specialInstruction =
    extractValue(desc, [
      "SPECIAL INSTRUCTION",
      "SPECIAL INSTRUCTIONS",
      "SPECIAL",
    ]) || "";

  const deliveryStrategy = prefer(
    extractValue(desc, ["DELIVERY STRATEGY"]),
    "Complete Order"
  );

  const initialReleaseQty = extractNumber(
    extractValue(desc, ["INITIAL RELEASE QTY"])
  );

  const initialDueDate = prefer(extractValue(desc, ["INITIAL DUE DATE"]), "-");

  const finalDueDate = prefer(extractValue(desc, ["FINAL DUE DATE"]), "-");

  const initialCommitmentStatus = prefer(
    extractValue(desc, ["INITIAL COMMITMENT STATUS"]),
    "-"
  );

  const dueDate = card.due ? card.due.split("T")[0] : calculateDueDate(priority);

  const currentDueDate =
    deliveryStrategy === "Partial Release"
      ? initialCommitmentStatus === "Completed"
        ? finalDueDate
        : initialDueDate
      : dueDate;

  const bookletItems = extractBookletItems(qtyRaw);

  const processingHours = calculateOrderHours(
    bookletItems.length > 0
      ? bookletItems.map((qty) => ({
          booklets: qty,
          paperType,
          ply,
          size,
          priority,
          specialInstruction,
        }))
      : [
          {
            booklets,
            paperType,
            ply,
            size,
            priority,
            specialInstruction,
          },
        ]
  );

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
    deliveryStrategy,
    initialReleaseQty,
    initialDueDate,
    finalDueDate,
    initialCommitmentStatus,
    currentDueDate,
    dueDate: currentDueDate,
    daysRemaining: currentDueDate !== "-" ? workingDaysRemaining(currentDueDate) : 0,
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

  const rows = lists
    .filter((list) =>
      PRODUCTION_START_STATIONS.some((station) =>
        list.name.toUpperCase().includes(station)
      )
    )
    .flatMap((list) =>
      list.cards.map((card) => buildTrackerRow(card, list.name))
    );

  rows.sort((a, b) => {
    if (a.orderPriority === "Rush" && b.orderPriority !== "Rush") return -1;
    if (a.orderPriority !== "Rush" && b.orderPriority === "Rush") return 1;
    return a.daysRemaining - b.daysRemaining;
  });

  return NextResponse.json({ rows });
}