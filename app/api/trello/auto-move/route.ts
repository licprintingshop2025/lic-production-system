import { NextResponse } from "next/server";

type TrelloLabel = {
  id: string;
  name?: string;
};

type TrelloCard = {
  id: string;
  name: string;
  idList: string;
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

const STATUS_CHECKLIST_NAME = "Status";
const DONE_ITEM_NAME = "Done";
const INITIAL_RELEASE_ITEM_NAME = "Initial release completed";
const PARTIAL_ORDER_LABEL_NAME = "Partial Order";

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
  return (
    card.labels?.some(
      (label) => normalize(label.name) === normalize(PARTIAL_ORDER_LABEL_NAME),
    ) ?? false
  );
}

function isStatusChecklist(checklist: Checklist): boolean {
  return normalize(checklist.name) === normalize(STATUS_CHECKLIST_NAME);
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

function findDoneItems(checklist: Checklist): ChecklistItem[] {
  return findItemsByName(checklist, DONE_ITEM_NAME);
}

function findInitialReleaseItems(checklist: Checklist): ChecklistItem[] {
  return findItemsByName(checklist, INITIAL_RELEASE_ITEM_NAME);
}

function hasDoneItem(checklist: Checklist): boolean {
  return findDoneItems(checklist).length > 0;
}

function hasInitialReleaseItem(checklist: Checklist): boolean {
  return findInitialReleaseItems(checklist).length > 0;
}

function hasCompletedDone(checklist: Checklist): boolean {
  return findDoneItems(checklist).some((item) => item.state === "complete");
}

function hasCompletedInitialRelease(checklist: Checklist): boolean {
  return findInitialReleaseItems(checklist).some(
    (item) => item.state === "complete",
  );
}

function chooseChecklistPreferCompleted(
  checklists: Checklist[],
  itemName: string,
): Checklist | undefined {
  const completedChecklist = checklists.find((checklist) =>
    checklist.checkItems.some(
      (item) => isNamedItem(item, itemName) && item.state === "complete",
    ),
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
    `cards/${cardId}?fields=id,name,idList,labels&label_fields=name`,
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

async function createStatusChecklistWithItem(
  cardId: string,
  itemName: string,
  checked = false,
): Promise<Checklist> {
  const checklist = await trelloFetch<Checklist>(`cards/${cardId}/checklists`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: STATUS_CHECKLIST_NAME,
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
): Promise<boolean> {
  const matchingItems = findItemsByName(checklist, itemName);

  if (matchingItems.length === 0) {
    await createCheckItem(checklist.id, itemName, false);

    return true;
  }

  if (matchingItems.length === 1) {
    return false;
  }

  /*
   * Keep a completed item when possible so user progress is not
   * lost while duplicate items are cleaned up.
   */
  const itemToKeep =
    matchingItems.find((item) => item.state === "complete") ?? matchingItems[0];

  for (const item of matchingItems) {
    if (item.id === itemToKeep.id) {
      continue;
    }

    await deleteCheckItem(checklist.id, item.id);
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

async function deleteOtherStatusChecklists(
  statusChecklists: Checklist[],
  keepChecklistIds: Set<string>,
): Promise<boolean> {
  const checklistsToDelete = statusChecklists.filter(
    (checklist) => !keepChecklistIds.has(checklist.id),
  );

  for (const checklist of checklistsToDelete) {
    await deleteChecklist(checklist.id);
  }

  return checklistsToDelete.length > 0;
}

async function ensureNormalOrderWorkflow(
  cardId: string,
  statusChecklists: Checklist[],
): Promise<boolean> {
  let changed = false;

  /*
   * Prefer a Status checklist containing a completed Done item.
   */
  let checklistToKeep = chooseChecklistPreferCompleted(
    statusChecklists.filter(hasDoneItem),
    DONE_ITEM_NAME,
  );

  /*
   * If none contains Done, keep one existing Status checklist.
   */
  if (!checklistToKeep) {
    checklistToKeep = [...statusChecklists].sort((a, b) =>
      a.id.localeCompare(b.id),
    )[0];
  }

  /*
   * Create a Status checklist if none exists.
   */
  if (!checklistToKeep) {
    checklistToKeep = await createStatusChecklistWithItem(
      cardId,
      DONE_ITEM_NAME,
    );

    changed = true;
  }

  /*
   * Normal orders must have exactly one Status checklist.
   */
  const removedDuplicates = await deleteOtherStatusChecklists(
    statusChecklists,
    new Set([checklistToKeep.id]),
  );

  if (removedDuplicates) {
    changed = true;
  }

  /*
   * The remaining checklist must contain exactly one Done item.
   */
  if (await ensureSingleNamedItem(checklistToKeep, DONE_ITEM_NAME)) {
    changed = true;
  }

  /*
   * Normal orders must not retain Initial release completed.
   */
  if (await removeItemsByName(checklistToKeep, INITIAL_RELEASE_ITEM_NAME)) {
    changed = true;
  }

  return changed;
}

async function ensurePartialOrderWorkflow(
  cardId: string,
  statusChecklists: Checklist[],
): Promise<boolean> {
  let changed = false;

  /*
   * Preserve completed states before cleanup.
   */
  const hadCompletedDone = statusChecklists.some(hasCompletedDone);

  const hadCompletedInitialRelease = statusChecklists.some(
    hasCompletedInitialRelease,
  );

  /*
   * Select the Status checklist containing
   * Initial release completed.
   */
  let initialReleaseChecklist = chooseChecklistPreferCompleted(
    statusChecklists.filter(hasInitialReleaseItem),
    INITIAL_RELEASE_ITEM_NAME,
  );

  if (!initialReleaseChecklist) {
    initialReleaseChecklist = await createStatusChecklistWithItem(
      cardId,
      INITIAL_RELEASE_ITEM_NAME,
      hadCompletedInitialRelease,
    );

    changed = true;
  }

  /*
   * Select a separate Status checklist containing Done.
   */
  const doneChecklistCandidates = statusChecklists.filter(
    (checklist) =>
      checklist.id !== initialReleaseChecklist.id && hasDoneItem(checklist),
  );

  let doneChecklist = chooseChecklistPreferCompleted(
    doneChecklistCandidates,
    DONE_ITEM_NAME,
  );

  if (!doneChecklist) {
    doneChecklist = await createStatusChecklistWithItem(
      cardId,
      DONE_ITEM_NAME,
      hadCompletedDone,
    );

    changed = true;
  }

  /*
   * Partial orders must have exactly two Status checklists:
   *
   * 1. Done
   * 2. Initial release completed
   */
  const removedDuplicates = await deleteOtherStatusChecklists(
    statusChecklists,
    new Set([doneChecklist.id, initialReleaseChecklist.id]),
  );

  if (removedDuplicates) {
    changed = true;
  }

  /*
   * Done checklist:
   * exactly one Done item.
   */
  if (await ensureSingleNamedItem(doneChecklist, DONE_ITEM_NAME)) {
    changed = true;
  }

  /*
   * Done checklist must not contain Initial release completed.
   */
  if (await removeItemsByName(doneChecklist, INITIAL_RELEASE_ITEM_NAME)) {
    changed = true;
  }

  /*
   * Initial-release checklist:
   * exactly one Initial release completed item.
   */
  if (
    await ensureSingleNamedItem(
      initialReleaseChecklist,
      INITIAL_RELEASE_ITEM_NAME,
    )
  ) {
    changed = true;
  }

  /*
   * Initial-release checklist must not contain Done.
   */
  if (await removeItemsByName(initialReleaseChecklist, DONE_ITEM_NAME)) {
    changed = true;
  }

  return changed;
}

async function ensureWorkflowChecklists(
  card: TrelloCard,
): Promise<EnsureWorkflowResult> {
  const cardId = card.id;
  const partialOrder = isPartialOrder(card);

  let changed = false;

  let checklists = await getCardChecklists(cardId);

  let statusChecklists = checklists.filter(isStatusChecklist);

  /*
   * Create the first Status checklist when the card has none.
   *
   * For partial orders, ensurePartialOrderWorkflow will then create
   * the second checklist for Initial release completed.
   */
  if (statusChecklists.length === 0) {
    await createStatusChecklistWithItem(cardId, DONE_ITEM_NAME);

    changed = true;

    checklists = await getCardChecklists(cardId);

    statusChecklists = checklists.filter(isStatusChecklist);
  }

  if (statusChecklists.length === 0) {
    throw new Error(`Status checklist could not be created for card ${cardId}`);
  }

  /*
   * Partial Order label is the authoritative indicator.
   */
  if (partialOrder) {
    const workflowChanged = await ensurePartialOrderWorkflow(
      cardId,
      statusChecklists,
    );

    if (workflowChanged) {
      changed = true;
    }
  } else {
    const workflowChanged = await ensureNormalOrderWorkflow(
      cardId,
      statusChecklists,
    );

    if (workflowChanged) {
      changed = true;
    }
  }

  /*
   * Refetch after cleanup because another webhook request may have
   * changed the checklists at the same time.
   */
  const verifiedChecklists = await getCardChecklists(cardId);

  const verifiedStatusChecklists = verifiedChecklists.filter(isStatusChecklist);

  if (verifiedStatusChecklists.length === 0) {
    throw new Error(
      `Status checklist disappeared while processing card ${cardId}`,
    );
  }

  /*
   * Run the same normalization once more against the verified state.
   */
  if (partialOrder) {
    const finalChanged = await ensurePartialOrderWorkflow(
      cardId,
      verifiedStatusChecklists,
    );

    if (finalChanged) {
      changed = true;
    }
  } else {
    const finalChanged = await ensureNormalOrderWorkflow(
      cardId,
      verifiedStatusChecklists,
    );

    if (finalChanged) {
      changed = true;
    }
  }

  return {
    changed,
    partialOrder,
  };
}

async function cardChecklistDone(cardId: string): Promise<boolean> {
  const checklists = await getCardChecklists(cardId);

  /*
   * Only the exact item Done triggers station movement.
   *
   * Initial release completed never triggers station movement.
   */
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
      /*
       * A concurrent cleanup request may have deleted an item.
       * Do not hide the original move error.
       */
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

      /*
       * Keep a mutable count so multiple cards moved during this
       * request cannot exceed the next station's WIP limit.
       */
      let nextListCount = nextList.cards?.length ?? 0;

      for (const snapshotCard of list.cards ?? []) {
        /*
         * The board response is only a snapshot.
         *
         * Another webhook request may already have moved the card.
         */
        const currentCard = await getCurrentCard(snapshotCard.id);

        if (currentCard.idList !== list.id) {
          continue;
        }

        /*
         * Normalize checklist structure based on the Partial Order
         * label.
         */
        const workflowResult = await ensureWorkflowChecklists(currentCard);

        if (workflowResult.changed) {
          checklistUpdatedCards.push({
            card: currentCard.name,
            station: list.name,
            partialOrder: workflowResult.partialOrder,
          });

          /*
           * Do not move a card during the same request that repaired
           * or normalized its checklists.
           *
           * The checklist changes will trigger another webhook, which
           * can evaluate the final stable state.
           */
          continue;
        }

        const isDone = await cardChecklistDone(currentCard.id);

        if (!isDone) {
          continue;
        }

        /*
         * Recheck the card's current station after reading the
         * checklist.
         */
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
         * Reset Done before moving the card.
         *
         * This prevents a list-move webhook from seeing the card in
         * the next station while Done is still checked.
         *
         * Initial release completed is never reset.
         */
        const resetDoneItemIds = await resetCompletedDoneItems(currentCard.id);

        /*
         * Verify the card again after resetting Done.
         *
         * Another webhook request may have moved it while this request
         * was processing.
         */
        const verifiedCard = await getCurrentCard(currentCard.id);

        if (verifiedCard.idList !== list.id) {
          /*
           * Another request already moved the card.
           *
           * Do not restore Done because the completed state has
           * already been consumed by the successful move.
           */
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
          /*
           * Restore Done if Trello fails to move the card so the user
           * does not lose the completed action.
           */
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
