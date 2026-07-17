import { NextResponse } from "next/server";
import {
  findNonBIROrderByCardId,
  findReceivedATPByCardId,
} from "@/lib/googleSheets";
import {
  DONE_ITEM_NAME,
  INITIAL_COMMITMENT_CHECKLIST_NAME,
  INITIAL_RELEASE_ITEM_NAME,
  PARTIAL_ORDER_LABEL_COLOR,
  PARTIAL_ORDER_LABEL_NAME,
  STATUS_CHECKLIST_NAME,
  type DeliveryStrategy,
} from "@/lib/trelloWorkflow";

type RouteContext = {
  params: Promise<{ cardId: string }>;
};

type TrelloLabel = {
  id: string;
  name?: string;
};

type TrelloCard = {
  id: string;
  name: string;
  desc?: string;
};

type TrelloAction = {
  date: string;
  data: {
    listAfter?: {
      name: string;
    };
  };
};

type ChecklistItem = {
  id: string;
  name: string;
  state: "complete" | "incomplete";
};

type Checklist = {
  id: string;
  name: string;
  checkItems: ChecklistItem[];
};

type ProductionDetailsPayload = {
  paperType: string;
  ply: string;
  size: string;
  orderPriority: string;
  specialInstructions?: string;

  deliveryStrategy: DeliveryStrategy;
  initialReleaseQty?: string;
  initialDueWorkingDays?: string;
  finalDueWorkingDays?: string;
};

const PRODUCTION_START_LIST = "Station 1 & 2 (Layouting & Encoding)";

function value(data: unknown) {
  const text = String(data || "").trim();
  return text || "-";
}

function normalize(text: string | undefined) {
  return String(text || "")
    .trim()
    .toUpperCase();
}

function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function addWorkingDays(startDate: Date, workingDays: number) {
  const date = new Date(startDate);
  let added = 0;

  while (added < workingDays) {
    date.setDate(date.getDate() + 1);

    if (!isWeekend(date)) {
      added += 1;
    }
  }

  return date;
}

function formatDateOnly(date: Date) {
  return date.toISOString().split("T")[0];
}

function findFirstMoveInto(actions: TrelloAction[], listName: string) {
  const sorted = [...actions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const action = sorted.find(
    (item) => normalize(item.data.listAfter?.name) === normalize(listName),
  );

  return action?.date || "";
}

function getDeliveryLabel(strategy: DeliveryStrategy) {
  return strategy === "PARTIAL" ? "Partial Release" : "Complete Order";
}

function toPositiveNumber(input: string | undefined, fallback: number) {
  const number = Number(input);

  if (!Number.isFinite(number) || number <= 0) {
    return fallback;
  }

  return number;
}

function isStatusChecklist(checklist: Checklist) {
  return normalize(checklist.name) === normalize(STATUS_CHECKLIST_NAME);
}

function findItemsByName(checklist: Checklist, itemName: string) {
  return checklist.checkItems.filter(
    (item) => normalize(item.name) === normalize(itemName),
  );
}

function hasItem(checklist: Checklist, itemName: string) {
  return findItemsByName(checklist, itemName).length > 0;
}

function chooseChecklistPreferCompleted(
  checklists: Checklist[],
  itemName: string,
) {
  const completedChecklist = checklists.find((checklist) =>
    findItemsByName(checklist, itemName).some(
      (item) => item.state === "complete",
    ),
  );

  if (completedChecklist) {
    return completedChecklist;
  }

  return [...checklists].sort((a, b) => a.id.localeCompare(b.id))[0];
}

async function trelloRequest<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
  });

  if (!response.ok) {
    const details = await response.text();

    throw new Error(`Trello request failed (${response.status}): ${details}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function getCardMoveActions(cardId: string, key: string, token: string) {
  const response = await fetch(
    `https://api.trello.com/1/cards/${cardId}/actions?filter=updateCard:idList&key=${key}&token=${token}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return [];
  }

  return (await response.json()) as TrelloAction[];
}

async function getBoardLabels(key: string, token: string, boardId: string) {
  return trelloRequest<TrelloLabel[]>(
    `https://api.trello.com/1/boards/${boardId}/labels?key=${key}&token=${token}`,
  );
}

async function getCardLabels(cardId: string, key: string, token: string) {
  return trelloRequest<TrelloLabel[]>(
    `https://api.trello.com/1/cards/${cardId}/labels?key=${key}&token=${token}`,
  );
}

async function createBoardLabel(
  key: string,
  token: string,
  boardId: string,
  name: string,
  color: string,
) {
  return trelloRequest<TrelloLabel>(
    `https://api.trello.com/1/labels?key=${key}&token=${token}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        color,
        idBoard: boardId,
      }),
    },
  );
}

async function getOrCreateLabel(
  key: string,
  token: string,
  boardId: string,
  labelName: string,
  labelColor: string,
) {
  const labels = await getBoardLabels(key, token, boardId);

  const existingLabel = labels.find(
    (label) => normalize(label.name) === normalize(labelName),
  );

  if (existingLabel) {
    return existingLabel.id;
  }

  const createdLabel = await createBoardLabel(
    key,
    token,
    boardId,
    labelName,
    labelColor,
  );

  return createdLabel.id;
}

async function getOrCreatePriorityLabel(
  key: string,
  token: string,
  boardId: string,
  priority: string,
) {
  const isRush = priority.trim().toLowerCase() === "rush";

  return getOrCreateLabel(
    key,
    token,
    boardId,
    isRush ? "Rush" : "Normal",
    isRush ? "red" : "green",
  );
}

async function getOrCreatePartialOrderLabel(
  key: string,
  token: string,
  boardId: string,
) {
  return getOrCreateLabel(
    key,
    token,
    boardId,
    PARTIAL_ORDER_LABEL_NAME,
    PARTIAL_ORDER_LABEL_COLOR,
  );
}

async function addLabelToCard(
  cardId: string,
  labelId: string,
  key: string,
  token: string,
) {
  const response = await fetch(
    `https://api.trello.com/1/cards/${cardId}/idLabels?key=${key}&token=${token}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        value: labelId,
      }),
    },
  );

  if (response.ok) {
    return;
  }

  /*
   * Some overlapping requests may try to add the same label.
   * Verify the final card state before reporting a failure.
   */
  const currentLabels = await getCardLabels(cardId, key, token);

  const alreadyAttached = currentLabels.some((label) => label.id === labelId);

  if (!alreadyAttached) {
    throw new Error(`Failed to add Trello label: ${await response.text()}`);
  }
}

async function removeLabelFromCard(
  cardId: string,
  labelId: string,
  key: string,
  token: string,
) {
  const response = await fetch(
    `https://api.trello.com/1/cards/${cardId}/idLabels/${labelId}?key=${key}&token=${token}`,
    {
      method: "DELETE",
    },
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to remove Trello label: ${await response.text()}`);
  }
}

async function removeOldPriorityLabels(
  cardId: string,
  key: string,
  token: string,
) {
  const labels = await getCardLabels(cardId, key, token);

  const priorityLabels = labels.filter((label) => {
    const name = normalize(label.name);

    return name === "RUSH" || name === "NORMAL";
  });

  for (const label of priorityLabels) {
    await removeLabelFromCard(cardId, label.id, key, token);
  }
}

async function syncPartialOrderLabel(
  cardId: string,
  deliveryStrategy: DeliveryStrategy,
  key: string,
  token: string,
  boardId: string,
) {
  const cardLabels = await getCardLabels(cardId, key, token);

  const attachedPartialLabels = cardLabels.filter(
    (label) => normalize(label.name) === normalize(PARTIAL_ORDER_LABEL_NAME),
  );

  if (deliveryStrategy === "PARTIAL") {
    const partialLabelId =
      attachedPartialLabels[0]?.id ||
      (await getOrCreatePartialOrderLabel(key, token, boardId));

    await addLabelToCard(cardId, partialLabelId, key, token);

    /*
     * Remove duplicate labels with the same Partial Order name.
     */
    for (const duplicateLabel of attachedPartialLabels.slice(1)) {
      await removeLabelFromCard(cardId, duplicateLabel.id, key, token);
    }

    return;
  }

  /*
   * Complete orders must not retain Partial Order labels.
   */
  for (const partialLabel of attachedPartialLabels) {
    await removeLabelFromCard(cardId, partialLabel.id, key, token);
  }
}

async function getCardChecklists(cardId: string, key: string, token: string) {
  return trelloRequest<Checklist[]>(
    `https://api.trello.com/1/cards/${cardId}/checklists?key=${key}&token=${token}`,
  );
}

async function createChecklist(
  cardId: string,
  checklistName: string,
  key: string,
  token: string,
) {
  return trelloRequest<Checklist>(
    `https://api.trello.com/1/cards/${cardId}/checklists?key=${key}&token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: checklistName }),
    },
  );
}

async function createChecklistItem(
  checklistId: string,
  itemName: string,
  key: string,
  token: string,
  checked = false,
) {
  return trelloRequest<ChecklistItem>(
    `https://api.trello.com/1/checklists/${checklistId}/checkItems?key=${key}&token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: itemName, checked }),
    },
  );
}

async function createChecklistWithItem(
  cardId: string,
  checklistName: string,
  itemName: string,
  key: string,
  token: string,
  checked = false,
) {
  const checklist = await createChecklist(cardId, checklistName, key, token);
  const item = await createChecklistItem(
    checklist.id,
    itemName,
    key,
    token,
    checked,
  );

  return { ...checklist, checkItems: [item] };
}

async function deleteChecklist(
  checklistId: string,
  key: string,
  token: string,
) {
  await trelloRequest<void>(
    `https://api.trello.com/1/checklists/${checklistId}?key=${key}&token=${token}`,
    { method: "DELETE" },
  );
}

async function deleteChecklistItem(
  checklistId: string,
  itemId: string,
  key: string,
  token: string,
) {
  await trelloRequest<void>(
    `https://api.trello.com/1/checklists/${checklistId}/checkItems/${itemId}?key=${key}&token=${token}`,
    { method: "DELETE" },
  );
}

async function ensureSingleChecklistItem(
  checklist: Checklist,
  itemName: string,
  key: string,
  token: string,
  checkedWhenCreated = false,
) {
  const matchingItems = findItemsByName(checklist, itemName);

  if (matchingItems.length === 0) {
    await createChecklistItem(
      checklist.id,
      itemName,
      key,
      token,
      checkedWhenCreated,
    );
    return;
  }

  const itemToKeep =
    matchingItems.find((item) => item.state === "complete") ?? matchingItems[0];

  for (const item of matchingItems) {
    if (item.id !== itemToKeep.id) {
      await deleteChecklistItem(checklist.id, item.id, key, token);
    }
  }
}

async function removeChecklistItemsByName(
  checklist: Checklist,
  itemName: string,
  key: string,
  token: string,
) {
  for (const item of findItemsByName(checklist, itemName)) {
    await deleteChecklistItem(checklist.id, item.id, key, token);
  }
}

async function deleteOtherChecklists(
  checklists: Checklist[],
  keepIds: Set<string>,
  key: string,
  token: string,
) {
  for (const checklist of checklists) {
    if (!keepIds.has(checklist.id)) {
      await deleteChecklist(checklist.id, key, token);
    }
  }
}

function isInitialCommitmentChecklist(checklist: Checklist) {
  return (
    normalize(checklist.name) === normalize(INITIAL_COMMITMENT_CHECKLIST_NAME)
  );
}

async function syncCompleteOrderChecklists(
  cardId: string,
  allChecklists: Checklist[],
  key: string,
  token: string,
) {
  const statusChecklists = allChecklists.filter(isStatusChecklist);
  const commitmentChecklists = allChecklists.filter(
    isInitialCommitmentChecklist,
  );

  let statusChecklist = chooseChecklistPreferCompleted(
    statusChecklists.filter((checklist) => hasItem(checklist, DONE_ITEM_NAME)),
    DONE_ITEM_NAME,
  );

  statusChecklist ??= [...statusChecklists].sort((a, b) =>
    a.id.localeCompare(b.id),
  )[0];

  if (!statusChecklist) {
    statusChecklist = await createChecklistWithItem(
      cardId,
      STATUS_CHECKLIST_NAME,
      DONE_ITEM_NAME,
      key,
      token,
    );
  }

  await deleteOtherChecklists(
    statusChecklists,
    new Set([statusChecklist.id]),
    key,
    token,
  );

  await ensureSingleChecklistItem(statusChecklist, DONE_ITEM_NAME, key, token);

  await removeChecklistItemsByName(
    statusChecklist,
    INITIAL_RELEASE_ITEM_NAME,
    key,
    token,
  );

  await deleteOtherChecklists(commitmentChecklists, new Set(), key, token);
}

async function syncPartialOrderChecklists(
  cardId: string,
  allChecklists: Checklist[],
  key: string,
  token: string,
) {
  const statusChecklists = allChecklists.filter(isStatusChecklist);
  const commitmentChecklists = allChecklists.filter(
    isInitialCommitmentChecklist,
  );

  const initialReleaseWasCompleted = allChecklists.some((checklist) =>
    findItemsByName(checklist, INITIAL_RELEASE_ITEM_NAME).some(
      (item) => item.state === "complete",
    ),
  );

  let statusChecklist = chooseChecklistPreferCompleted(
    statusChecklists.filter((checklist) => hasItem(checklist, DONE_ITEM_NAME)),
    DONE_ITEM_NAME,
  );

  statusChecklist ??= [...statusChecklists].sort((a, b) =>
    a.id.localeCompare(b.id),
  )[0];

  if (!statusChecklist) {
    statusChecklist = await createChecklistWithItem(
      cardId,
      STATUS_CHECKLIST_NAME,
      DONE_ITEM_NAME,
      key,
      token,
    );
  }

  let commitmentChecklist = chooseChecklistPreferCompleted(
    commitmentChecklists,
    INITIAL_RELEASE_ITEM_NAME,
  );

  if (!commitmentChecklist) {
    commitmentChecklist = await createChecklistWithItem(
      cardId,
      INITIAL_COMMITMENT_CHECKLIST_NAME,
      INITIAL_RELEASE_ITEM_NAME,
      key,
      token,
      initialReleaseWasCompleted,
    );
  }

  await deleteOtherChecklists(
    statusChecklists,
    new Set([statusChecklist.id]),
    key,
    token,
  );

  await deleteOtherChecklists(
    commitmentChecklists,
    new Set([commitmentChecklist.id]),
    key,
    token,
  );

  await ensureSingleChecklistItem(statusChecklist, DONE_ITEM_NAME, key, token);

  await removeChecklistItemsByName(
    statusChecklist,
    INITIAL_RELEASE_ITEM_NAME,
    key,
    token,
  );

  await ensureSingleChecklistItem(
    commitmentChecklist,
    INITIAL_RELEASE_ITEM_NAME,
    key,
    token,
    initialReleaseWasCompleted,
  );

  await removeChecklistItemsByName(
    commitmentChecklist,
    DONE_ITEM_NAME,
    key,
    token,
  );
}

async function syncProductionChecklists(
  cardId: string,
  deliveryStrategy: DeliveryStrategy,
  key: string,
  token: string,
) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const allChecklists = await getCardChecklists(cardId, key, token);

    if (deliveryStrategy === "PARTIAL") {
      await syncPartialOrderChecklists(cardId, allChecklists, key, token);
    } else {
      await syncCompleteOrderChecklists(cardId, allChecklists, key, token);
    }
  }
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
        {
          error: "Missing Trello environment variables.",
        },
        {
          status: 500,
        },
      );
    }

    const card = await trelloRequest<TrelloCard>(
      `https://api.trello.com/1/cards/${cardId}?fields=id,name,desc&key=${key}&token=${token}`,
    );

    const birRecord = await findReceivedATPByCardId(cardId);

    const nonBirRecord = await findNonBIROrderByCardId(cardId);

    const birRow = birRecord?.row || [];
    const nonBirRow = nonBirRecord?.row || [];

    const cardName = String(card.name || "").toUpperCase();

    const isNonBir =
      Boolean(nonBirRecord) ||
      cardName.includes("NON-BIR") ||
      cardName.includes("NON BIR");

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

    const actions = await getCardMoveActions(cardId, key, token);

    const productionStartRaw = findFirstMoveInto(
      actions,
      PRODUCTION_START_LIST,
    );

    const productionStartDate = productionStartRaw
      ? new Date(productionStartRaw)
      : null;

    const deliveryStrategy: DeliveryStrategy =
      body.deliveryStrategy === "PARTIAL" ? "PARTIAL" : "COMPLETE";

    const initialReleaseQty = value(body.initialReleaseQty || "10");

    const initialDueWorkingDays = toPositiveNumber(
      body.initialDueWorkingDays,
      10,
    );

    const isRush = body.orderPriority?.trim().toLowerCase() === "rush";

    const finalDueWorkingDays =
      deliveryStrategy === "PARTIAL"
        ? toPositiveNumber(body.finalDueWorkingDays, 30)
        : isRush
          ? 3
          : 10;

    const initialDueDate =
      productionStartDate && deliveryStrategy === "PARTIAL"
        ? addWorkingDays(productionStartDate, initialDueWorkingDays)
        : null;

    const finalDueDate = productionStartDate
      ? addWorkingDays(productionStartDate, finalDueWorkingDays)
      : null;

    const trelloDueDate =
      deliveryStrategy === "PARTIAL" ? initialDueDate : finalDueDate;

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

DELIVERY COMMITMENT:
DELIVERY STRATEGY: ${getDeliveryLabel(deliveryStrategy)}
INITIAL RELEASE QTY: ${
      deliveryStrategy === "PARTIAL" ? `${initialReleaseQty} Booklets` : "-"
    }
INITIAL DUE WD: ${deliveryStrategy === "PARTIAL" ? initialDueWorkingDays : "-"}
FINAL DUE WD: ${finalDueWorkingDays}
PRODUCTION START: ${
      productionStartDate ? formatDateOnly(productionStartDate) : "Not Started"
    }
INITIAL DUE DATE: ${
      initialDueDate ? formatDateOnly(initialDueDate) : "Pending Station 1 & 2"
    }
FINAL DUE DATE: ${
      finalDueDate ? formatDateOnly(finalDueDate) : "Pending Station 1 & 2"
    }

PRODUCTION:
PAPER: ${body.paperType}
PLY: ${body.ply}
SIZE: ${body.size}
SPECIAL: ${body.specialInstructions || "-"}
STATUS: Production Details Complete
`.trim();

    const updatePayload: {
      desc: string;
      idList: string;
      due?: string | null;
    } = {
      desc: compactDescription,
      idList: station4ListId,
    };

    /*
     * Clear an old due date when production has not started yet.
     */
    updatePayload.due = trelloDueDate ? trelloDueDate.toISOString() : null;

    const updatedCard = await trelloRequest<TrelloCard>(
      `https://api.trello.com/1/cards/${cardId}?key=${key}&token=${token}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatePayload),
      },
    );

    /*
     * Sync Rush or Normal priority label.
     */
    await removeOldPriorityLabels(cardId, key, token);

    const priorityLabelId = await getOrCreatePriorityLabel(
      key,
      token,
      boardId,
      body.orderPriority,
    );

    await addLabelToCard(cardId, priorityLabelId, key, token);

    /*
     * Normalize workflow checklists first.
     *
     * Complete:
     * Status -> Done
     *
     * Partial:
     * Status -> Done
     * Initial Commitment -> Initial Release Completed
     */
    await syncProductionChecklists(cardId, deliveryStrategy, key, token);

    /*
     * Sync the Partial Order label after the checklist workflow.
     *
     * This prevents a label API failure from stopping checklist creation.
     */
    await syncPartialOrderLabel(cardId, deliveryStrategy, key, token, boardId);

    return NextResponse.json({
      success: true,
      card: updatedCard,
      deliveryStrategy,
      partialOrderLabel: deliveryStrategy === "PARTIAL",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Server error while saving production details.",
      },
      {
        status: 500,
      },
    );
  }
}
