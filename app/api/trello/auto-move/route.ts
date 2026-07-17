import { NextResponse } from "next/server";
import {
  DONE_ITEM_NAME,
  INITIAL_COMMITMENT_CHECKLIST_NAME,
  INITIAL_RELEASE_ITEM_NAME,
  PARTIAL_ORDER_LABEL_NAME,
  STATUS_CHECKLIST_NAME,
} from "@/lib/trelloWorkflow";

type TrelloLabel = {
  id: string;
  name?: string;
};

type TrelloCard = {
  id: string;
  name: string;
  idList: string;
  desc?: string;
  labels?: TrelloLabel[];
};

type TrelloList = {
  id: string;
  name: string;
  cards?: TrelloCard[];
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

type EnsureWorkflowResult = {
  changed: boolean;
  partialOrder: boolean;
};

const STATION_FLOW = [
  "Station 4 (Non-BIR and ATP Receiving)",
  "Text Messaging",
  "Station 3 (Payments and Invoice)",
  "Station 1 & 2 (Layouting & Encoding)",
  "Admin Head - (For approval to printing)",
  "Quality Checking",
  "Receiving & Pre-Print Formatting",
  "Running",
  "Numbering",
  "Collating",
  "Stapling/Padding",
  "Cutting & Trimming",
  "Browning",
  "Stamping",
  "Packaging & Labelling",
  "Finish Receipt",
  "Ready for Release",
];

const WIP_LIMIT = 20;

async function trelloFetch<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const key = process.env.TRELLO_KEY;
  const token = process.env.TRELLO_TOKEN;

  if (!key || !token) {
    throw new Error("Missing Trello credentials");
  }

  const separator = endpoint.includes("?") ? "&" : "?";

  const response = await fetch(
    `https://api.trello.com/1/${endpoint}${separator}key=${key}&token=${token}`,
    {
      cache: "no-store",
      ...options,
    },
  );

  if (!response.ok) {
    const details = await response.text();

    throw new Error(`Trello request failed (${response.status}): ${details}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function normalize(value?: string | null): string {
  return (value || "").trim().toUpperCase();
}

function isProductionStation(listName: string): boolean {
  return STATION_FLOW.some(
    (station) => normalize(station) === normalize(listName),
  );
}

function getNextStation(currentStation: string): string | null {
  const index = STATION_FLOW.findIndex(
    (station) => normalize(station) === normalize(currentStation),
  );

  if (index === -1 || index === STATION_FLOW.length - 1) {
    return null;
  }

  return STATION_FLOW[index + 1];
}

function isPartialOrder(card: TrelloCard): boolean {
  const hasPartialOrderLabel =
    card.labels?.some(
      (label) => normalize(label.name) === normalize(PARTIAL_ORDER_LABEL_NAME),
    ) ?? false;

  const hasPartialReleaseDescription =
    /DELIVERY STRATEGY:\s*PARTIAL RELEASE/i.test(card.desc || "");

  return hasPartialOrderLabel || hasPartialReleaseDescription;
}

function isStatusChecklist(checklist: Checklist): boolean {
  return normalize(checklist.name) === normalize(STATUS_CHECKLIST_NAME);
}

function isInitialCommitmentChecklist(checklist: Checklist): boolean {
  return (
    normalize(checklist.name) === normalize(INITIAL_COMMITMENT_CHECKLIST_NAME)
  );
}

function isNamedItem(item: ChecklistItem, expectedName: string): boolean {
  return normalize(item.name) === normalize(expectedName);
}

function findItemsByName(
  checklist: Checklist,
  itemName: string,
): ChecklistItem[] {
  return checklist.checkItems.filter((item) => isNamedItem(item, itemName));
}

function hasItem(checklist: Checklist, itemName: string): boolean {
  return findItemsByName(checklist, itemName).length > 0;
}

function hasCompletedItem(checklist: Checklist, itemName: string): boolean {
  return findItemsByName(checklist, itemName).some(
    (item) => item.state === "complete",
  );
}

function chooseChecklistPreferCompleted(
  checklists: Checklist[],
  itemName: string,
): Checklist | undefined {
  const completedChecklist = checklists.find((checklist) =>
    hasCompletedItem(checklist, itemName),
  );

  if (completedChecklist) {
    return completedChecklist;
  }

  return [...checklists].sort((a, b) => a.id.localeCompare(b.id))[0];
}

async function getCardChecklists(cardId: string): Promise<Checklist[]> {
  return trelloFetch<Checklist[]>(`cards/${cardId}/checklists`);
}

async function getCurrentCard(cardId: string): Promise<TrelloCard> {
  return trelloFetch<TrelloCard>(
    `cards/${cardId}?fields=id,name,idList,desc,labels&label_fields=name`,
  );
}

async function deleteChecklist(checklistId: string): Promise<void> {
  await trelloFetch<void>(`checklists/${checklistId}`, {
    method: "DELETE",
  });
}

async function deleteCheckItem(
  checklistId: string,
  checkItemId: string,
): Promise<void> {
  await trelloFetch<void>(
    `checklists/${checklistId}/checkItems/${checkItemId}`,
    {
      method: "DELETE",
    },
  );
}

async function createCheckItem(
  checklistId: string,
  itemName: string,
  checked = false,
): Promise<ChecklistItem> {
  return trelloFetch<ChecklistItem>(`checklists/${checklistId}/checkItems`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: itemName,
      checked,
    }),
  });
}

async function createChecklistWithItem(
  cardId: string,
  checklistName: string,
  itemName: string,
  checked = false,
): Promise<Checklist> {
  const checklist = await trelloFetch<Checklist>(`cards/${cardId}/checklists`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: checklistName,
    }),
  });

  const item = await createCheckItem(checklist.id, itemName, checked);

  return {
    ...checklist,
    checkItems: [item],
  };
}

async function updateCheckItemState(
  cardId: string,
  checkItemId: string,
  state: "complete" | "incomplete",
): Promise<void> {
  await trelloFetch<void>(`cards/${cardId}/checkItem/${checkItemId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      state,
    }),
  });
}

async function ensureSingleNamedItem(
  checklist: Checklist,
  itemName: string,
  checkedWhenCreated = false,
): Promise<boolean> {
  const matchingItems = findItemsByName(checklist, itemName);

  if (matchingItems.length === 0) {
    await createCheckItem(checklist.id, itemName, checkedWhenCreated);
    return true;
  }

  if (matchingItems.length === 1) {
    return false;
  }

  const itemToKeep =
    matchingItems.find((item) => item.state === "complete") ?? matchingItems[0];

  for (const item of matchingItems) {
    if (item.id !== itemToKeep.id) {
      await deleteCheckItem(checklist.id, item.id);
    }
  }

  return true;
}

async function removeItemsByName(
  checklist: Checklist,
  itemName: string,
): Promise<boolean> {
  const matchingItems = findItemsByName(checklist, itemName);

  for (const item of matchingItems) {
    await deleteCheckItem(checklist.id, item.id);
  }

  return matchingItems.length > 0;
}

async function deleteOtherChecklists(
  checklists: Checklist[],
  keepChecklistIds: Set<string>,
): Promise<boolean> {
  const checklistsToDelete = checklists.filter(
    (checklist) => !keepChecklistIds.has(checklist.id),
  );

  for (const checklist of checklistsToDelete) {
    await deleteChecklist(checklist.id);
  }

  return checklistsToDelete.length > 0;
}

async function ensureNormalOrderWorkflow(
  cardId: string,
  allChecklists: Checklist[],
): Promise<boolean> {
  let changed = false;

  const statusChecklists = allChecklists.filter(isStatusChecklist);
  const initialCommitmentChecklists = allChecklists.filter(
    isInitialCommitmentChecklist,
  );

  let statusChecklist = chooseChecklistPreferCompleted(
    statusChecklists.filter((checklist) => hasItem(checklist, DONE_ITEM_NAME)),
    DONE_ITEM_NAME,
  );

  if (!statusChecklist) {
    statusChecklist = [...statusChecklists].sort((a, b) =>
      a.id.localeCompare(b.id),
    )[0];
  }

  if (!statusChecklist) {
    statusChecklist = await createChecklistWithItem(
      cardId,
      STATUS_CHECKLIST_NAME,
      DONE_ITEM_NAME,
    );
    changed = true;
  }

  if (
    await deleteOtherChecklists(statusChecklists, new Set([statusChecklist.id]))
  ) {
    changed = true;
  }

  if (await ensureSingleNamedItem(statusChecklist, DONE_ITEM_NAME)) {
    changed = true;
  }

  if (await removeItemsByName(statusChecklist, INITIAL_RELEASE_ITEM_NAME)) {
    changed = true;
  }

  /* Complete orders must not retain Initial Commitment. */
  if (await deleteOtherChecklists(initialCommitmentChecklists, new Set())) {
    changed = true;
  }

  return changed;
}

async function ensurePartialOrderWorkflow(
  cardId: string,
  allChecklists: Checklist[],
): Promise<boolean> {
  let changed = false;

  const statusChecklists = allChecklists.filter(isStatusChecklist);
  const initialCommitmentChecklists = allChecklists.filter(
    isInitialCommitmentChecklist,
  );

  /*
   * Preserve completion from either the current structure or the old
   * legacy structure where Initial Release Completed was inside Status.
   */
  const hadCompletedInitialRelease = allChecklists.some((checklist) =>
    hasCompletedItem(checklist, INITIAL_RELEASE_ITEM_NAME),
  );

  let statusChecklist = chooseChecklistPreferCompleted(
    statusChecklists.filter((checklist) => hasItem(checklist, DONE_ITEM_NAME)),
    DONE_ITEM_NAME,
  );

  if (!statusChecklist) {
    statusChecklist = [...statusChecklists].sort((a, b) =>
      a.id.localeCompare(b.id),
    )[0];
  }

  if (!statusChecklist) {
    statusChecklist = await createChecklistWithItem(
      cardId,
      STATUS_CHECKLIST_NAME,
      DONE_ITEM_NAME,
    );
    changed = true;
  }

  let initialCommitmentChecklist = chooseChecklistPreferCompleted(
    initialCommitmentChecklists,
    INITIAL_RELEASE_ITEM_NAME,
  );

  if (!initialCommitmentChecklist) {
    initialCommitmentChecklist = await createChecklistWithItem(
      cardId,
      INITIAL_COMMITMENT_CHECKLIST_NAME,
      INITIAL_RELEASE_ITEM_NAME,
      hadCompletedInitialRelease,
    );
    changed = true;
  }

  if (
    await deleteOtherChecklists(statusChecklists, new Set([statusChecklist.id]))
  ) {
    changed = true;
  }

  if (
    await deleteOtherChecklists(
      initialCommitmentChecklists,
      new Set([initialCommitmentChecklist.id]),
    )
  ) {
    changed = true;
  }

  if (await ensureSingleNamedItem(statusChecklist, DONE_ITEM_NAME)) {
    changed = true;
  }

  if (await removeItemsByName(statusChecklist, INITIAL_RELEASE_ITEM_NAME)) {
    changed = true;
  }

  if (
    await ensureSingleNamedItem(
      initialCommitmentChecklist,
      INITIAL_RELEASE_ITEM_NAME,
      hadCompletedInitialRelease,
    )
  ) {
    changed = true;
  }

  if (await removeItemsByName(initialCommitmentChecklist, DONE_ITEM_NAME)) {
    changed = true;
  }

  return changed;
}

async function ensureWorkflowChecklists(
  card: TrelloCard,
): Promise<EnsureWorkflowResult> {
  const partialOrder = isPartialOrder(card);
  let changed = false;

  /* Normalize twice to protect against overlapping webhook requests. */
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const allChecklists = await getCardChecklists(card.id);

    const workflowChanged = partialOrder
      ? await ensurePartialOrderWorkflow(card.id, allChecklists)
      : await ensureNormalOrderWorkflow(card.id, allChecklists);

    if (workflowChanged) {
      changed = true;
    }
  }

  const finalChecklists = await getCardChecklists(card.id);
  const finalStatusChecklists = finalChecklists.filter(isStatusChecklist);
  const finalInitialCommitmentChecklists = finalChecklists.filter(
    isInitialCommitmentChecklist,
  );

  if (finalStatusChecklists.length !== 1) {
    throw new Error(
      `Expected exactly one Status checklist for card ${card.id}`,
    );
  }

  if (partialOrder && finalInitialCommitmentChecklists.length !== 1) {
    throw new Error(
      `Expected exactly one Initial Commitment checklist for partial card ${card.id}`,
    );
  }

  if (!partialOrder && finalInitialCommitmentChecklists.length !== 0) {
    throw new Error(
      `Complete card ${card.id} still has an Initial Commitment checklist`,
    );
  }

  return {
    changed,
    partialOrder,
  };
}

async function cardChecklistDone(cardId: string): Promise<boolean> {
  const checklists = await getCardChecklists(cardId);

  /* Only Status -> Done triggers station movement. */
  return checklists.some(
    (checklist) =>
      isStatusChecklist(checklist) &&
      checklist.checkItems.some(
        (item) =>
          isNamedItem(item, DONE_ITEM_NAME) && item.state === "complete",
      ),
  );
}

async function resetCompletedDoneItems(cardId: string): Promise<string[]> {
  const checklists = await getCardChecklists(cardId);

  const completedDoneItems = checklists.flatMap((checklist) => {
    if (!isStatusChecklist(checklist)) {
      return [];
    }

    return checklist.checkItems.filter(
      (item) => isNamedItem(item, DONE_ITEM_NAME) && item.state === "complete",
    );
  });

  for (const item of completedDoneItems) {
    await updateCheckItemState(cardId, item.id, "incomplete");
  }

  return completedDoneItems.map((item) => item.id);
}

async function restoreCompletedDoneItems(
  cardId: string,
  checkItemIds: string[],
): Promise<void> {
  for (const checkItemId of checkItemIds) {
    try {
      await updateCheckItemState(cardId, checkItemId, "complete");
    } catch (error) {
      console.error(
        `Could not restore Done item ${checkItemId} for card ${cardId}:`,
        error,
      );
    }
  }
}

export async function POST() {
  try {
    const boardId = process.env.TRELLO_BOARD_ID;

    if (!boardId) {
      return NextResponse.json(
        {
          error: "Missing TRELLO_BOARD_ID",
        },
        {
          status: 500,
        },
      );
    }

    const lists = await trelloFetch<TrelloList[]>(
      `boards/${boardId}/lists?cards=open&card_fields=name,idList`,
    );

    const movedCards: {
      card: string;
      from: string;
      to: string;
    }[] = [];

    const blockedCards: {
      card: string;
      from: string;
      to: string;
      reason: string;
    }[] = [];

    const checklistUpdatedCards: {
      card: string;
      station: string;
      partialOrder: boolean;
    }[] = [];

    for (const list of lists) {
      if (!isProductionStation(list.name)) {
        continue;
      }

      const nextStation = getNextStation(list.name);

      if (!nextStation) {
        continue;
      }

      const nextList = lists.find(
        (item) => normalize(item.name) === normalize(nextStation),
      );

      if (!nextList) {
        continue;
      }

      let nextListCount = nextList.cards?.length ?? 0;

      for (const snapshotCard of list.cards ?? []) {
        const currentCard = await getCurrentCard(snapshotCard.id);

        if (currentCard.idList !== list.id) {
          continue;
        }

        const workflowResult = await ensureWorkflowChecklists(currentCard);

        if (workflowResult.changed) {
          checklistUpdatedCards.push({
            card: currentCard.name,
            station: list.name,
            partialOrder: workflowResult.partialOrder,
          });

          /* Evaluate movement on the next stable webhook request. */
          continue;
        }

        const isDone = await cardChecklistDone(currentCard.id);

        if (!isDone) {
          continue;
        }

        const cardBeforeMove = await getCurrentCard(currentCard.id);

        if (cardBeforeMove.idList !== list.id) {
          continue;
        }

        if (nextListCount >= WIP_LIMIT) {
          await trelloFetch<void>(`cards/${currentCard.id}/actions/comments`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: `Move blocked. ${nextStation} reached WIP limit of ${WIP_LIMIT}.`,
            }),
          });

          blockedCards.push({
            card: currentCard.name,
            from: list.name,
            to: nextStation,
            reason: "WIP limit reached",
          });

          continue;
        }

        /*
         * Reset Done before moving to prevent cascading moves.
         * Initial Release Completed is never reset.
         */
        const resetDoneItemIds = await resetCompletedDoneItems(currentCard.id);

        const verifiedCard = await getCurrentCard(currentCard.id);

        if (verifiedCard.idList !== list.id) {
          continue;
        }

        try {
          await trelloFetch<TrelloCard>(`cards/${currentCard.id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              idList: nextList.id,
              pos: "bottom",
            }),
          });
        } catch (error) {
          await restoreCompletedDoneItems(currentCard.id, resetDoneItemIds);
          throw error;
        }

        nextListCount += 1;

        movedCards.push({
          card: currentCard.name,
          from: list.name,
          to: nextStation,
        });
      }
    }

    return NextResponse.json({
      success: true,
      moved: movedCards.length,
      blocked: blockedCards.length,
      checklistUpdated: checklistUpdatedCards.length,
      movedCards,
      blockedCards,
      checklistUpdatedCards,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Auto move failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      {
        status: 500,
      },
    );
  }
}
