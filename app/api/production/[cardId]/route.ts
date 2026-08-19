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
  params: Promise<{
    cardId: string;
  }>;
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

type ProductionSaveMode =
  | "initial"
  | "edit";

type DocumentSpecificationPayload = {
  id: string;
  documentType: string;
  quantity?: string;
  serialRange?: string;
  paperType: string;
  ply: string;
  size: string;
  specialInstructions?: string;
};

type ProductionDetailsPayload = {
  mode?: ProductionSaveMode;

  orderPriority: string;

  deliveryStrategy: DeliveryStrategy;
  initialReleaseQty?: string;
  initialDueWorkingDays?: string;
  finalDueWorkingDays?: string;

  documents: DocumentSpecificationPayload[];
};

type SourceOrderData = {
  trackingNo: string;
  tradeName: string;
  ocn: string;
  tin: string;
  rdo: string;
  documentType: string;
  taxType: string;
  atp: string;
  qty: string;
  serial: string;
  isNonBir: boolean;
};

const PRODUCTION_START_LIST =
  "Station 1 & 2 (Layouting & Encoding)";

const DOCUMENT_SPECIFICATIONS_START =
  "DOCUMENT SPECIFICATIONS START";

const DOCUMENT_SPECIFICATIONS_END =
  "DOCUMENT SPECIFICATIONS END";

function value(data: unknown) {
  const text = String(
    data ?? "",
  ).trim();

  return text || "-";
}

function textValue(data: unknown) {
  return String(
    data ?? "",
  ).trim();
}

function normalize(
  text: string | undefined,
) {
  return String(text || "")
    .trim()
    .toUpperCase();
}

function isWeekend(date: Date) {
  const day = date.getDay();

  return day === 0 || day === 6;
}

function addWorkingDays(
  startDate: Date,
  workingDays: number,
) {
  const date =
    new Date(startDate);

  let added = 0;

  while (
    added < workingDays
  ) {
    date.setDate(
      date.getDate() + 1,
    );

    if (!isWeekend(date)) {
      added += 1;
    }
  }

  return date;
}

function formatDateOnly(
  date: Date,
) {
  return date
    .toISOString()
    .split("T")[0];
}

function findFirstMoveInto(
  actions: TrelloAction[],
  listName: string,
) {
  const sorted = [
    ...actions,
  ].sort(
    (a, b) =>
      new Date(
        a.date,
      ).getTime() -
      new Date(
        b.date,
      ).getTime(),
  );

  const action =
    sorted.find(
      (item) =>
        normalize(
          item.data.listAfter
            ?.name,
        ) ===
        normalize(
          listName,
        ),
    );

  return (
    action?.date || ""
  );
}

function getDeliveryLabel(
  strategy: DeliveryStrategy,
) {
  return strategy ===
    "PARTIAL"
    ? "Partial Release"
    : "Complete Order";
}

function toPositiveNumber(
  input:
    | string
    | undefined,
  fallback: number,
) {
  const number =
    Number(input);

  if (
    !Number.isFinite(
      number,
    ) ||
    number <= 0
  ) {
    return fallback;
  }

  return number;
}

function escapeRegExp(
  input: string,
) {
  return input.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
}

function extractDescriptionValue(
  description: string,
  fieldName: string,
) {
  const escapedFieldName =
    escapeRegExp(
      fieldName,
    );

  const match =
    description.match(
      new RegExp(
        `^${escapedFieldName}:\\s*(.*)$`,
        "im",
      ),
    );

  return (
    match?.[1]?.trim() ||
    ""
  );
}

function cleanStoredValue(
  input: string,
) {
  const cleaned =
    textValue(input);

  if (
    !cleaned ||
    cleaned === "-"
  ) {
    return "";
  }

  return cleaned;
}

function splitOrderValues(
  input: string,
) {
  const cleaned =
    textValue(input);

  if (
    !cleaned ||
    cleaned === "-"
  ) {
    return [];
  }

  return cleaned
    .split(
      /\s*(?:\r?\n|\||;|\/)\s*/,
    )
    .map(
      (item) =>
        item.trim(),
    )
    .filter(Boolean);
}

function createDocumentId(
  documentType: string,
  index: number,
) {
  const slug =
    documentType
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "-",
      )
      .replace(
        /^-+|-+$/g,
        "",
      )
      .slice(0, 40);

  return `${
    slug || "document"
  }-${index + 1}`;
}

function sanitizeDescriptionLine(
  input: unknown,
) {
  const cleaned =
    textValue(
      input,
    ).replace(
      /\r?\n+/g,
      " ",
    );

  return (
    cleaned || "-"
  );
}

function isStatusChecklist(
  checklist: Checklist,
) {
  return (
    normalize(
      checklist.name,
    ) ===
    normalize(
      STATUS_CHECKLIST_NAME,
    )
  );
}

function isInitialCommitmentChecklist(
  checklist: Checklist,
) {
  return (
    normalize(
      checklist.name,
    ) ===
    normalize(
      INITIAL_COMMITMENT_CHECKLIST_NAME,
    )
  );
}

function findItemsByName(
  checklist: Checklist,
  itemName: string,
) {
  return checklist.checkItems.filter(
    (item) =>
      normalize(
        item.name,
      ) ===
      normalize(
        itemName,
      ),
  );
}

function hasItem(
  checklist: Checklist,
  itemName: string,
) {
  return (
    findItemsByName(
      checklist,
      itemName,
    ).length > 0
  );
}

function chooseChecklistPreferCompleted(
  checklists: Checklist[],
  itemName: string,
) {
  const completedChecklist =
    checklists.find(
      (checklist) =>
        findItemsByName(
          checklist,
          itemName,
        ).some(
          (item) =>
            item.state ===
            "complete",
        ),
    );

  if (
    completedChecklist
  ) {
    return completedChecklist;
  }

  return [
    ...checklists,
  ].sort((a, b) =>
    a.id.localeCompare(
      b.id,
    ),
  )[0];
}

async function trelloRequest<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response =
    await fetch(url, {
      cache: "no-store",
      ...options,
    });

  if (!response.ok) {
    const details =
      await response.text();

    throw new Error(
      `Trello request failed (${response.status}): ${details}`,
    );
  }

  if (
    response.status === 204
  ) {
    return undefined as T;
  }

  return (
    await response.json()
  ) as T;
}

async function getCardMoveActions(
  cardId: string,
  key: string,
  token: string,
) {
  const response =
    await fetch(
      `https://api.trello.com/1/cards/${cardId}/actions?filter=updateCard:idList&key=${key}&token=${token}`,
      {
        cache: "no-store",
      },
    );

  if (!response.ok) {
    return [];
  }

  return (
    await response.json()
  ) as TrelloAction[];
}

async function getBoardLabels(
  key: string,
  token: string,
  boardId: string,
) {
  return trelloRequest<
    TrelloLabel[]
  >(
    `https://api.trello.com/1/boards/${boardId}/labels?key=${key}&token=${token}`,
  );
}

async function getCardLabels(
  cardId: string,
  key: string,
  token: string,
) {
  return trelloRequest<
    TrelloLabel[]
  >(
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
  return trelloRequest<
    TrelloLabel
  >(
    `https://api.trello.com/1/labels?key=${key}&token=${token}`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
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
  const labels =
    await getBoardLabels(
      key,
      token,
      boardId,
    );

  const existingLabel =
    labels.find(
      (label) =>
        normalize(
          label.name,
        ) ===
        normalize(
          labelName,
        ),
    );

  if (
    existingLabel
  ) {
    return existingLabel.id;
  }

  const createdLabel =
    await createBoardLabel(
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
  const isRush =
    priority
      .trim()
      .toLowerCase() ===
    "rush";

  return getOrCreateLabel(
    key,
    token,
    boardId,
    isRush
      ? "Rush"
      : "Normal",
    isRush
      ? "red"
      : "green",
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
  const response =
    await fetch(
      `https://api.trello.com/1/cards/${cardId}/idLabels?key=${key}&token=${token}`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          value: labelId,
        }),
      },
    );

  if (response.ok) {
    return;
  }

  const currentLabels =
    await getCardLabels(
      cardId,
      key,
      token,
    );

  const alreadyAttached =
    currentLabels.some(
      (label) =>
        label.id ===
        labelId,
    );

  if (
    !alreadyAttached
  ) {
    throw new Error(
      `Failed to add Trello label: ${await response.text()}`,
    );
  }
}

async function removeLabelFromCard(
  cardId: string,
  labelId: string,
  key: string,
  token: string,
) {
  const response =
    await fetch(
      `https://api.trello.com/1/cards/${cardId}/idLabels/${labelId}?key=${key}&token=${token}`,
      {
        method: "DELETE",
      },
    );

  if (
    !response.ok &&
    response.status !==
      404
  ) {
    throw new Error(
      `Failed to remove Trello label: ${await response.text()}`,
    );
  }
}

async function removeOldPriorityLabels(
  cardId: string,
  key: string,
  token: string,
) {
  const labels =
    await getCardLabels(
      cardId,
      key,
      token,
    );

  const priorityLabels =
    labels.filter(
      (label) => {
        const name =
          normalize(
            label.name,
          );

        return (
          name ===
            "RUSH" ||
          name ===
            "NORMAL"
        );
      },
    );

  for (
    const label of priorityLabels
  ) {
    await removeLabelFromCard(
      cardId,
      label.id,
      key,
      token,
    );
  }
}

async function syncPartialOrderLabel(
  cardId: string,
  deliveryStrategy: DeliveryStrategy,
  key: string,
  token: string,
  boardId: string,
) {
  const cardLabels =
    await getCardLabels(
      cardId,
      key,
      token,
    );

  const attachedPartialLabels =
    cardLabels.filter(
      (label) =>
        normalize(
          label.name,
        ) ===
        normalize(
          PARTIAL_ORDER_LABEL_NAME,
        ),
    );

  if (
    deliveryStrategy ===
    "PARTIAL"
  ) {
    const partialLabelId =
      attachedPartialLabels[0]
        ?.id ||
      (await getOrCreatePartialOrderLabel(
        key,
        token,
        boardId,
      ));

    await addLabelToCard(
      cardId,
      partialLabelId,
      key,
      token,
    );

    for (
      const duplicateLabel of attachedPartialLabels.slice(
        1,
      )
    ) {
      await removeLabelFromCard(
        cardId,
        duplicateLabel.id,
        key,
        token,
      );
    }

    return;
  }

  for (
    const partialLabel of attachedPartialLabels
  ) {
    await removeLabelFromCard(
      cardId,
      partialLabel.id,
      key,
      token,
    );
  }
}

async function getCardChecklists(
  cardId: string,
  key: string,
  token: string,
) {
  return trelloRequest<
    Checklist[]
  >(
    `https://api.trello.com/1/cards/${cardId}/checklists?key=${key}&token=${token}`,
  );
}

async function createChecklist(
  cardId: string,
  checklistName: string,
  key: string,
  token: string,
) {
  return trelloRequest<
    Checklist
  >(
    `https://api.trello.com/1/cards/${cardId}/checklists?key=${key}&token=${token}`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        name: checklistName,
      }),
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
  return trelloRequest<
    ChecklistItem
  >(
    `https://api.trello.com/1/checklists/${checklistId}/checkItems?key=${key}&token=${token}`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        name: itemName,
        checked,
      }),
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
  const checklist =
    await createChecklist(
      cardId,
      checklistName,
      key,
      token,
    );

  const item =
    await createChecklistItem(
      checklist.id,
      itemName,
      key,
      token,
      checked,
    );

  return {
    ...checklist,
    checkItems: [
      item,
    ],
  };
}

async function deleteChecklist(
  checklistId: string,
  key: string,
  token: string,
) {
  await trelloRequest<void>(
    `https://api.trello.com/1/checklists/${checklistId}?key=${key}&token=${token}`,
    {
      method: "DELETE",
    },
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
    {
      method: "DELETE",
    },
  );
}

async function ensureSingleChecklistItem(
  checklist: Checklist,
  itemName: string,
  key: string,
  token: string,
  checkedWhenCreated = false,
) {
  const matchingItems =
    findItemsByName(
      checklist,
      itemName,
    );

  if (
    matchingItems.length ===
    0
  ) {
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
    matchingItems.find(
      (item) =>
        item.state ===
        "complete",
    ) ??
    matchingItems[0];

  for (
    const item of matchingItems
  ) {
    if (
      item.id !==
      itemToKeep.id
    ) {
      await deleteChecklistItem(
        checklist.id,
        item.id,
        key,
        token,
      );
    }
  }
}

async function removeChecklistItemsByName(
  checklist: Checklist,
  itemName: string,
  key: string,
  token: string,
) {
  for (
    const item of findItemsByName(
      checklist,
      itemName,
    )
  ) {
    await deleteChecklistItem(
      checklist.id,
      item.id,
      key,
      token,
    );
  }
}

async function deleteOtherChecklists(
  checklists: Checklist[],
  keepIds: Set<string>,
  key: string,
  token: string,
) {
  for (
    const checklist of checklists
  ) {
    if (
      !keepIds.has(
        checklist.id,
      )
    ) {
      await deleteChecklist(
        checklist.id,
        key,
        token,
      );
    }
  }
}

async function syncCompleteOrderChecklists(
  cardId: string,
  allChecklists: Checklist[],
  key: string,
  token: string,
) {
  const statusChecklists =
    allChecklists.filter(
      isStatusChecklist,
    );

  const commitmentChecklists =
    allChecklists.filter(
      isInitialCommitmentChecklist,
    );

  let statusChecklist =
    chooseChecklistPreferCompleted(
      statusChecklists.filter(
        (checklist) =>
          hasItem(
            checklist,
            DONE_ITEM_NAME,
          ),
      ),
      DONE_ITEM_NAME,
    );

  statusChecklist ??=
    [
      ...statusChecklists,
    ].sort((a, b) =>
      a.id.localeCompare(
        b.id,
      ),
    )[0];

  if (
    !statusChecklist
  ) {
    statusChecklist =
      await createChecklistWithItem(
        cardId,
        STATUS_CHECKLIST_NAME,
        DONE_ITEM_NAME,
        key,
        token,
      );
  }

  await deleteOtherChecklists(
    statusChecklists,
    new Set([
      statusChecklist.id,
    ]),
    key,
    token,
  );

  await ensureSingleChecklistItem(
    statusChecklist,
    DONE_ITEM_NAME,
    key,
    token,
  );

  await removeChecklistItemsByName(
    statusChecklist,
    INITIAL_RELEASE_ITEM_NAME,
    key,
    token,
  );

  await deleteOtherChecklists(
    commitmentChecklists,
    new Set(),
    key,
    token,
  );
}

async function syncPartialOrderChecklists(
  cardId: string,
  allChecklists: Checklist[],
  key: string,
  token: string,
) {
  const statusChecklists =
    allChecklists.filter(
      isStatusChecklist,
    );

  const commitmentChecklists =
    allChecklists.filter(
      isInitialCommitmentChecklist,
    );

  const initialReleaseWasCompleted =
    allChecklists.some(
      (checklist) =>
        findItemsByName(
          checklist,
          INITIAL_RELEASE_ITEM_NAME,
        ).some(
          (item) =>
            item.state ===
            "complete",
        ),
    );

  let statusChecklist =
    chooseChecklistPreferCompleted(
      statusChecklists.filter(
        (checklist) =>
          hasItem(
            checklist,
            DONE_ITEM_NAME,
          ),
      ),
      DONE_ITEM_NAME,
    );

  statusChecklist ??=
    [
      ...statusChecklists,
    ].sort((a, b) =>
      a.id.localeCompare(
        b.id,
      ),
    )[0];

  if (
    !statusChecklist
  ) {
    statusChecklist =
      await createChecklistWithItem(
        cardId,
        STATUS_CHECKLIST_NAME,
        DONE_ITEM_NAME,
        key,
        token,
      );
  }

  let commitmentChecklist =
    chooseChecklistPreferCompleted(
      commitmentChecklists,
      INITIAL_RELEASE_ITEM_NAME,
    );

  if (
    !commitmentChecklist
  ) {
    commitmentChecklist =
      await createChecklistWithItem(
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
    new Set([
      statusChecklist.id,
    ]),
    key,
    token,
  );

  await deleteOtherChecklists(
    commitmentChecklists,
    new Set([
      commitmentChecklist.id,
    ]),
    key,
    token,
  );

  await ensureSingleChecklistItem(
    statusChecklist,
    DONE_ITEM_NAME,
    key,
    token,
  );

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
  for (
    let attempt = 0;
    attempt < 2;
    attempt += 1
  ) {
    const allChecklists =
      await getCardChecklists(
        cardId,
        key,
        token,
      );

    if (
      deliveryStrategy ===
      "PARTIAL"
    ) {
      await syncPartialOrderChecklists(
        cardId,
        allChecklists,
        key,
        token,
      );
    } else {
      await syncCompleteOrderChecklists(
        cardId,
        allChecklists,
        key,
        token,
      );
    }
  }
}

async function loadSourceOrderData(
  cardId: string,
  card: TrelloCard,
): Promise<SourceOrderData> {
  const [
    birRecord,
    nonBirRecord,
  ] = await Promise.all([
    findReceivedATPByCardId(
      cardId,
    ),
    findNonBIROrderByCardId(
      cardId,
    ),
  ]);

  const birRow =
    birRecord?.row || [];

  const nonBirRow =
    nonBirRecord?.row || [];

  const cardName =
    String(
      card.name || "",
    ).toUpperCase();

  const isNonBir =
    Boolean(
      nonBirRecord,
    ) ||
    cardName.includes(
      "NON-BIR",
    ) ||
    cardName.includes(
      "NON BIR",
    );

  return {
    isNonBir,

    trackingNo: isNonBir
      ? value(
          nonBirRow[0],
        )
      : value(
          birRow[1],
        ),

    tradeName: isNonBir
      ? value(
          nonBirRow[2],
        )
      : value(
          birRow[6],
        ),

    ocn: isNonBir
      ? "-"
      : value(
          birRow[3],
        ),

    tin: isNonBir
      ? "-"
      : value(
          birRow[4],
        ),

    rdo: isNonBir
      ? "-"
      : value(
          birRow[8],
        ),

    documentType:
      isNonBir
        ? value(
            nonBirRow[3],
          )
        : value(
            birRow[10],
          ),

    taxType: isNonBir
      ? "NON-BIR"
      : value(
          birRow[11],
        ),

    atp: isNonBir
      ? "-"
      : value(
          birRow[16],
        ),

    qty: isNonBir
      ? value(
          nonBirRow[4],
        )
      : value(
          birRow[12],
        ),

    serial: isNonBir
      ? value(
          nonBirRow[5],
        )
      : value(
          birRow[15],
        ),
  };
}

function buildSourceDocuments(
  source: SourceOrderData,
): DocumentSpecificationPayload[] {
  const documentTypes =
    splitOrderValues(
      source.documentType,
    );

  const quantities =
    splitOrderValues(
      source.qty,
    );

  const serialRanges =
    splitOrderValues(
      source.serial,
    );

  const documentCount =
    Math.max(
      documentTypes.length,
      quantities.length,
      serialRanges.length,
      1,
    );

  return Array.from(
    {
      length:
        documentCount,
    },
    (_, index) => {
      const documentType =
        documentTypes[
          index
        ] ||
        (documentTypes.length ===
        1
          ? documentTypes[0]
          : `Document ${
              index + 1
            }`);

      const quantity =
        quantities[index] ||
        (quantities.length ===
          1 &&
        documentCount === 1
          ? quantities[0]
          : "");

      const serialRange =
        serialRanges[
          index
        ] ||
        (serialRanges.length ===
          1 &&
        documentCount === 1
          ? serialRanges[0]
          : "");

      return {
        id: createDocumentId(
          documentType,
          index,
        ),

        documentType,
        quantity,
        serialRange,

        paperType: "",
        ply: "",
        size: "",

        specialInstructions:
          "",
      };
    },
  );
}

function buildDocumentSpecificationsSection(
  documents: DocumentSpecificationPayload[],
) {
  const blocks =
    documents.map(
      (
        document,
        index,
      ) => `
DOCUMENT ${index + 1}
ID: ${sanitizeDescriptionLine(
        document.id,
      )}
TYPE: ${sanitizeDescriptionLine(
        document.documentType,
      )}
QTY: ${sanitizeDescriptionLine(
        document.quantity,
      )}
SERIAL: ${sanitizeDescriptionLine(
        document.serialRange,
      )}
PAPER: ${sanitizeDescriptionLine(
        document.paperType,
      )}
PLY: ${sanitizeDescriptionLine(
        document.ply,
      )}
SIZE: ${sanitizeDescriptionLine(
        document.size,
      )}
SPECIAL: ${sanitizeDescriptionLine(
        document.specialInstructions,
      )}
`.trim(),
    );

  return `
${DOCUMENT_SPECIFICATIONS_START}

${blocks.join("\n\n")}

${DOCUMENT_SPECIFICATIONS_END}
`.trim();
}

function parseDocumentSpecifications(
  description: string,
): DocumentSpecificationPayload[] {
  const startIndex =
    description.indexOf(
      DOCUMENT_SPECIFICATIONS_START,
    );

  const endIndex =
    description.indexOf(
      DOCUMENT_SPECIFICATIONS_END,
    );

  if (
    startIndex < 0 ||
    endIndex < 0 ||
    endIndex <=
      startIndex
  ) {
    return [];
  }

  const section =
    description.slice(
      startIndex +
        DOCUMENT_SPECIFICATIONS_START.length,
      endIndex,
    );

  const blocks =
    section
      .split(
        /(?=^DOCUMENT\s+\d+\s*$)/gim,
      )
      .map(
        (block) =>
          block.trim(),
      )
      .filter(
        (block) =>
          /^DOCUMENT\s+\d+/i.test(
            block,
          ),
      );

  return blocks.map(
    (
      block,
      index,
    ) => ({
      id:
        cleanStoredValue(
          extractDescriptionValue(
            block,
            "ID",
          ),
        ) ||
        `document-${
          index + 1
        }`,

      documentType:
        cleanStoredValue(
          extractDescriptionValue(
            block,
            "TYPE",
          ),
        ) ||
        `Document ${
          index + 1
        }`,

      quantity:
        cleanStoredValue(
          extractDescriptionValue(
            block,
            "QTY",
          ),
        ),

      serialRange:
        cleanStoredValue(
          extractDescriptionValue(
            block,
            "SERIAL",
          ),
        ),

      paperType:
        cleanStoredValue(
          extractDescriptionValue(
            block,
            "PAPER",
          ),
        ),

      ply:
        cleanStoredValue(
          extractDescriptionValue(
            block,
            "PLY",
          ),
        ),

      size:
        cleanStoredValue(
          extractDescriptionValue(
            block,
            "SIZE",
          ),
        ),

      specialInstructions:
        cleanStoredValue(
          extractDescriptionValue(
            block,
            "SPECIAL",
          ),
        ),
    }),
  );
}

function mergeSourceAndSavedDocuments(
  sourceDocuments: DocumentSpecificationPayload[],
  savedDocuments: DocumentSpecificationPayload[],
) {
  if (
    savedDocuments.length ===
    0
  ) {
    return sourceDocuments;
  }

  const matchedSavedIndexes =
    new Set<number>();

  const mergedDocuments =
    sourceDocuments.map(
      (
        sourceDocument,
        sourceIndex,
      ) => {
        let savedIndex =
          savedDocuments.findIndex(
            (
              document,
              index,
            ) =>
              !matchedSavedIndexes.has(
                index,
              ) &&
              document.id ===
                sourceDocument.id,
          );

        if (
          savedIndex < 0
        ) {
          savedIndex =
            savedDocuments.findIndex(
              (
                document,
                index,
              ) =>
                !matchedSavedIndexes.has(
                  index,
                ) &&
                normalize(
                  document.documentType,
                ) ===
                  normalize(
                    sourceDocument.documentType,
                  ),
            );
        }

        if (
          savedIndex < 0
        ) {
          savedIndex =
            savedDocuments.findIndex(
              (
                _document,
                index,
              ) =>
                !matchedSavedIndexes.has(
                  index,
                ) &&
                index ===
                  sourceIndex,
            );
        }

        if (
          savedIndex < 0
        ) {
          return sourceDocument;
        }

        matchedSavedIndexes.add(
          savedIndex,
        );

        const savedDocument =
          savedDocuments[
            savedIndex
          ];

        return {
          ...sourceDocument,

          id:
            savedDocument.id ||
            sourceDocument.id,

          documentType:
            savedDocument.documentType ||
            sourceDocument.documentType,

          quantity:
            savedDocument.quantity ||
            sourceDocument.quantity,

          serialRange:
            savedDocument.serialRange ||
            sourceDocument.serialRange,

          paperType:
            savedDocument.paperType ||
            "",

          ply:
            savedDocument.ply ||
            "",

          size:
            savedDocument.size ||
            "",

          specialInstructions:
            savedDocument.specialInstructions ||
            "",
        };
      },
    );

  const unmatchedSavedDocuments =
    savedDocuments.filter(
      (
        _document,
        index,
      ) =>
        !matchedSavedIndexes.has(
          index,
        ),
    );

  return [
    ...mergedDocuments,
    ...unmatchedSavedDocuments,
  ];
}

function summarizeDocumentField(
  documents: DocumentSpecificationPayload[],
  field:
    | "paperType"
    | "ply"
    | "size",
) {
  const uniqueValues =
    Array.from(
      new Set(
        documents
          .map(
            (document) =>
              textValue(
                document[
                  field
                ],
              ),
          )
          .filter(
            Boolean,
          ),
      ),
    );

  if (
    uniqueValues.length ===
    0
  ) {
    return "-";
  }

  if (
    uniqueValues.length ===
    1
  ) {
    return uniqueValues[0];
  }

  return "Mixed - See Document Specifications";
}

function validateDocuments(
  documents: DocumentSpecificationPayload[],
) {
  if (
    !Array.isArray(
      documents,
    ) ||
    documents.length ===
      0
  ) {
    return "At least one document specification is required.";
  }

  for (
    let index = 0;
    index <
    documents.length;
    index += 1
  ) {
    const document =
      documents[index];

    const documentName =
      textValue(
        document.documentType,
      ) ||
      `Document ${
        index + 1
      }`;

    if (
      !textValue(
        document.paperType,
      )
    ) {
      return `Paper type is required for ${documentName}.`;
    }

    if (
      !textValue(
        document.ply,
      )
    ) {
      return `Ply is required for ${documentName}.`;
    }

    if (
      !textValue(
        document.size,
      )
    ) {
      return `Size is required for ${documentName}.`;
    }
  }

  return "";
}

function normalizeDocuments(
  documents: DocumentSpecificationPayload[],
) {
  return documents.map(
    (
      document,
      index,
    ) => {
      const documentType =
        textValue(
          document.documentType,
        ) ||
        `Document ${
          index + 1
        }`;

      return {
        id:
          textValue(
            document.id,
          ) ||
          createDocumentId(
            documentType,
            index,
          ),

        documentType,

        quantity:
          textValue(
            document.quantity,
          ),

        serialRange:
          textValue(
            document.serialRange,
          ),

        paperType:
          textValue(
            document.paperType,
          ),

        ply:
          textValue(
            document.ply,
          ),

        size:
          textValue(
            document.size,
          ),

        specialInstructions:
          textValue(
            document.specialInstructions,
          ),
      };
    },
  );
}

function parseSavedDeliveryStrategy(
  description: string,
): DeliveryStrategy {
  const savedStrategy =
    extractDescriptionValue(
      description,
      "DELIVERY STRATEGY",
    );

  if (
    normalize(
      savedStrategy,
    ) ===
      normalize(
        "Partial Release",
      ) ||
    normalize(
      savedStrategy,
    ) === "PARTIAL"
  ) {
    return "PARTIAL";
  }

  return "COMPLETE";
}

function parseSavedNumberField(
  description: string,
  fieldName: string,
  fallback: string,
) {
  const savedValue =
    cleanStoredValue(
      extractDescriptionValue(
        description,
        fieldName,
      ),
    );

  if (
    !savedValue
  ) {
    return fallback;
  }

  const numberOnly =
    savedValue.replace(
      /\s*Booklets?$/i,
      "",
    );

  return (
    numberOnly ||
    fallback
  );
}

export async function GET(
  _req: Request,
  context: RouteContext,
) {
  try {
    const {
      cardId,
    } =
      await context.params;

    const key =
      process.env
        .TRELLO_KEY;

    const token =
      process.env
        .TRELLO_TOKEN;

    if (
      !key ||
      !token
    ) {
      return NextResponse.json(
        {
          error:
            "Missing Trello environment variables.",
        },
        {
          status: 500,
        },
      );
    }

    const card =
      await trelloRequest<TrelloCard>(
        `https://api.trello.com/1/cards/${cardId}?fields=id,name,desc&key=${key}&token=${token}`,
      );

    const source =
      await loadSourceOrderData(
        cardId,
        card,
      );

    const sourceDocuments =
      buildSourceDocuments(
        source,
      );

    const savedDocuments =
      parseDocumentSpecifications(
        card.desc || "",
      );

    const documents =
      mergeSourceAndSavedDocuments(
        sourceDocuments,
        savedDocuments,
      );

    const description =
      card.desc || "";

    return NextResponse.json(
      {
        cardId:
          card.id,

        cardName:
          card.name,

        sourceType:
          source.isNonBir
            ? "NON_BIR"
            : "BIR",

        documents,

        orderPriority:
          cleanStoredValue(
            extractDescriptionValue(
              description,
              "PRIORITY",
            ),
          ),

        deliveryStrategy:
          parseSavedDeliveryStrategy(
            description,
          ),

        initialReleaseQty:
          parseSavedNumberField(
            description,
            "INITIAL RELEASE QTY",
            "10",
          ),

        initialDueWorkingDays:
          parseSavedNumberField(
            description,
            "INITIAL DUE WD",
            "10",
          ),

        finalDueWorkingDays:
          parseSavedNumberField(
            description,
            "FINAL DUE WD",
            "30",
          ),
      },
    );
  } catch (error) {
    console.error(
      "GET production details error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof
          Error
            ? error.message
            : "Unable to load production details.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function PUT(
  req: Request,
  context: RouteContext,
) {
  try {
    const {
      cardId,
    } =
      await context.params;

    const body =
      (await req.json()) as ProductionDetailsPayload;

    const editMode =
      body.mode === "edit";

    const key =
      process.env
        .TRELLO_KEY;

    const token =
      process.env
        .TRELLO_TOKEN;

    const boardId =
      process.env
        .TRELLO_BOARD_ID;

    const station4ListId =
      process.env
        .TRELLO_STATION4_LIST_ID;

    if (
      !key ||
      !token ||
      !boardId ||
      (!editMode &&
        !station4ListId)
    ) {
      return NextResponse.json(
        {
          error:
            "Missing Trello environment variables.",
        },
        {
          status: 500,
        },
      );
    }

    if (
      !textValue(
        body.orderPriority,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Order priority is required.",
        },
        {
          status: 400,
        },
      );
    }

    const documentValidationError =
      validateDocuments(
        body.documents,
      );

    if (
      documentValidationError
    ) {
      return NextResponse.json(
        {
          error:
            documentValidationError,
        },
        {
          status: 400,
        },
      );
    }

    const documents =
      normalizeDocuments(
        body.documents,
      );

    const card =
      await trelloRequest<TrelloCard>(
        `https://api.trello.com/1/cards/${cardId}?fields=id,name,desc&key=${key}&token=${token}`,
      );

    const source =
      await loadSourceOrderData(
        cardId,
        card,
      );

    const actions =
      await getCardMoveActions(
        cardId,
        key,
        token,
      );

    const productionStartRaw =
      findFirstMoveInto(
        actions,
        PRODUCTION_START_LIST,
      );

    const productionStartDate =
      productionStartRaw
        ? new Date(
            productionStartRaw,
          )
        : null;

    const deliveryStrategy: DeliveryStrategy =
      body.deliveryStrategy ===
      "PARTIAL"
        ? "PARTIAL"
        : "COMPLETE";

    const initialReleaseQty =
      value(
        body.initialReleaseQty ||
          "10",
      );

    const initialDueWorkingDays =
      toPositiveNumber(
        body.initialDueWorkingDays,
        10,
      );

    const isRush =
      body.orderPriority
        .trim()
        .toLowerCase() ===
      "rush";

    const finalDueWorkingDays =
      deliveryStrategy ===
      "PARTIAL"
        ? toPositiveNumber(
            body.finalDueWorkingDays,
            30,
          )
        : isRush
          ? 3
          : 10;

    if (
      deliveryStrategy ===
        "PARTIAL" &&
      finalDueWorkingDays <
        initialDueWorkingDays
    ) {
      return NextResponse.json(
        {
          error:
            "Final due working days cannot be earlier than initial due working days.",
        },
        {
          status: 400,
        },
      );
    }

    const initialDueDate =
      productionStartDate &&
      deliveryStrategy ===
        "PARTIAL"
        ? addWorkingDays(
            productionStartDate,
            initialDueWorkingDays,
          )
        : null;

    const finalDueDate =
      productionStartDate
        ? addWorkingDays(
            productionStartDate,
            finalDueWorkingDays,
          )
        : null;

    const trelloDueDate =
      deliveryStrategy ===
      "PARTIAL"
        ? initialDueDate
        : finalDueDate;

    const paperSummary =
      summarizeDocumentField(
        documents,
        "paperType",
      );

    const plySummary =
      summarizeDocumentField(
        documents,
        "ply",
      );

    const sizeSummary =
      summarizeDocumentField(
        documents,
        "size",
      );

    const documentSpecifications =
      buildDocumentSpecificationsSection(
        documents,
      );

    const compactDescription = `
TRACKING: ${source.trackingNo}

OCN: ${source.ocn}
TIN: ${source.tin}

TRADE NAME: ${source.tradeName}
RDO: ${source.rdo}

DOCUMENT: ${source.documentType}
TAX TYPE: ${source.taxType}
ATP: ${source.atp}

QTY: ${source.qty}
SERIAL: ${source.serial}

PRIORITY: ${body.orderPriority}

DELIVERY COMMITMENT:
DELIVERY STRATEGY: ${getDeliveryLabel(
      deliveryStrategy,
    )}
INITIAL RELEASE QTY: ${
      deliveryStrategy ===
      "PARTIAL"
        ? `${initialReleaseQty} Booklets`
        : "-"
    }
INITIAL DUE WD: ${
      deliveryStrategy ===
      "PARTIAL"
        ? initialDueWorkingDays
        : "-"
    }
FINAL DUE WD: ${finalDueWorkingDays}
PRODUCTION START: ${
      productionStartDate
        ? formatDateOnly(
            productionStartDate,
          )
        : "Not Started"
    }
INITIAL DUE DATE: ${
      initialDueDate
        ? formatDateOnly(
            initialDueDate,
          )
        : "Pending Station 1 & 2"
    }
FINAL DUE DATE: ${
      finalDueDate
        ? formatDateOnly(
            finalDueDate,
          )
        : "Pending Station 1 & 2"
    }

PRODUCTION:
PAPER: ${paperSummary}
PLY: ${plySummary}
SIZE: ${sizeSummary}
SPECIAL: See individual document specifications
STATUS: Production Details Complete

${documentSpecifications}
`.trim();

    /*
     * IMPORTANT:
     *
     * Initial completion:
     *   - updates production details
     *   - moves card to Station 4
     *
     * Edit mode:
     *   - updates production details
     *   - DOES NOT send idList
     *   - Trello therefore keeps the card
     *     in its current station
     */
    const updatePayload: {
      desc: string;
      due: string | null;
      idList?: string;
    } = {
      desc:
        compactDescription,

      due: trelloDueDate
        ? trelloDueDate.toISOString()
        : null,
    };

    if (
      !editMode &&
      station4ListId
    ) {
      updatePayload.idList =
        station4ListId;
    }

    const updatedCard =
      await trelloRequest<TrelloCard>(
        `https://api.trello.com/1/cards/${cardId}?key=${key}&token=${token}`,
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(
            updatePayload,
          ),
        },
      );

    await removeOldPriorityLabels(
      cardId,
      key,
      token,
    );

    const priorityLabelId =
      await getOrCreatePriorityLabel(
        key,
        token,
        boardId,
        body.orderPriority,
      );

    await addLabelToCard(
      cardId,
      priorityLabelId,
      key,
      token,
    );

    await syncProductionChecklists(
      cardId,
      deliveryStrategy,
      key,
      token,
    );

    await syncPartialOrderLabel(
      cardId,
      deliveryStrategy,
      key,
      token,
      boardId,
    );

    return NextResponse.json(
      {
        success: true,
        mode: editMode
          ? "edit"
          : "initial",
        stationPreserved:
          editMode,
        card: updatedCard,
        documents,
        deliveryStrategy,
        partialOrderLabel:
          deliveryStrategy ===
          "PARTIAL",
      },
    );
  } catch (error) {
    console.error(
      "PUT production details error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof
          Error
            ? error.message
            : "Server error while saving production details.",
      },
      {
        status: 500,
      },
    );
  }
}