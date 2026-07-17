import { formatPHDateTime } from "@/lib/dateTime";
import {
  INITIAL_COMMITMENT_CHECKLIST_NAME,
  INITIAL_RELEASE_ITEM_NAME,
  PARTIAL_ORDER_LABEL_NAME,
  namesMatch,
} from "@/lib/trelloWorkflow";
import {
  appendBIRProductionRecord,
  appendNonBIRProductionRecord,
  calculateProductionTime,
  findBIRProductionRecordByCardId,
  findNonBIRProductionRecordByCardId,
  findReceivedATPByCardId,
  findNonBIROrderByCardId,
} from "@/lib/googleSheets";

type TrelloCard = {
  id: string;
  name: string;
  desc: string;
  idList: string;
  due?: string | null;
  labels?: {
    name: string;
    color: string;
  }[];
};

type TrelloList = {
  id: string;
  name: string;
};

type TrelloAction = {
  date: string;
  data: {
    listAfter?: {
      name: string;
    };
    listBefore?: {
      name: string;
    };
  };
};

type TrelloCheckItem = {
  id: string;
  name: string;
  state: "complete" | "incomplete";
};

type TrelloChecklist = {
  id: string;
  name: string;
  checkItems?: TrelloCheckItem[];
};

type ProductionSyncResult = {
  success: boolean;
  cardsChecked: number;
  checklistsCreated: number;
  dueDatesCreated: number;
  archived: number;
  trelloCardsArchived: number;
  skipped: number;
  errors: string[];
  changed: boolean;
  lastUpdated: string | null;
};

const ARCHIVE_LISTS = ["Delivered by LIC", "Picked Up by Client"];

const PRODUCTION_START_LIST = "Station 1 & 2 (Layouting & Encoding)";
const COMPLETED_LIST = "Finish Receipt";

const AUTO_ARCHIVE_AFTER_DAYS = 7;

function hasCompletedCheckItem(
  checklist: TrelloChecklist,
  itemName: string,
): boolean {
  const normalizedItemName = normalize(itemName);

  return (
    checklist.checkItems?.some(
      (item) =>
        normalize(item.name) === normalizedItemName &&
        item.state === "complete",
    ) ?? false
  );
}

function normalize(value: string): string {
  return value.trim().toUpperCase();
}

function isInList(listName: string, targetLists: string[]): boolean {
  return targetLists.some(
    (target) => normalize(target) === normalize(listName),
  );
}

function getPriorityFromLabels(card: TrelloCard) {
  const hasRush = card.labels?.some(
    (label) => label.name?.toLowerCase() === "rush",
  );

  return hasRush ? "rush" : "normal";
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function calculateDueDateFromStart(startDate: string, workingDays: number) {
  const date = new Date(startDate);

  let addedWorkingDays = 0;

  while (addedWorkingDays < workingDays) {
    date.setDate(date.getDate() + 1);

    if (!isWeekend(date)) {
      addedWorkingDays++;
    }
  }

  return date.toISOString();
}

function formatDateOnly(dateString: string): string {
  return new Date(dateString).toISOString().split("T")[0];
}

function replaceOrAddLine(desc: string, label: string, value: string) {
  const regex = new RegExp(`${label}:.*`, "i");

  if (regex.test(desc)) {
    return desc.replace(regex, `${label}: ${value}`);
  }

  return `${desc.trim()}\n${label}: ${value}`;
}

function extractLineValue(desc: string, label: string) {
  const regex = new RegExp(`${label}:\\s*([^\\n]+)`, "i");
  const match = desc.match(regex);

  return match?.[1]?.trim() || "";
}

function isOlderThanDays(dateString: string, days: number) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return false;

  const diffMs = Date.now() - date.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays >= days;
}

async function archiveTrelloCard(cardId: string, key: string, token: string) {
  const res = await fetch(
    `https://api.trello.com/1/cards/${cardId}?key=${key}&token=${token}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        closed: true,
      }),
    },
  );

  return res.ok;
}

async function getCardMoveActions(cardId: string, key: string, token: string) {
  const res = await fetch(
    `https://api.trello.com/1/cards/${cardId}/actions?filter=updateCard:idList&key=${key}&token=${token}`,
    { cache: "no-store" },
  );

  if (!res.ok) return [];

  return (await res.json()) as TrelloAction[];
}

function findFirstMoveInto(actions: TrelloAction[], listName: string) {
  const sorted = [...actions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const action = sorted.find(
    (item) =>
      item.data.listAfter?.name?.trim().toUpperCase() ===
      listName.trim().toUpperCase(),
  );

  return action?.date || "";
}

async function getCardChecklists(
  cardId: string,
  key: string,
  token: string,
): Promise<TrelloChecklist[]> {
  const res = await fetch(
    `https://api.trello.com/1/cards/${cardId}/checklists?key=${key}&token=${token}`,
    { cache: "no-store" },
  );

  if (!res.ok) {
    throw new Error(`Failed to load checklists for Trello card ${cardId}`);
  }

  return (await res.json()) as TrelloChecklist[];
}

async function isInitialReleaseCompleted(
  cardId: string,
  key: string,
  token: string,
): Promise<boolean> {
  const checklists = await getCardChecklists(cardId, key, token);

  return checklists.some(
    (checklist) =>
      namesMatch(checklist.name, INITIAL_COMMITMENT_CHECKLIST_NAME) &&
      hasCompletedCheckItem(checklist, INITIAL_RELEASE_ITEM_NAME),
  );
}

async function setDueDateIfProductionStarted({
  card,
  currentList,
  key,
  token,
}: {
  card: TrelloCard;
  currentList: string;
  key: string;
  token: string;
}) {
  if (
    isInList(currentList, ARCHIVE_LISTS) ||
    currentList.toUpperCase().includes("INTAKE") ||
    currentList.toUpperCase().includes("STATION 4") ||
    currentList.toUpperCase().includes("TEXT MESSAGING") ||
    currentList.toUpperCase().includes("STATION 3")
  ) {
    return false;
  }

  const actions = await getCardMoveActions(card.id, key, token);

  const station1StartedRaw = findFirstMoveInto(actions, PRODUCTION_START_LIST);

  if (!station1StartedRaw) return false;

  const existingProductionStart = extractLineValue(
    card.desc,
    "PRODUCTION START",
  );

  const deliveryStrategyIsPartial =
    /DELIVERY STRATEGY:\s*Partial Release/i.test(card.desc) ||
    card.labels?.some((label) =>
      namesMatch(label.name, PARTIAL_ORDER_LABEL_NAME),
    ) === true;

  const initialDueMatch = card.desc.match(/INITIAL DUE WD:\s*(\d+)/i);
  const finalDueMatch = card.desc.match(/FINAL DUE WD:\s*(\d+)/i);

  const initialWorkingDays = initialDueMatch ? Number(initialDueMatch[1]) : 10;

  const finalWorkingDays = finalDueMatch
    ? Number(finalDueMatch[1])
    : initialWorkingDays;

  const productionStartForDue =
    existingProductionStart && existingProductionStart !== "Not Started"
      ? existingProductionStart
      : station1StartedRaw;

  const priority = getPriorityFromLabels(card);

  const completeOrderWorkingDays = priority === "rush" ? 3 : finalWorkingDays;

  const initialDueDate = calculateDueDateFromStart(
    productionStartForDue,
    initialWorkingDays,
  );

  const finalDueDate = calculateDueDateFromStart(
    productionStartForDue,
    deliveryStrategyIsPartial ? finalWorkingDays : completeOrderWorkingDays,
  );

  const initialReleaseCompleted = deliveryStrategyIsPartial
    ? await isInitialReleaseCompleted(card.id, key, token)
    : false;

  const trelloDueDate =
    deliveryStrategyIsPartial && !initialReleaseCompleted
      ? initialDueDate
      : finalDueDate;

  let updatedDesc = card.desc;

  const productionStartValue =
    existingProductionStart && existingProductionStart !== "Not Started"
      ? existingProductionStart
      : formatDateOnly(station1StartedRaw);

  updatedDesc = replaceOrAddLine(
    updatedDesc,
    "PRODUCTION START",
    productionStartValue,
  );

  updatedDesc = replaceOrAddLine(
    updatedDesc,
    "INITIAL DUE DATE",
    deliveryStrategyIsPartial ? formatDateOnly(initialDueDate) : "-",
  );

  updatedDesc = replaceOrAddLine(
    updatedDesc,
    "FINAL DUE DATE",
    formatDateOnly(finalDueDate),
  );

  updatedDesc = replaceOrAddLine(
    updatedDesc,
    "INITIAL COMMITMENT STATUS",
    deliveryStrategyIsPartial
      ? initialReleaseCompleted
        ? "Completed"
        : "Pending"
      : "-",
  );

  const currentInitialDue = extractLineValue(card.desc, "INITIAL DUE DATE");

  const currentFinalDue = extractLineValue(card.desc, "FINAL DUE DATE");

  const currentProductionStart = extractLineValue(
    card.desc,
    "PRODUCTION START",
  );

  const currentCommitmentStatus = extractLineValue(
    card.desc,
    "INITIAL COMMITMENT STATUS",
  );

  const expectedInitialDue = deliveryStrategyIsPartial
    ? formatDateOnly(initialDueDate)
    : "-";

  const expectedFinalDue = formatDateOnly(finalDueDate);

  const expectedCommitmentStatus = deliveryStrategyIsPartial
    ? initialReleaseCompleted
      ? "Completed"
      : "Pending"
    : "-";

  const descriptionAlreadyLatest =
    currentProductionStart === productionStartValue &&
    currentInitialDue === expectedInitialDue &&
    currentFinalDue === expectedFinalDue &&
    currentCommitmentStatus === expectedCommitmentStatus;

  const currentDue = card.due ? formatDateOnly(card.due) : "";

  const expectedDue = formatDateOnly(trelloDueDate);

  if (currentDue === expectedDue && descriptionAlreadyLatest) {
    return false;
  }
  const res = await fetch(
    `https://api.trello.com/1/cards/${card.id}?key=${key}&token=${token}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        due: trelloDueDate,
        desc: updatedDesc,
      }),
    },
  );

  return res.ok;
}

let activeProductionSync: Promise<ProductionSyncResult> | null = null;

async function executeProductionSync(): Promise<ProductionSyncResult> {
  const key = process.env.TRELLO_KEY;
  const token = process.env.TRELLO_TOKEN;
  const boardId = process.env.TRELLO_BOARD_ID;

  if (!key || !token || !boardId) {
    throw new Error("Missing Trello environment variables");
  }

  const [listsRes, cardsRes] = await Promise.all([
    fetch(
      `https://api.trello.com/1/boards/${boardId}/lists?key=${key}&token=${token}`,
      { cache: "no-store" },
    ),
    fetch(
      `https://api.trello.com/1/boards/${boardId}/cards?fields=id,name,desc,idList,due,labels&key=${key}&token=${token}`,
      { cache: "no-store" },
    ),
  ]);

  if (!listsRes.ok || !cardsRes.ok) {
    throw new Error("Failed to load Trello board data");
  }

  const lists = (await listsRes.json()) as TrelloList[];
  const cards = (await cardsRes.json()) as TrelloCard[];

  const listMap = new Map(lists.map((list) => [list.id, list.name]));

  const checklistsCreated = 0;
  let dueDatesCreated = 0;
  let archived = 0;
  let trelloCardsArchived = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const card of cards) {
    const currentList = listMap.get(card.idList) || "";

    const dueCreated = await setDueDateIfProductionStarted({
      card,
      currentList,
      key,
      token,
    });

    if (dueCreated) dueDatesCreated++;

    if (isInList(currentList, ARCHIVE_LISTS)) {
      const actions = await getCardMoveActions(card.id, key, token);

      const releasedDateRaw =
        findFirstMoveInto(actions, "Delivered by LIC") ||
        findFirstMoveInto(actions, "Picked Up by Client") ||
        new Date().toISOString();

      const alreadyArchived =
        (await findBIRProductionRecordByCardId(card.id)) ||
        (await findNonBIRProductionRecordByCardId(card.id));

      if (!alreadyArchived) {
        const receivedATP = await findReceivedATPByCardId(card.id);
        const nonBIROrder = await findNonBIROrderByCardId(card.id);

        const productionStartedRaw = findFirstMoveInto(
          actions,
          PRODUCTION_START_LIST,
        );

        const completedDateRaw = findFirstMoveInto(actions, COMPLETED_LIST);

        const productionStarted = productionStartedRaw
          ? formatPHDateTime(productionStartedRaw)
          : "";

        const completedDate = completedDateRaw
          ? formatPHDateTime(completedDateRaw)
          : "";

        const releasedDate = formatPHDateTime(releasedDateRaw);

        const finalStatus = currentList;

        const productionTime =
          productionStarted && completedDate
            ? calculateProductionTime(productionStartedRaw, completedDateRaw)
            : "";

        if (receivedATP) {
          const receivedRow = receivedATP.row;

          const birRowWithoutTimestamp = receivedRow.slice(1);

          const productionRecordRow = [
            ...birRowWithoutTimestamp,
            productionStarted,
            completedDate,
            releasedDate,
            finalStatus,
            productionTime,
          ];

          const birStillNotArchived = !(await findBIRProductionRecordByCardId(
            card.id,
          ));

          if (birStillNotArchived) {
            await appendBIRProductionRecord(productionRecordRow);
            archived++;
          } else {
            skipped++;
          }
        } else if (nonBIROrder) {
          const nonBirRow = nonBIROrder.row;

          const productionRecordRow = [
            nonBirRow[0] || "",
            nonBirRow[2] || "",
            nonBirRow[3] || "",
            nonBirRow[4] || "",
            nonBirRow[5] || "",
            nonBirRow[6] || "",
            nonBirRow[7] || card.id,
            productionStarted,
            completedDate,
            releasedDate,
            finalStatus,
            productionTime,
          ];

          const nonBirStillNotArchived =
            !(await findNonBIRProductionRecordByCardId(card.id));

          if (nonBirStillNotArchived) {
            await appendNonBIRProductionRecord(productionRecordRow);
            archived++;
          } else {
            skipped++;
          }
        } else {
          skipped++;
          errors.push(`No source record found for card: ${card.name}`);
        }
      } else {
        skipped++;
      }

      if (isOlderThanDays(releasedDateRaw, AUTO_ARCHIVE_AFTER_DAYS)) {
        const trelloArchived = await archiveTrelloCard(card.id, key, token);

        if (trelloArchived) {
          trelloCardsArchived++;
        }
      }
    }
  }

  const hasChanges =
    checklistsCreated > 0 ||
    dueDatesCreated > 0 ||
    archived > 0 ||
    trelloCardsArchived > 0;

  return {
    success: true,
    cardsChecked: cards.length,
    checklistsCreated,
    dueDatesCreated,
    archived,
    trelloCardsArchived,
    skipped,
    errors,
    changed: hasChanges,
    lastUpdated: hasChanges ? new Date().toISOString() : null,
  };
}

export async function runProductionSync(): Promise<ProductionSyncResult> {
  if (activeProductionSync) {
    return activeProductionSync;
  }

  activeProductionSync = executeProductionSync();

  try {
    return await activeProductionSync;
  } finally {
    activeProductionSync = null;
  }
}
