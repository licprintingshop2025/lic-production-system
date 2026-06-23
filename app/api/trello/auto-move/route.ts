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

type Checklist = {
  id: string;
  name: string;
  checkItems: {
    id: string;
    name: string;
    state: "complete" | "incomplete";
  }[];
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

async function trelloFetch(endpoint: string, options?: RequestInit) {
  const key = process.env.TRELLO_KEY;
  const token = process.env.TRELLO_TOKEN;

  if (!key || !token) {
    throw new Error("Missing Trello credentials");
  }

  const separator = endpoint.includes("?") ? "&" : "?";

  const res = await fetch(
    `https://api.trello.com/1/${endpoint}${separator}key=${key}&token=${token}`,
    {
      cache: "no-store",
      ...options,
    }
  );

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}

function normalize(value: string) {
  return value.trim().toUpperCase();
}

function isProductionStation(listName: string) {
  return STATION_FLOW.some(
    (station) => normalize(station) === normalize(listName)
  );
}

function getNextStation(currentStation: string) {
  const index = STATION_FLOW.findIndex(
    (station) => normalize(station) === normalize(currentStation)
  );

  if (index === -1 || index === STATION_FLOW.length - 1) return null;

  return STATION_FLOW[index + 1];
}

async function resetChecklist(cardId: string) {
  const checklists = (await trelloFetch(
    `cards/${cardId}/checklists`
  )) as Checklist[];

  for (const checklist of checklists) {
    await trelloFetch(`checklists/${checklist.id}`, {
      method: "DELETE",
    });
  }

  const newChecklist = await trelloFetch(`cards/${cardId}/checklists`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Status",
    }),
  });

  await trelloFetch(`checklists/${newChecklist.id}/checkItems`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Done",
    }),
  });
}

async function ensureChecklist(cardId: string) {
  const checklists = (await trelloFetch(
    `cards/${cardId}/checklists`
  )) as Checklist[];

  if (!checklists.length) {
    await resetChecklist(cardId);
    return false;
  }

  const hasDoneItem = checklists.some((checklist) =>
    checklist.checkItems.some(
      (item) => item.name.toLowerCase() === "done"
    )
  );

  if (!hasDoneItem) {
    await resetChecklist(cardId);
    return false;
  }

  return true;
}

async function cardChecklistDone(cardId: string) {
  const checklists = (await trelloFetch(
    `cards/${cardId}/checklists`
  )) as Checklist[];

  const allItems = checklists.flatMap((checklist) => checklist.checkItems);

  if (!allItems.length) return false;

  return allItems.every((item) => item.state === "complete");
}

export async function POST() {
  try {
    const boardId = process.env.TRELLO_BOARD_ID;

    if (!boardId) {
      return NextResponse.json(
        { error: "Missing TRELLO_BOARD_ID" },
        { status: 500 }
      );
    }

    const lists = (await trelloFetch(
      `boards/${boardId}/lists?cards=open&card_fields=name,idList`
    )) as TrelloList[];

    const movedCards = [];
    const blockedCards = [];
    const checklistCreatedCards = [];

    for (const list of lists) {
      if (!isProductionStation(list.name)) continue;

      const nextStation = getNextStation(list.name);
      if (!nextStation) continue;

      const nextList = lists.find(
        (item) => normalize(item.name) === normalize(nextStation)
      );

      if (!nextList) continue;

      for (const card of list.cards || []) {
        const checklistAlreadyExists = await ensureChecklist(card.id);

        if (!checklistAlreadyExists) {
          checklistCreatedCards.push({
            card: card.name,
            station: list.name,
          });

          continue;
        }

        const isDone = await cardChecklistDone(card.id);

        if (!isDone) continue;

        const nextListCount = nextList.cards?.length || 0;

        if (nextListCount >= WIP_LIMIT) {
          await trelloFetch(`cards/${card.id}/actions/comments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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

        await trelloFetch(`cards/${card.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idList: nextList.id,
            pos: "bottom",
          }),
        });

        await resetChecklist(card.id);

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
      { status: 500 }
    );
  }
}