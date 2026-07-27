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

type TrackerDocument = {
  id: string;
  documentType: string;
  quantity: number;
  quantityText: string;
  serialRange: string;
  paperType: string;
  ply: string;
  size: string;
  specialInstruction: string;
};

const DOCUMENT_SPECIFICATIONS_START =
  "DOCUMENT SPECIFICATIONS START";

const DOCUMENT_SPECIFICATIONS_END =
  "DOCUMENT SPECIFICATIONS END";

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

function clean(input?: string | null) {
  if (!input) {
    return "";
  }

  const trimmed = input.toString().trim();

  if (!trimmed || trimmed === "-") {
    return "";
  }

  return trimmed;
}

function prefer(
  ...values: Array<string | undefined | null>
) {
  return values.map(clean).find(Boolean) || "-";
}

function normalize(input?: string | null) {
  return String(input || "")
    .trim()
    .toUpperCase();
}

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractFirstValue(
  description: string,
  labels: string[],
) {
  for (const label of labels) {
    const escapedLabel = escapeRegExp(label);

    const match = description.match(
      new RegExp(`^${escapedLabel}:\\s*([^\\n]*)`, "im"),
    );

    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return "-";
}

function extractBlockValue(
  block: string,
  labels: string[],
) {
  for (const label of labels) {
    const escapedLabel = escapeRegExp(label);

    const match = block.match(
      new RegExp(`^${escapedLabel}:\\s*([^\\n]*)`, "im"),
    );

    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return "";
}

function extractNumber(input: string) {
  if (!input || input === "-") {
    return 0;
  }

  const normalized = input.replace(/,/g, "");

  const match = normalized.match(/\d+(?:\.\d+)?/);

  return match ? Number(match[0]) : 0;
}

function extractTotalBooklets(input: string) {
  if (!input || input === "-") {
    return 0;
  }

  const normalized = input.replace(
    /(\d),(?=\d{3}\b)/g,
    "$1",
  );

  const numbers = normalized.match(/\d+(?:\.\d+)?/g);

  if (!numbers) {
    return 0;
  }

  return numbers.reduce(
    (total, number) => total + Number(number),
    0,
  );
}

function extractBookletItems(input: string) {
  if (!input || input === "-") {
    return [];
  }

  const normalized = input.replace(
    /(\d),(?=\d{3}\b)/g,
    "$1",
  );

  const numbers = normalized.match(/\d+(?:\.\d+)?/g);

  if (!numbers) {
    return [];
  }

  return numbers.map(Number);
}

function hasLabel(
  card: TrelloCard,
  labelName: string,
) {
  return (
    card.labels?.some(
      (label) =>
        normalize(label.name) === normalize(labelName),
    ) || false
  );
}

function addWorkingDays(
  startDate: Date,
  workingDays: number,
) {
  const date = new Date(startDate);
  let added = 0;

  while (added < workingDays) {
    date.setDate(date.getDate() + 1);

    const day = date.getDay();

    if (day !== 0 && day !== 6) {
      added += 1;
    }
  }

  return date;
}

function calculateDueDate(priority: string) {
  const workingDays =
    priority.toLowerCase() === "rush" ? 3 : 10;

  return addWorkingDays(
    new Date(),
    workingDays,
  )
    .toISOString()
    .split("T")[0];
}

function workingDaysRemaining(dueDate: string) {
  const today = new Date();
  const due = new Date(dueDate);

  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  if (Number.isNaN(due.getTime())) {
    return 0;
  }

  if (due < today) {
    let overdue = 0;
    const cursor = new Date(due);

    while (cursor < today) {
      cursor.setDate(cursor.getDate() + 1);

      const day = cursor.getDay();

      if (day !== 0 && day !== 6) {
        overdue += 1;
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
      remaining += 1;
    }
  }

  return remaining;
}

function extractDocumentSection(description: string) {
  const startIndex = description.indexOf(
    DOCUMENT_SPECIFICATIONS_START,
  );

  const endIndex = description.indexOf(
    DOCUMENT_SPECIFICATIONS_END,
  );

  if (
    startIndex < 0 ||
    endIndex < 0 ||
    endIndex <= startIndex
  ) {
    return "";
  }

  return description.slice(
    startIndex + DOCUMENT_SPECIFICATIONS_START.length,
    endIndex,
  );
}

function parseDocumentSpecifications(
  description: string,
): TrackerDocument[] {
  const section = extractDocumentSection(description);

  if (!section) {
    return [];
  }

  const blocks = section
    .split(/(?=^DOCUMENT\s+\d+\s*$)/gim)
    .map((block) => block.trim())
    .filter((block) =>
      /^DOCUMENT\s+\d+\s*$/im.test(block),
    );

  return blocks.map((block, index) => {
    const quantityText = clean(
      extractBlockValue(block, [
        "QTY",
        "QUANTITY",
        "NO. OF BOOKLETS",
      ]),
    );

    return {
      id:
        clean(extractBlockValue(block, ["ID"])) ||
        `document-${index + 1}`,

      documentType:
        clean(
          extractBlockValue(block, [
            "TYPE",
            "DOCUMENT",
            "RECEIPT TYPE",
          ]),
        ) || `Document ${index + 1}`,

      quantity: extractNumber(quantityText),

      quantityText: quantityText || "-",

      serialRange:
        clean(
          extractBlockValue(block, [
            "SERIAL",
            "SERIAL RANGE",
            "SERIAL NUMBERS",
          ]),
        ) || "-",

      paperType:
        clean(
          extractBlockValue(block, [
            "PAPER",
            "PAPER TYPE",
          ]),
        ) || "-",

      ply:
        clean(extractBlockValue(block, ["PLY"])) ||
        "-",

      size:
        clean(
          extractBlockValue(block, [
            "SIZE",
            "PAPER SIZE",
          ]),
        ) || "-",

      specialInstruction:
        clean(
          extractBlockValue(block, [
            "SPECIAL",
            "SPECIAL INSTRUCTION",
            "SPECIAL INSTRUCTIONS",
          ]),
        ) || "-",
    };
  });
}

function buildLegacyDocuments(
  description: string,
): TrackerDocument[] {
  const receiptType = extractFirstValue(description, [
    "DOCUMENT",
    "DESCRIPTION",
    "RECEIPT TYPE",
    "TYPE OF RECEIPT",
  ]);

  const quantityRaw = extractFirstValue(description, [
    "QTY",
    "QUANTITY",
    "NO. OF BOOKLETS",
  ]);

  const serialRaw = extractFirstValue(description, [
    "SERIAL",
    "SERIAL NUMBERS",
  ]);

  const paperType = extractFirstValue(description, [
    "PAPER",
    "PAPER TYPE",
  ]);

  const ply = extractFirstValue(description, ["PLY"]);

  const size = extractFirstValue(description, [
    "SIZE",
    "PAPER SIZE",
  ]);

  const specialInstruction = extractFirstValue(
    description,
    [
      "SPECIAL INSTRUCTION",
      "SPECIAL INSTRUCTIONS",
      "SPECIAL",
    ],
  );

  const documentTypes = receiptType
    .split(/\s*(?:\/|\||;|\r?\n)\s*/)
    .map(clean)
    .filter(Boolean);

  const quantityItems = extractBookletItems(quantityRaw);

  const serialItems = serialRaw
    .split(/\s*(?:\/|\||;|\r?\n)\s*/)
    .map(clean)
    .filter(Boolean);

  const documentCount = Math.max(
    documentTypes.length,
    quantityItems.length,
    serialItems.length,
    1,
  );

  return Array.from(
    { length: documentCount },
    (_, index) => {
      const quantity =
        quantityItems[index] ??
        (documentCount === 1
          ? extractTotalBooklets(quantityRaw)
          : 0);

      return {
        id: `legacy-document-${index + 1}`,

        documentType:
          documentTypes[index] ||
          documentTypes[0] ||
          `Document ${index + 1}`,

        quantity,

        quantityText:
          quantity > 0 ? String(quantity) : "-",

        serialRange:
          serialItems[index] ||
          (documentCount === 1
            ? serialRaw
            : "-"),

        paperType: prefer(paperType),

        ply: prefer(ply),

        size: prefer(size),

        specialInstruction:
          prefer(specialInstruction),
      };
    },
  );
}

function getTrackerDocuments(description: string) {
  const parsedDocuments =
    parseDocumentSpecifications(description);

  if (parsedDocuments.length > 0) {
    return parsedDocuments;
  }

  return buildLegacyDocuments(description);
}

function summarizeDocumentField(
  documents: TrackerDocument[],
  field:
    | "documentType"
    | "serialRange"
    | "paperType"
    | "ply"
    | "size",
) {
  const values = documents
    .map((document) => clean(document[field]))
    .filter(Boolean);

  const uniqueValues = Array.from(new Set(values));

  if (uniqueValues.length === 0) {
    return "-";
  }

  if (field === "documentType") {
    return uniqueValues.join(" / ");
  }

  if (field === "serialRange") {
    return values.join(" / ");
  }

  if (uniqueValues.length === 1) {
    return uniqueValues[0];
  }

  return "Mixed";
}

function buildTrackerRow(
  card: TrelloCard,
  stationName: string,
) {
  const description = card.desc || "";

  const trackingNo = extractFirstValue(description, [
    "TRACKING",
    "TRACKING NO",
    "TRACKING NUMBER",
  ]);

  const atpId = prefer(
    extractFirstValue(description, [
      "OCN",
      "ATP ID",
    ]),
  );

  const businessName = prefer(
    extractFirstValue(description, ["TRADE NAME"]),
    extractFirstValue(description, [
      "BUSINESS",
      "BUSINESS NAME",
    ]),
  );

  const documents =
    getTrackerDocuments(description);

  const totalBooklets = documents.reduce(
    (total, document) =>
      total + document.quantity,
    0,
  );

  const serial = summarizeDocumentField(
    documents,
    "serialRange",
  );

  const receiptType = summarizeDocumentField(
    documents,
    "documentType",
  );

  const paperType = summarizeDocumentField(
    documents,
    "paperType",
  );

  const ply = summarizeDocumentField(
    documents,
    "ply",
  );

  const size = summarizeDocumentField(
    documents,
    "size",
  );

  const priority = hasLabel(card, "Rush")
    ? "Rush"
    : hasLabel(card, "Normal")
      ? "Normal"
      : prefer(
          extractFirstValue(description, [
            "PRIORITY",
            "ORDER PRIORITY",
          ]),
          "Normal",
        );

  const deliveryStrategy = prefer(
    extractFirstValue(description, [
      "DELIVERY STRATEGY",
    ]),
    "Complete Order",
  );

  const initialReleaseQty = extractNumber(
    extractFirstValue(description, [
      "INITIAL RELEASE QTY",
    ]),
  );

  const initialDueDate = prefer(
    extractFirstValue(description, [
      "INITIAL DUE DATE",
    ]),
    "-",
  );

  const finalDueDate = prefer(
    extractFirstValue(description, [
      "FINAL DUE DATE",
    ]),
    "-",
  );

  const initialCommitmentStatus = prefer(
    extractFirstValue(description, [
      "INITIAL COMMITMENT STATUS",
    ]),
    "-",
  );

  const dueDate = card.due
    ? card.due.split("T")[0]
    : calculateDueDate(priority);

  const isPartial =
    normalize(deliveryStrategy) ===
      normalize("Partial Release") ||
    normalize(deliveryStrategy) === "PARTIAL";

  const initialCompleted =
    normalize(initialCommitmentStatus) ===
    "COMPLETED";

  const currentDueDate = isPartial
    ? initialCompleted
      ? finalDueDate
      : initialDueDate
    : finalDueDate !== "-"
      ? finalDueDate
      : dueDate;

  const processingHours = calculateOrderHours(
    documents.map((document) => ({
      booklets: document.quantity,
      paperType:
        document.paperType === "-"
          ? ""
          : document.paperType,
      ply: document.ply === "-" ? "" : document.ply,
      size:
        document.size === "-" ? "" : document.size,
      priority,
      specialInstruction:
        document.specialInstruction === "-"
          ? ""
          : document.specialInstruction,
    })),
  );

  return {
    id: card.id,
    trackingNo,
    atpId,
    businessName,

    orderQuantity: totalBooklets,

    serial,
    receiptType,
    paperType,
    ply,
    size,

    documentCount: documents.length,
    documents,

    orderPriority: priority,
    currentStation: stationName,

    arrivalDate:
      card.dateLastActivity?.split("T")[0] || "-",

    processingHours,

    deliveryStrategy: isPartial
      ? "Partial Release"
      : "Complete Order",

    initialReleaseQty,
    initialDueDate,
    finalDueDate,
    initialCommitmentStatus,

    currentDueDate,
    dueDate: currentDueDate,

    daysRemaining:
      currentDueDate !== "-"
        ? workingDaysRemaining(currentDueDate)
        : 0,

    url: card.url,
  };
}

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 3,
) {
  let lastError: unknown;

  for (
    let attempt = 1;
    attempt <= retries;
    attempt += 1
  ) {
    try {
      const response = await fetch(url, options);

      if (
        response.ok ||
        response.status < 500
      ) {
        return response;
      }

      lastError = new Error(
        `Trello request failed with status ${response.status}`,
      );
    } catch (error) {
      lastError = error;
    }

    if (attempt < retries) {
      await new Promise((resolve) =>
        setTimeout(resolve, attempt * 500),
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(
        "Trello request failed after retries",
      );
}

export async function GET() {
  const key = process.env.TRELLO_KEY;
  const token = process.env.TRELLO_TOKEN;
  const boardId = process.env.TRELLO_BOARD_ID;

  if (!key || !token || !boardId) {
    return NextResponse.json(
      {
        error:
          "Missing Trello environment variables",
      },
      {
        status: 500,
      },
    );
  }

  let response: Response;

  try {
    response = await fetchWithRetry(
      `https://api.trello.com/1/boards/${boardId}/lists?cards=open&card_fields=name,desc,url,dateLastActivity,due,labels&key=${key}&token=${token}`,
      {
        cache: "no-store",
      },
    );
  } catch (error) {
    console.error(
      "Failed to connect to Trello:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to connect to Trello. Please try again.",
        rows: [],
      },
      {
        status: 503,
      },
    );
  }

  if (!response.ok) {
    return NextResponse.json(
      {
        error: "Failed to fetch Trello data",
      },
      {
        status: response.status,
      },
    );
  }

  const lists =
    (await response.json()) as TrelloList[];

  const rows = lists
    .filter((list) =>
      PRODUCTION_START_STATIONS.some((station) =>
        list.name
          .toUpperCase()
          .includes(station),
      ),
    )
    .flatMap((list) =>
      list.cards.map((card) =>
        buildTrackerRow(card, list.name),
      ),
    );

  rows.sort((a, b) => {
    if (
      a.orderPriority === "Rush" &&
      b.orderPriority !== "Rush"
    ) {
      return -1;
    }

    if (
      a.orderPriority !== "Rush" &&
      b.orderPriority === "Rush"
    ) {
      return 1;
    }

    return a.daysRemaining - b.daysRemaining;
  });

  return NextResponse.json({
    rows,
  });
}