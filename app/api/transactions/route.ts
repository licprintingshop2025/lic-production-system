import { NextResponse } from "next/server";
import {
  appendTransactionRow,
  getTransactionRecords,
} from "@/lib/googleSheets";
import {
  createTransactionTrelloCard,
  deleteTransactionTrelloCard,
} from "@/lib/transactions/trello";
import type {
  CreateTransactionResponse,
  TransactionRecord,
  TransactionSheetRecord,
} from "@/lib/transactions/types";
import {
  generateTransactionNumber,
  normalizeTransactionInput,
} from "@/lib/transactions/utils";

export const dynamic = "force-dynamic";

type LiveTransactionStatus =
  | "Pending"
  | "In Progress"
  | "On Hold"
  | "Completed";

type TrelloBoardList = {
  id: string;
  name: string;
  closed?: boolean;
};

type TrelloBoardCard = {
  id: string;
  idList: string;
  closed?: boolean;
};

type EnrichedTransactionRecord =
  Omit<TransactionSheetRecord, "status"> & {
    status: LiveTransactionStatus;
    currentStage: string;
    currentListId: string;
    canEdit: boolean;
    documentCount: number;
    trelloSyncAvailable: boolean;
  };

type TransactionWorkflowDetails = {
  status: LiveTransactionStatus;
  currentStage: string;
  currentListId: string;
  canEdit: boolean;
  trelloSyncAvailable: boolean;
};

type TransactionBoardSnapshot = {
  listById: Map<string, TrelloBoardList>;
  cardById: Map<string, TrelloBoardCard>;
};

function isValidationError(message: string): boolean {
  return (
    message.endsWith("is required.") ||
    message.startsWith("Please select") ||
    message.startsWith("Please add") ||
    message.startsWith("Each invoice")
  );
}

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeListName(value: unknown): string {
  return cleanText(value)
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function buildTrelloUrl(
  pathname: string,
  key: string,
  token: string,
): string {
  const url = new URL(
    `https://api.trello.com/1${pathname}`,
  );

  url.searchParams.set("key", key);
  url.searchParams.set("token", token);

  return url.toString();
}

function getTransactionBoardCredentials() {
  const key = cleanText(process.env.TRELLO_KEY);
  const token = cleanText(process.env.TRELLO_TOKEN);

  const boardId = cleanText(
    process.env.TRELLO_TRANSACTIONS_BOARD_ID,
  );

  if (!key) {
    throw new Error(
      "Missing TRELLO_KEY environment variable.",
    );
  }

  if (!token) {
    throw new Error(
      "Missing TRELLO_TOKEN environment variable.",
    );
  }

  if (!boardId) {
    throw new Error(
      "Missing TRELLO_TRANSACTIONS_BOARD_ID environment variable.",
    );
  }

  return {
    key,
    token,
    boardId,
  };
}

async function getTransactionBoardSnapshot(): Promise<TransactionBoardSnapshot> {
  const { key, token, boardId } =
    getTransactionBoardCredentials();

  const listsUrl = buildTrelloUrl(
    `/boards/${encodeURIComponent(boardId)}/lists`,
    key,
    token,
  );

  const cardsUrl = buildTrelloUrl(
    `/boards/${encodeURIComponent(boardId)}/cards`,
    key,
    token,
  );

  const listsRequestUrl = new URL(listsUrl);
  listsRequestUrl.searchParams.set(
    "fields",
    "id,name,closed",
  );
  listsRequestUrl.searchParams.set(
    "filter",
    "all",
  );

  const cardsRequestUrl = new URL(cardsUrl);
  cardsRequestUrl.searchParams.set(
    "fields",
    "id,idList,closed",
  );
  cardsRequestUrl.searchParams.set(
    "filter",
    "all",
  );

  const [listsResponse, cardsResponse] =
    await Promise.all([
      fetch(listsRequestUrl.toString(), {
        method: "GET",
        cache: "no-store",
      }),

      fetch(cardsRequestUrl.toString(), {
        method: "GET",
        cache: "no-store",
      }),
    ]);

  if (!listsResponse.ok) {
    const responseText =
      await listsResponse.text();

    throw new Error(
      `Failed to load Transactions Trello lists: ${
        responseText || listsResponse.statusText
      }`,
    );
  }

  if (!cardsResponse.ok) {
    const responseText =
      await cardsResponse.text();

    throw new Error(
      `Failed to load Transactions Trello cards: ${
        responseText || cardsResponse.statusText
      }`,
    );
  }

  const lists =
    (await listsResponse.json()) as TrelloBoardList[];

  const cards =
    (await cardsResponse.json()) as TrelloBoardCard[];

  return {
    listById: new Map(
      lists.map((list) => [list.id, list]),
    ),

    cardById: new Map(
      cards.map((card) => [card.id, card]),
    ),
  };
}

function getTransactionStatusFromList(
  listName: string,
): LiveTransactionStatus {
  const normalizedName =
    normalizeListName(listName);

  /*
   * Completed
   */
  if (
    normalizedName.includes(
      "DONE SECURING BY LIC",
    ) ||
    normalizedName.includes(
      "DONE SECURING",
    )
  ) {
    return "Completed";
  }

  /*
   * On Hold
   */
  if (
    normalizedName.includes(
      "WITH PROBLEMS",
    ) ||
    normalizedName.includes(
      "CONCERNS NEED TO SETTLE",
    ) ||
    normalizedName.includes(
      "PROBLEMS AND CONCERNS",
    )
  ) {
    return "On Hold";
  }

  /*
   * In Progress
   */
  if (
    normalizedName.includes(
      "PROCESSING VIA ORUS",
    ) ||
    normalizedName.includes(
      "FOR PROCESSING BY",
    ) ||
    normalizedName.includes(
      "BIR OFFICES",
    ) ||
    normalizedName.includes(
      "ALREADY RECEIVED FOR PROCESSING",
    )
  ) {
    return "In Progress";
  }

  /*
   * Pending
   */
  if (
    normalizedName.includes(
      "NEW TRANSACTIONS",
    ) ||
    normalizedName.includes(
      "ALL ACCEPTED TRANSACTIONS",
    ) ||
    normalizedName.includes(
      "TEXT MESSAGING",
    ) ||
    normalizedName.includes(
      "ACKNOWLEDGING OF APPLICATION",
    ) ||
    normalizedName.includes(
      "APPROVAL",
    ) ||
    normalizedName.includes(
      "IMMEDIATE SCHEDULING",
    )
  ) {
    return "Pending";
  }

  /*
   * An unfamiliar list on the Transactions Board should
   * not be interpreted as a printing station. Keep it
   * Pending until it is intentionally added to the map.
   */
  return "Pending";
}

function getDisplayStage(
  listName: string,
): string {
  const normalizedName =
    normalizeListName(listName);

  if (
    normalizedName.includes(
      "NEW TRANSACTIONS",
    )
  ) {
    return "New Transactions";
  }

  if (
    normalizedName.includes(
      "ALL ACCEPTED TRANSACTIONS",
    )
  ) {
    return "All Accepted Transactions";
  }

  if (
    normalizedName.includes(
      "TEXT MESSAGING",
    ) ||
    normalizedName.includes(
      "ACKNOWLEDGING OF APPLICATION",
    )
  ) {
    return "Text Messaging";
  }

  if (
    normalizedName.includes(
      "APPROVAL",
    ) &&
    normalizedName.includes(
      "SCHEDULING",
    )
  ) {
    return "Approval & Immediate Scheduling";
  }

  if (
    normalizedName.includes(
      "PROCESSING VIA ORUS",
    )
  ) {
    return "Processing via ORUS";
  }

  if (
    normalizedName.includes(
      "FOR PROCESSING BY",
    )
  ) {
    const processorMatch =
      listName.match(
        /FOR\s+PROCESSING\s+BY\s*:?\s*(.+)$/i,
      );

    const processorName =
      cleanText(processorMatch?.[1])
        .replace(/\([^)]*\)/g, "")
        .trim();

    return processorName
      ? `For Processing by ${processorName}`
      : "For Processing";
  }

  if (
    normalizedName.includes(
      "WITH PROBLEMS",
    ) ||
    normalizedName.includes(
      "CONCERNS NEED TO SETTLE",
    )
  ) {
    return "With Problems & Concerns";
  }

  if (
    normalizedName.includes(
      "BIR OFFICES",
    )
  ) {
    return "BIR Offices";
  }

  if (
    normalizedName.includes(
      "DONE SECURING",
    )
  ) {
    return "Done Securing by LIC Liaison Officer";
  }

  return cleanText(listName) || "Stage Unavailable";
}

function getFallbackWorkflowDetails(
  transaction: TransactionSheetRecord,
): TransactionWorkflowDetails {
  const storedStatus =
    cleanText(transaction.status);

  let fallbackStatus: LiveTransactionStatus =
    "Pending";

  if (storedStatus === "Completed") {
    fallbackStatus = "Completed";
  } else if (
    storedStatus === "In Progress"
  ) {
    fallbackStatus = "In Progress";
  }

  return {
    status: fallbackStatus,
    currentStage: transaction.trelloCardId
      ? "Trello stage unavailable"
      : "No Trello card linked",
    currentListId: "",
    canEdit:
      fallbackStatus !== "Completed",
    trelloSyncAvailable: false,
  };
}

function getWorkflowDetails(
  transaction: TransactionSheetRecord,
  snapshot: TransactionBoardSnapshot,
): TransactionWorkflowDetails {
  const cardId = cleanText(
    transaction.trelloCardId,
  );

  if (!cardId) {
    return getFallbackWorkflowDetails(
      transaction,
    );
  }

  const card =
    snapshot.cardById.get(cardId);

  if (!card) {
    return {
      ...getFallbackWorkflowDetails(
        transaction,
      ),
      currentStage:
        "Card not found on Transactions Board",
    };
  }

  const list =
    snapshot.listById.get(card.idList);

  if (!list) {
    return {
      ...getFallbackWorkflowDetails(
        transaction,
      ),
      currentListId: card.idList,
      currentStage:
        "Transaction list unavailable",
    };
  }

  const status =
    getTransactionStatusFromList(
      list.name,
    );

  return {
    status,
    currentStage: getDisplayStage(
      list.name,
    ),
    currentListId: list.id,
    canEdit: status !== "Completed",
    trelloSyncAvailable: true,
  };
}

function enrichTransaction(
  transaction: TransactionSheetRecord,
  snapshot: TransactionBoardSnapshot | null,
): EnrichedTransactionRecord {
  const workflow = snapshot
    ? getWorkflowDetails(
        transaction,
        snapshot,
      )
    : getFallbackWorkflowDetails(
        transaction,
      );

  return {
    ...transaction,
    status: workflow.status,
    currentStage:
      workflow.currentStage,
    currentListId:
      workflow.currentListId,
    canEdit: workflow.canEdit,
    documentCount: Array.isArray(
      transaction.documents,
    )
      ? transaction.documents.length
      : 0,
    trelloSyncAvailable:
      workflow.trelloSyncAvailable,
  };
}

export async function GET() {
  try {
    const transactions =
      await getTransactionRecords();

    /*
     * Load the entire Transactions Trello Board once.
     * This avoids making one Trello request per row.
     *
     * A Trello failure does not prevent Google Sheet
     * transactions from loading. Rows will use their
     * stored fallback status and show that the stage
     * is temporarily unavailable.
     */
    let boardSnapshot:
      | TransactionBoardSnapshot
      | null = null;

    let trelloWarning = "";

    try {
      boardSnapshot =
        await getTransactionBoardSnapshot();
    } catch (trelloError) {
      trelloWarning =
        trelloError instanceof Error
          ? trelloError.message
          : "Transactions Trello workflow could not be loaded.";

      console.error(
        "Load Transactions Trello workflow error:",
        trelloError,
      );
    }

    const enrichedTransactions =
      transactions.map((transaction) =>
        enrichTransaction(
          transaction,
          boardSnapshot,
        ),
      );

    const sortedTransactions = [
      ...enrichedTransactions,
    ].sort((first, second) => {
      const firstTime = new Date(
        first.createdAt ||
          first.updatedAt,
      ).getTime();

      const secondTime = new Date(
        second.createdAt ||
          second.updatedAt,
      ).getTime();

      if (
        Number.isNaN(firstTime) ||
        Number.isNaN(secondTime)
      ) {
        return (
          second.rowNumber -
          first.rowNumber
        );
      }

      return secondTime - firstTime;
    });

    return NextResponse.json({
      success: true,
      data: sortedTransactions,
      transactions:
        sortedTransactions,
      total:
        sortedTransactions.length,
      trelloSyncAvailable:
        Boolean(boardSnapshot),
      warning:
        trelloWarning || undefined,
    });
  } catch (error) {
    console.error(
      "Load transactions error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to load transactions.",
        details:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
): Promise<
  NextResponse<CreateTransactionResponse>
> {
  let createdCardId = "";

  try {
    const body =
      (await request.json()) as Record<
        string,
        unknown
      >;

    const transactionInput =
      normalizeTransactionInput(body);

    const transactionNo =
      generateTransactionNumber();

    const now =
      new Date().toISOString();

    const transactionWithoutCard = {
      ...transactionInput,
      transactionNo,
      createdAt: now,
      updatedAt: now,
    };

    const trelloCard =
      await createTransactionTrelloCard(
        transactionWithoutCard,
      );

    createdCardId = trelloCard.id;

    const transactionRecord: TransactionRecord =
      {
        ...transactionWithoutCard,
        trelloCardId:
          trelloCard.id,
        trelloCardUrl:
          trelloCard.url ||
          trelloCard.shortUrl ||
          "",
      };

    try {
      await appendTransactionRow(
        transactionRecord,
      );
    } catch (sheetError) {
      /*
       * Roll back the newly created Trello card if
       * the Google Sheet row cannot be saved.
       */
      try {
        await deleteTransactionTrelloCard(
          trelloCard.id,
        );
      } catch (rollbackError) {
        console.error(
          "Failed to roll back Transactions Trello card:",
          rollbackError,
        );
      }

      throw new Error(
        sheetError instanceof Error
          ? `Google Sheet save failed: ${sheetError.message}`
          : "Google Sheet save failed.",
      );
    }

    return NextResponse.json(
      {
        success: true,
        transactionNo,
        transaction:
          transactionRecord,
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error";

    console.error(
      "Create transaction error:",
      {
        createdCardId,
        message,
      },
    );

    const validationError =
      isValidationError(message);

    return NextResponse.json(
      {
        success: false,
        error: validationError
          ? message
          : "Server error while creating transaction.",
        details: validationError
          ? undefined
          : message,
      },
      {
        status: validationError
          ? 400
          : 500,
      },
    );
  }
}