import { NextResponse } from "next/server";

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
  size,
  priority,
}: {
  booklets: number;
  paperType: string;
  ply: string;
  size: string;
  priority: string;
}) {
  let base = booklets * 0.35;

  if (paperType.toLowerCase().includes("carbon")) base *= 1.25;
  if (ply.includes("3")) base *= 1.2;
  if (size === "1/2") base *= 1.35;
  if (size.toLowerCase() === "whole") base *= 2;
  if (priority.toLowerCase() === "rush") base *= 0.75;

  return Number(base.toFixed(3));
}

function calculateDueDate(priority: string, processingHours: number) {
  const today = new Date();

  const daysToAdd =
    priority.toLowerCase() === "rush"
      ? Math.max(3, Math.ceil(processingHours / 8))
      : Math.max(7, Math.ceil(processingHours / 8) + 5);

  today.setDate(today.getDate() + daysToAdd);

  return today.toISOString().split("T")[0];
}

function daysRemaining(dueDate: string) {
  const today = new Date();
  const due = new Date(dueDate);
  const diff = due.getTime() - today.getTime();

  return Math.ceil(diff / (1000 * 60 * 60 * 24));
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
      list.cards
        .filter((card) => {
          const desc = card.desc || "";
          return (
            desc.toUpperCase().includes("PRODUCTION DETAILS") ||
            desc.toUpperCase().includes("STATUS: PRODUCTION DETAILS COMPLETE")
          );
        })
        .map((card): TrackerRow => {
          const desc = card.desc || "";

          const trackingNo = extractValue(desc, ["TRACKING", "TRACKING NO"]);
          const atpId = extractValue(desc, ["OCN", "ATP ID"]);
          const businessName = extractValue(desc, [
            "TRADE NAME",
            "BUSINESS / TRADE NAME",
            "BUSINESS NAME",
          ]);

          const qtyRaw = extractValue(desc, ["QTY", "NO. OF BOOKLETS"]);
          const booklets = extractNumber(qtyRaw);

          const serial = extractValue(desc, ["SERIAL", "SERIAL NUMBERS"]);
          const receiptType = extractValue(desc, [
            "DOCUMENT",
            "RECEIPT TYPE",
            "TYPE OF RECEIPT",
          ]);

          const paperType = extractValue(desc, ["PAPER", "PAPER TYPE"]);
          const ply = extractValue(desc, ["PLY"]);
          const size = extractValue(desc, ["SIZE"]);

          const priority = hasLabel(card, "Rush")
            ? "Rush"
            : hasLabel(card, "Normal")
            ? "Normal"
            : extractValue(desc, ["PRIORITY", "ORDER PRIORITY"]);

          const processingHours = calculateProcessingHours({
            booklets,
            paperType,
            ply,
            size,
            priority,
          });

          const dueDate = card.due
            ? card.due.split("T")[0]
            : calculateDueDate(priority, processingHours);

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
            currentStation: list.name,
            arrivalDate: card.dateLastActivity?.split("T")[0] || "-",
            processingHours,
            dueDate,
            daysRemaining: daysRemaining(dueDate),
            url: card.url,
          };
        })
    );

  rows.sort((a, b) => {
    if (a.orderPriority === "Rush" && b.orderPriority !== "Rush") return -1;
    if (a.orderPriority !== "Rush" && b.orderPriority === "Rush") return 1;
    return a.daysRemaining - b.daysRemaining;
  });

  return NextResponse.json({ rows });
}