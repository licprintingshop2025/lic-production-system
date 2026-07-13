import { formatPHDateTime } from "@/lib/dateTime";
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

const CHECKLIST_REQUIRED_LISTS = ["Finish Receipt", "Ready for Release"];

const ARCHIVE_LISTS = ["Delivered by LIC", "Picked Up by Client"];

const PRODUCTION_START_LIST = "Station 1 & 2 (Layouting & Encoding)";
const COMPLETED_LIST = "Finish Receipt";

const AUTO_ARCHIVE_AFTER_DAYS = 7;

function findChecklistsByName(
  checklists: TrelloChecklist[],
  name: string,
): TrelloChecklist[] {
  const normalizedName = normalize(name);

  return checklists.filter(
    (checklist) => normalize(checklist.name) === normalizedName,
  );
}

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

function chooseChecklistToKeep(
  checklists: TrelloChecklist[],
  completedItemName: string,
  preferredChecklistId?: string,
): TrelloChecklist {
  const completedChecklist = checklists.find((checklist) =>
    hasCompletedCheckItem(checklist, completedItemName),
  );

  if (completedChecklist) {
    return completedChecklist;
  }

  if (preferredChecklistId) {
    const preferredChecklist = checklists.find(
      (checklist) => checklist.id === preferredChecklistId,
    );

    if (preferredChecklist) {
      return preferredChecklist;
    }
  }

  return checklists[0];
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

async function deleteChecklist(
  checklistId: string,
  key: string,
  token: string,
): Promise<void> {
  const res = await fetch(
    `https://api.trello.com/1/checklists/${checklistId}?key=${key}&token=${token}`,
    {
      method: "DELETE",
    },
  );

  if (!res.ok) {
    throw new Error(
      `Failed to delete duplicate Trello checklist ${checklistId}`,
    );
  }
}

async function deleteDuplicateChecklists(
  checklists: TrelloChecklist[],
  checklistToKeep: TrelloChecklist,
  key: string,
  token: string,
): Promise<void> {
  const duplicates = checklists.filter(
    (checklist) => checklist.id !== checklistToKeep.id,
  );

  for (const duplicate of duplicates) {
    await deleteChecklist(duplicate.id, key, token);
  }
}

async function ensureStatusChecklist(
  cardId: string,
  key: string,
  token: string,
): Promise<boolean> {
  const existingChecklists = await getCardChecklists(cardId, key, token);

  const matchingChecklists = findChecklistsByName(existingChecklists, "Status");

  if (matchingChecklists.length > 1) {
    const checklistToKeep = chooseChecklistToKeep(matchingChecklists, "Done");

    await deleteDuplicateChecklists(
      matchingChecklists,
      checklistToKeep,
      key,
      token,
    );

    return false;
  }

  if (matchingChecklists.length === 1) {
    return false;
  }

  const createChecklistRes = await fetch(
    `https://api.trello.com/1/checklists?key=${key}&token=${token}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idCard: cardId,
        name: "Status",
      }),
    },
  );

  if (!createChecklistRes.ok) {
    throw new Error(`Failed to create Status checklist for card ${cardId}`);
  }

  const createdChecklist = (await createChecklistRes.json()) as TrelloChecklist;

  const createItemRes = await fetch(
    `https://api.trello.com/1/checklists/${createdChecklist.id}/checkItems?key=${key}&token=${token}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Done",
        checked: false,
      }),
    },
  );

  if (!createItemRes.ok) {
    throw new Error(
      `Status checklist was created, but the Done item could not be created for card ${cardId}`,
    );
  }

  const verifiedChecklists = await getCardChecklists(cardId, key, token);

  const verifiedMatches = findChecklistsByName(verifiedChecklists, "Status");

  if (verifiedMatches.length > 1) {
    const checklistToKeep = chooseChecklistToKeep(
      verifiedMatches,
      "Done",
      createdChecklist.id,
    );

    await deleteDuplicateChecklists(
      verifiedMatches,
      checklistToKeep,
      key,
      token,
    );
  }

  return true;
}

async function ensureInitialCommitmentChecklist(
  card: TrelloCard,
  key: string,
  token: string,
): Promise<boolean> {
  const isPartial = /DELIVERY STRATEGY:\s*Partial Release/i.test(card.desc);

  if (!isPartial) {
    return false;
  }

  const existingChecklists = await getCardChecklists(card.id, key, token);

  const matchingChecklists = findChecklistsByName(
    existingChecklists,
    "Initial Commitment",
  );

  if (matchingChecklists.length > 1) {
    const checklistToKeep = chooseChecklistToKeep(
      matchingChecklists,
      "Initial Release Completed",
    );

    await deleteDuplicateChecklists(
      matchingChecklists,
      checklistToKeep,
      key,
      token,
    );

    return false;
  }

  if (matchingChecklists.length === 1) {
    return false;
  }

  const createChecklistRes = await fetch(
    `https://api.trello.com/1/checklists?key=${key}&token=${token}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idCard: card.id,
        name: "Initial Commitment",
      }),
    },
  );

  if (!createChecklistRes.ok) {
    throw new Error(
      `Failed to create Initial Commitment checklist for card ${card.id}`,
    );
  }

  const createdChecklist = (await createChecklistRes.json()) as TrelloChecklist;

  const createItemRes = await fetch(
    `https://api.trello.com/1/checklists/${createdChecklist.id}/checkItems?key=${key}&token=${token}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Initial Release Completed",
        checked: false,
      }),
    },
  );

  if (!createItemRes.ok) {
    throw new Error(
      `Checklist was created, but its item could not be created for card ${card.id}`,
    );
  }

  const verifiedChecklists = await getCardChecklists(card.id, key, token);

  const verifiedMatches = findChecklistsByName(
    verifiedChecklists,
    "Initial Commitment",
  );

  if (verifiedMatches.length > 1) {
    const checklistToKeep = chooseChecklistToKeep(
      verifiedMatches,
      "Initial Release Completed",
      createdChecklist.id,
    );

    await deleteDuplicateChecklists(
      verifiedMatches,
      checklistToKeep,
      key,
      token,
    );
  }

  return true;
}

async function isInitialCommitmentCompleted(
  cardId: string,
  key: string,
  token: string,
): Promise<boolean> {
  const checklists = await getCardChecklists(cardId, key, token);

  return checklists.some(
    (checklist) =>
      normalize(checklist.name) === "INITIAL COMMITMENT" &&
      hasCompletedCheckItem(checklist, "Initial Release Completed"),
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
    /DELIVERY STRATEGY:\s*Partial Release/i.test(card.desc);

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

  const initialCommitmentCompleted = deliveryStrategyIsPartial
    ? await isInitialCommitmentCompleted(card.id, key, token)
    : false;

  const trelloDueDate =
    deliveryStrategyIsPartial && !initialCommitmentCompleted
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
      ? initialCommitmentCompleted
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
    ? initialCommitmentCompleted
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

  let checklistsCreated = 0;
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

    if (isInList(currentList, [PRODUCTION_START_LIST])) {
      const created = await ensureInitialCommitmentChecklist(card, key, token);
      if (created) checklistsCreated++;
    }

    if (isInList(currentList, CHECKLIST_REQUIRED_LISTS)) {
      const created = await ensureStatusChecklist(card.id, key, token);
      if (created) checklistsCreated++;
    }

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
