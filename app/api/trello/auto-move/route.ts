import { NextResponse } from "next/server";

type TrelloCard = {
  id: string;
  name: string;
  idList: string;
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

type EnsureStatusChecklistResult = {
  checklist: Checklist;
  changed: boolean;
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

function normalize(value: string): string {
  return value.trim().toUpperCase();
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

function findDoneItem(checklist: Checklist): ChecklistItem | undefined {
  return checklist.checkItems.find((item) => normalize(item.name) === "DONE");
}

function chooseStatusChecklistToKeep(checklists: Checklist[]): Checklist {
  const completedChecklist = checklists.find((checklist) =>
    checklist.checkItems.some(
      (item) => normalize(item.name) === "DONE" && item.state === "complete",
    ),
  );

  if (completedChecklist) {
    return completedChecklist;
  }

  /*
   * Choose a deterministic winner so overlapping requests are
   * more likely to preserve the same checklist.
   */
  return [...checklists].sort((a, b) => a.id.localeCompare(b.id))[0];
}

async function getCardChecklists(cardId: string): Promise<Checklist[]> {
  return trelloFetch<Checklist[]>(`cards/${cardId}/checklists`);
}

async function deleteChecklist(checklistId: string): Promise<void> {
  await trelloFetch<void>(`checklists/${checklistId}`, {
    method: "DELETE",
  });
}

async function createStatusChecklist(cardId: string): Promise<Checklist> {
  const checklist = await trelloFetch<Checklist>(`cards/${cardId}/checklists`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Status",
    }),
  });

  await trelloFetch<ChecklistItem>(`checklists/${checklist.id}/checkItems`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Done",
      checked: false,
    }),
  });

  return checklist;
}

async function createDoneItem(checklistId: string): Promise<void> {
  await trelloFetch<ChecklistItem>(`checklists/${checklistId}/checkItems`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Done",
      checked: false,
    }),
  });
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

async function deleteDuplicateStatusChecklists(
  statusChecklists: Checklist[],
  checklistToKeep: Checklist,
): Promise<boolean> {
  const duplicates = statusChecklists.filter(
    (checklist) => checklist.id !== checklistToKeep.id,
  );

  for (const duplicate of duplicates) {
    await deleteChecklist(duplicate.id);
  }

  return duplicates.length > 0;
}

async function ensureStatusChecklist(
  cardId: string,
): Promise<EnsureStatusChecklistResult> {
  let changed = false;

  let checklists = await getCardChecklists(cardId);

  let statusChecklists = checklists.filter(
    (checklist) => normalize(checklist.name) === "STATUS",
  );

  if (statusChecklists.length === 0) {
    await createStatusChecklist(cardId);
    changed = true;

    /*
     * Refetch because another request may have created a Status
     * checklist at nearly the same time.
     */
    checklists = await getCardChecklists(cardId);

    statusChecklists = checklists.filter(
      (checklist) => normalize(checklist.name) === "STATUS",
    );
  }

  if (statusChecklists.length === 0) {
    throw new Error(`Status checklist could not be created for card ${cardId}`);
  }

  let checklistToKeep = chooseStatusChecklistToKeep(statusChecklists);

  const removedDuplicates = await deleteDuplicateStatusChecklists(
    statusChecklists,
    checklistToKeep,
  );

  if (removedDuplicates) {
    changed = true;
  }

  if (!findDoneItem(checklistToKeep)) {
    await createDoneItem(checklistToKeep.id);
    changed = true;
  }

  /*
   * Verify the final state after creation or cleanup.
   */
  const verifiedChecklists = await getCardChecklists(cardId);

  const verifiedStatusChecklists = verifiedChecklists.filter(
    (checklist) => normalize(checklist.name) === "STATUS",
  );

  if (verifiedStatusChecklists.length === 0) {
    throw new Error(
      `Status checklist disappeared while processing card ${cardId}`,
    );
  }

  checklistToKeep = chooseStatusChecklistToKeep(verifiedStatusChecklists);

  const removedVerifiedDuplicates = await deleteDuplicateStatusChecklists(
    verifiedStatusChecklists,
    checklistToKeep,
  );

  if (removedVerifiedDuplicates) {
    changed = true;
  }

  /*
   * Refetch one final time if duplicates were deleted so the
   * returned checklist represents the final Trello state.
   */
  if (removedVerifiedDuplicates) {
    const finalChecklists = await getCardChecklists(cardId);

    const finalStatusChecklists = finalChecklists.filter(
      (checklist) => normalize(checklist.name) === "STATUS",
    );

    if (finalStatusChecklists.length === 0) {
      throw new Error(
        `Status checklist was not found after cleanup for card ${cardId}`,
      );
    }

    checklistToKeep = chooseStatusChecklistToKeep(finalStatusChecklists);
  }

  /*
   * Concurrent requests may leave the selected checklist without
   * a Done item, so verify it one more time.
   */
  if (!findDoneItem(checklistToKeep)) {
    await createDoneItem(checklistToKeep.id);
    changed = true;

    const refreshedChecklists = await getCardChecklists(cardId);

    const refreshedStatusChecklists = refreshedChecklists.filter(
      (checklist) => normalize(checklist.name) === "STATUS",
    );

    if (refreshedStatusChecklists.length === 0) {
      throw new Error(
        `Status checklist was not found after creating Done for card ${cardId}`,
      );
    }

    checklistToKeep = chooseStatusChecklistToKeep(refreshedStatusChecklists);
  }

  return {
    checklist: checklistToKeep,
    changed,
  };
}

async function resetStatusChecklist(cardId: string): Promise<void> {
  const { checklist } = await ensureStatusChecklist(cardId);

  const doneItem = findDoneItem(checklist);

  if (!doneItem) {
    throw new Error(`Done item was not found for card ${cardId}`);
  }

  if (doneItem.state === "complete") {
    await updateCheckItemState(cardId, doneItem.id, "incomplete");
  }
}

async function cardChecklistDone(cardId: string): Promise<boolean> {
  const checklists = await getCardChecklists(cardId);

  /*
   * Check every Status checklist. This preserves correct behavior
   * if a duplicate temporarily exists during overlapping requests.
   */
  return checklists.some(
    (checklist) =>
      normalize(checklist.name) === "STATUS" &&
      checklist.checkItems.some(
        (item) => normalize(item.name) === "DONE" && item.state === "complete",
      ),
  );
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

    const checklistCreatedCards: {
      card: string;
      station: string;
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
       * Keep a mutable count for this request so multiple moves
       * cannot exceed the WIP limit using the original snapshot.
       */
      let nextListCount = nextList.cards?.length ?? 0;

      for (const card of list.cards ?? []) {
        const checklistResult = await ensureStatusChecklist(card.id);

        if (checklistResult.changed) {
          checklistCreatedCards.push({
            card: card.name,
            station: list.name,
          });

          /*
           * Do not move a card in the same run that repaired its
           * workflow checklist. The next run can evaluate it safely.
           */
          continue;
        }

        const isDone = await cardChecklistDone(card.id);

        if (!isDone) {
          continue;
        }

        if (nextListCount >= WIP_LIMIT) {
          await trelloFetch<void>(`cards/${card.id}/actions/comments`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: `Move blocked. ${nextStation} reached WIP limit of ${WIP_LIMIT}.`,
            }),
          });

          blockedCards.push({
            card: card.name,
            from: list.name,
            to: nextStation,
            reason: "WIP limit reached",
          });

          continue;
        }

        await trelloFetch<TrelloCard>(`cards/${card.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            idList: nextList.id,
            pos: "bottom",
          }),
        });

        nextListCount += 1;

        /*
         * Reset Done only after the card successfully moves.
         */
        await resetStatusChecklist(card.id);

        movedCards.push({
          card: card.name,
          from: list.name,
          to: nextStation,
        });
      }
    }

    return NextResponse.json({
      success: true,
      moved: movedCards.length,
      blocked: blockedCards.length,
      checklistCreated: checklistCreatedCards.length,
      movedCards,
      blockedCards,
      checklistCreatedCards,
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
