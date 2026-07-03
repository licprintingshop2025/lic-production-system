import { formatPHDateTime } from "@/lib/dateTime";
import { NextResponse } from "next/server";
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

const CHECKLIST_REQUIRED_LISTS = ["Finish Receipt", "Ready for Release"];

const ARCHIVE_LISTS = ["Delivered by LIC", "Picked Up by Client"];

const PRODUCTION_START_LIST = "Station 1 & 2 (Layouting & Encoding)";
const COMPLETED_LIST = "Finish Receipt";

const AUTO_ARCHIVE_AFTER_DAYS = 7;

function normalize(value: string) {
  return value.trim().toUpperCase();
}

function isInList(listName: string, targetLists: string[]) {
  return targetLists.some((target) => normalize(target) === normalize(listName));
}

function getPriorityFromLabels(card: TrelloCard) {
  const hasRush = card.labels?.some(
    (label) => label.name?.toLowerCase() === "rush"
  );

  return hasRush ? "rush" : "normal";
}

function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function calculateDueDateFromStart(startDate: string, priority: string) {
  const date = new Date(startDate);
  const workingDaysToAdd = priority.toLowerCase() === "rush" ? 3 : 10;

  let addedWorkingDays = 0;

  while (addedWorkingDays < workingDaysToAdd) {
    date.setDate(date.getDate() + 1);

    if (!isWeekend(date)) {
      addedWorkingDays++;
    }
  }

  return date.toISOString();
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
    }
  );

  return res.ok;
}

async function getCardMoveActions(cardId: string, key: string, token: string) {
  const res = await fetch(
    `https://api.trello.com/1/cards/${cardId}/actions?filter=updateCard:idList&key=${key}&token=${token}`,
    { cache: "no-store" }
  );

  if (!res.ok) return [];

  return (await res.json()) as TrelloAction[];
}

function findFirstMoveInto(actions: TrelloAction[], listName: string) {
  const sorted = [...actions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const action = sorted.find(
    (item) =>
      item.data.listAfter?.name?.trim().toUpperCase() ===
      listName.trim().toUpperCase()
  );

  return action?.date || "";
}

async function getCardChecklists(cardId: string, key: string, token: string) {
  const res = await fetch(
    `https://api.trello.com/1/cards/${cardId}/checklists?key=${key}&token=${token}`,
    { cache: "no-store" }
  );

  if (!res.ok) return [];

  return res.json();
}

async function ensureStatusChecklist(cardId: string, key: string, token: string) {
  const checklists = await getCardChecklists(cardId, key, token);

  const hasStatusChecklist = checklists.some(
    (checklist: { name: string }) => checklist.name.toUpperCase() === "STATUS"
  );

  if (hasStatusChecklist) return false;

  const createChecklistRes = await fetch(
    `https://api.trello.com/1/checklists?key=${key}&token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idCard: cardId,
        name: "Status",
      }),
    }
  );

  if (!createChecklistRes.ok) return false;

  const checklist = await createChecklistRes.json();

  await fetch(
    `https://api.trello.com/1/checklists/${checklist.id}/checkItems?key=${key}&token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Done",
        checked: false,
      }),
    }
  );

  return true;
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
  if (!isInList(currentList, [PRODUCTION_START_LIST])) return false;
  if (card.due) return false;

  const actions = await getCardMoveActions(card.id, key, token);

  const station1StartedRaw =
    findFirstMoveInto(actions, PRODUCTION_START_LIST) || new Date().toISOString();

  const priority = getPriorityFromLabels(card);
  const dueDate = calculateDueDateFromStart(station1StartedRaw, priority);

  const res = await fetch(
    `https://api.trello.com/1/cards/${card.id}?key=${key}&token=${token}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        due: dueDate,
      }),
    }
  );

  return res.ok;
}

export async function GET() {
  try {
    const key = process.env.TRELLO_KEY;
    const token = process.env.TRELLO_TOKEN;
    const boardId = process.env.TRELLO_BOARD_ID;

    if (!key || !token || !boardId) {
      return NextResponse.json(
        { error: "Missing Trello environment variables" },
        { status: 500 }
      );
    }

    const [listsRes, cardsRes] = await Promise.all([
      fetch(
        `https://api.trello.com/1/boards/${boardId}/lists?key=${key}&token=${token}`,
        { cache: "no-store" }
      ),
      fetch(
        `https://api.trello.com/1/boards/${boardId}/cards?fields=id,name,desc,idList,due,labels&key=${key}&token=${token}`,
        { cache: "no-store" }
      ),
    ]);

    if (!listsRes.ok || !cardsRes.ok) {
      return NextResponse.json(
        { error: "Failed to load Trello board data" },
        { status: 500 }
      );
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
            PRODUCTION_START_LIST
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
              ? calculateProductionTime(productionStarted, completedDate)
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

            await appendBIRProductionRecord(productionRecordRow);
            archived++;
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

            await appendNonBIRProductionRecord(productionRecordRow);
            archived++;
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

    return NextResponse.json({
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
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Production sync failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}