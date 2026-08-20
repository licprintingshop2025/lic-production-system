import type {
  TransactionInput,
  TransactionRecord,
} from "@/lib/transactions/types";
import {
  getDocumentDescriptions,
  getTotalDocumentQuantity,
  getUniqueTaxTypes,
  serializeStringArray,
} from "@/lib/transactions/utils";
import {
  formatDateForTitle,
} from "@/lib/orders/utils";

type TrelloCard = {
  id: string;
  idList: string;
  name: string;
  desc?: string;
  url: string;
  shortUrl?: string;
};

type TransactionsTrelloConfig = {
  key: string;
  token: string;
  boardId: string;
  listId: string;
};

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function displayText(value: unknown): string {
  return cleanText(value) || "-";
}

function displayList(values: string[]): string {
  const cleanedValues = values
    .map((value) => cleanText(value))
    .filter(Boolean);

  if (cleanedValues.length === 0) {
    return "-";
  }

  return cleanedValues
    .map((value) => `• ${value}`)
    .join("\n");
}

function getBranchNumberFromTin(
  tin: unknown,
): number | null {
  const normalizedTin =
    cleanText(tin).replace(
      /\D/g,
      "",
    );

  if (
    normalizedTin.length < 5
  ) {
    return null;
  }

  const branchCode =
    normalizedTin.slice(-5);

  if (
    !/^\d{5}$/.test(
      branchCode,
    )
  ) {
    return null;
  }

  const branchNumber =
    Number(branchCode);

  if (
    !Number.isFinite(
      branchNumber,
    ) ||
    branchNumber <= 0
  ) {
    return null;
  }

  return branchNumber;
}

function getTransactionsTrelloConfig(): TransactionsTrelloConfig {
  const key =
    process.env.TRELLO_KEY;

  const token =
    process.env.TRELLO_TOKEN;

  const boardId =
    process.env
      .TRELLO_TRANSACTIONS_BOARD_ID;

  const listId =
    process.env
      .TRELLO_TRANSACTIONS_ATP_LIST_ID;

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

  if (!listId) {
    throw new Error(
      "Missing TRELLO_TRANSACTIONS_ATP_LIST_ID environment variable.",
    );
  }

  return {
    key,
    token,
    boardId,
    listId,
  };
}

function buildTrelloUrl(
  pathname: string,
  key: string,
  token: string,
): string {
  const url =
    new URL(
      `https://api.trello.com/1${pathname}`,
    );

  url.searchParams.set(
    "key",
    key,
  );

  url.searchParams.set(
    "token",
    token,
  );

  return url.toString();
}

export function buildTransactionCardName(
  transactionNo: string,
  transaction: TransactionInput,
): string {
  void transactionNo;

  const staffName =
    cleanText(
      transaction.assistedBy,
    )
      .replace(
        /^[^-]+\s*-\s*/,
        "",
      )
      .trim();

  const tradeName =
    cleanText(
      transaction.businessName,
    ) ||
    cleanText(
      transaction.taxpayerName,
    );

  const branchNumber =
    getBranchNumberFromTin(
      transaction.tin,
    );

  const branchText =
    branchNumber !== null
      ? ` (BRANCH ${branchNumber})`
      : "";

  const rdoCode =
    cleanText(
      transaction.rdoCode,
    ).toUpperCase();

  const rdoText =
    rdoCode
      ? ` (${rdoCode})`
      : "";

  const orderType =
    transaction.documents
      .map(
        (document) => {
          const documentType =
            cleanText(
              document.documentType,
            ).toUpperCase();

          return `${
            documentType ||
            "DOCUMENT"
          }-${document.quantity}`;
        },
      )
      .filter(Boolean)
      .join(" / ");

  const taxType =
    getUniqueTaxTypes(
      transaction.documents,
    )
      .map(
        (value) =>
          cleanText(
            value,
          ).toUpperCase(),
      )
      .filter(Boolean)
      .join(" / ");

  const receivedDate =
    formatDateForTitle(
      transaction.dateReceived,
    );

  const formUsed =
    transaction.formUsed
      .map(
        (form) =>
          cleanText(
            form,
          ).toUpperCase(),
      )
      .filter(Boolean)
      .join(" / ");

  const applicationMethod =
    cleanText(
      transaction.applicationMethod,
    ).toUpperCase();

  const titleSuffix = [
    formUsed,
    applicationMethod,
  ]
    .filter(Boolean)
    .join(" ");

  return `(${staffName || "NO STAFF"}) ${
    tradeName ||
    "NO TRADE NAME"
  }${branchText}${rdoText}
${orderType || "ORDER TYPE"}
${
    taxType ||
    "TAX TYPE"
  } ${receivedDate} (${titleSuffix || "FORM"})`;
}

export function buildTransactionCardDescription(
  transaction: TransactionRecord,
): string {
  const documentDescriptions =
    getDocumentDescriptions(
      transaction.documents,
    );

  const taxTypes =
    getUniqueTaxTypes(
      transaction.documents,
    );

  const totalQuantity =
    getTotalDocumentQuantity(
      transaction.documents,
    );

  return [
    "TRANSACTION INFORMATION",
    "",
    `Transaction No.: ${displayText(
      transaction.transactionNo,
    )}`,
    `Status: ${displayText(
      transaction.status,
    )}`,
    `Date Received of Application: ${displayText(
      transaction.dateReceived,
    )}`,
    `Manual or ORUS: ${displayText(
      transaction.applicationMethod,
    )}`,
    "",
    "FORM USED",
    displayList(
      transaction.formUsed,
    ),
    "",
    "TAXPAYER INFORMATION",
    `Taxpayer Name: ${displayText(
      transaction.taxpayerName,
    )}`,
    `Business / Tradename: ${displayText(
      transaction.businessName,
    )}`,
    `TIN: ${displayText(
      transaction.tin,
    )}`,
    `RDO Code: ${displayText(
      transaction.rdoCode,
    )}`,
    "",
    "FORM 1905",
    displayList(
      transaction.form1905,
    ),
    "",
    "COMPUTE PENALTY (0605)",
    displayList(
      transaction.computePenalty,
    ),
    "",
    "INVOICE OR RECEIPT DETAILS",
    displayList(
      documentDescriptions,
    ),
    "",
    "TAX TYPE",
    displayList(
      taxTypes,
    ),
    "",
    `Total No. of Booklets or Pads: ${totalQuantity}`,
    "",
    "CONTACT INFORMATION",
    `Mobile / Viber Number: ${displayText(
      transaction.mobileNumber,
    )}`,
    `Email: ${displayText(
      transaction.email,
    )}`,
    "",
    "ASSIGNMENT",
    `Assisted By: ${displayText(
      transaction.assistedBy,
    )}`,
    `Books: ${displayText(
      serializeStringArray(
        transaction.books,
      ),
    )}`,
    "",
    "SYSTEM INFORMATION",
    `Created At: ${displayText(
      transaction.createdAt,
    )}`,
    `Updated At: ${displayText(
      transaction.updatedAt,
    )}`,
  ].join("\n");
}

export async function createTransactionTrelloCard(
  transaction: Omit<
    TransactionRecord,
    "trelloCardId" |
      "trelloCardUrl"
  >,
): Promise<TrelloCard> {
  const {
    key,
    token,
    listId,
  } =
    getTransactionsTrelloConfig();

  const temporaryRecord: TransactionRecord = {
    ...transaction,
    trelloCardId: "",
    trelloCardUrl: "",
  };

  const response =
    await fetch(
      buildTrelloUrl(
        "/cards",
        key,
        token,
      ),
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            idList:
              listId,

            name:
              buildTransactionCardName(
                transaction.transactionNo,
                transaction,
              ),

            desc:
              buildTransactionCardDescription(
                temporaryRecord,
              ),

            pos:
              "top",
          }),

        cache:
          "no-store",
      },
    );

  if (!response.ok) {
    const responseText =
      await response.text();

    throw new Error(
      `Failed to create Transactions Trello card: ${
        responseText ||
        response.statusText
      }`,
    );
  }

  return (
    await response.json()
  ) as TrelloCard;
}

export async function getTransactionTrelloCard(
  cardId: string,
): Promise<TrelloCard> {
  const normalizedCardId =
    cleanText(cardId);

  if (!normalizedCardId) {
    throw new Error(
      "Missing Transactions Trello card ID.",
    );
  }

  const {
    key,
    token,
  } =
    getTransactionsTrelloConfig();

  const response =
    await fetch(
      buildTrelloUrl(
        `/cards/${encodeURIComponent(
          normalizedCardId,
        )}`,
        key,
        token,
      ),
      {
        method:
          "GET",

        cache:
          "no-store",
      },
    );

  if (!response.ok) {
    const responseText =
      await response.text();

    throw new Error(
      `Failed to load Transactions Trello card: ${
        responseText ||
        response.statusText
      }`,
    );
  }

  return (
    await response.json()
  ) as TrelloCard;
}

export async function updateTransactionTrelloCard(
  cardId: string,
  transaction: TransactionRecord,
): Promise<TrelloCard> {
  const normalizedCardId =
    cleanText(cardId);

  if (!normalizedCardId) {
    throw new Error(
      "Missing Transactions Trello card ID.",
    );
  }

  const {
    key,
    token,
  } =
    getTransactionsTrelloConfig();

  const response =
    await fetch(
      buildTrelloUrl(
        `/cards/${encodeURIComponent(
          normalizedCardId,
        )}`,
        key,
        token,
      ),
      {
        method:
          "PUT",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            name:
              buildTransactionCardName(
                transaction.transactionNo,
                transaction,
              ),

            desc:
              buildTransactionCardDescription(
                transaction,
              ),
          }),

        cache:
          "no-store",
      },
    );

  if (!response.ok) {
    const responseText =
      await response.text();

    throw new Error(
      `Failed to update Transactions Trello card: ${
        responseText ||
        response.statusText
      }`,
    );
  }

  return (
    await response.json()
  ) as TrelloCard;
}

export async function moveTransactionTrelloCard(
  cardId: string,
  targetListId: string,
): Promise<TrelloCard> {
  const normalizedCardId =
    cleanText(cardId);

  const normalizedListId =
    cleanText(
      targetListId,
    );

  if (!normalizedCardId) {
    throw new Error(
      "Missing Transactions Trello card ID.",
    );
  }

  if (!normalizedListId) {
    throw new Error(
      "Missing target Transactions Trello list ID.",
    );
  }

  const {
    key,
    token,
  } =
    getTransactionsTrelloConfig();

  const response =
    await fetch(
      buildTrelloUrl(
        `/cards/${encodeURIComponent(
          normalizedCardId,
        )}`,
        key,
        token,
      ),
      {
        method:
          "PUT",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            idList:
              normalizedListId,
          }),

        cache:
          "no-store",
      },
    );

  if (!response.ok) {
    const responseText =
      await response.text();

    throw new Error(
      `Failed to move Transactions Trello card: ${
        responseText ||
        response.statusText
      }`,
    );
  }

  return (
    await response.json()
  ) as TrelloCard;
}

export async function archiveTransactionTrelloCard(
  cardId: string,
): Promise<TrelloCard> {
  const normalizedCardId =
    cleanText(cardId);

  if (!normalizedCardId) {
    throw new Error(
      "Missing Transactions Trello card ID.",
    );
  }

  const {
    key,
    token,
  } =
    getTransactionsTrelloConfig();

  const response =
    await fetch(
      buildTrelloUrl(
        `/cards/${encodeURIComponent(
          normalizedCardId,
        )}`,
        key,
        token,
      ),
      {
        method:
          "PUT",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            closed:
              true,
          }),

        cache:
          "no-store",
      },
    );

  if (!response.ok) {
    const responseText =
      await response.text();

    throw new Error(
      `Failed to archive Transactions Trello card: ${
        responseText ||
        response.statusText
      }`,
    );
  }

  return (
    await response.json()
  ) as TrelloCard;
}

export async function restoreTransactionTrelloCard(
  cardId: string,
): Promise<TrelloCard> {
  const normalizedCardId =
    cleanText(cardId);

  if (!normalizedCardId) {
    throw new Error(
      "Missing Transactions Trello card ID.",
    );
  }

  const {
    key,
    token,
  } =
    getTransactionsTrelloConfig();

  const response =
    await fetch(
      buildTrelloUrl(
        `/cards/${encodeURIComponent(
          normalizedCardId,
        )}`,
        key,
        token,
      ),
      {
        method:
          "PUT",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            closed:
              false,
          }),

        cache:
          "no-store",
      },
    );

  if (!response.ok) {
    const responseText =
      await response.text();

    throw new Error(
      `Failed to restore Transactions Trello card: ${
        responseText ||
        response.statusText
      }`,
    );
  }

  return (
    await response.json()
  ) as TrelloCard;
}

export async function deleteTransactionTrelloCard(
  cardId: string,
): Promise<{
  success: true;
}> {
  const normalizedCardId =
    cleanText(cardId);

  if (!normalizedCardId) {
    throw new Error(
      "Missing Transactions Trello card ID.",
    );
  }

  const {
    key,
    token,
  } =
    getTransactionsTrelloConfig();

  const response =
    await fetch(
      buildTrelloUrl(
        `/cards/${encodeURIComponent(
          normalizedCardId,
        )}`,
        key,
        token,
      ),
      {
        method:
          "DELETE",

        cache:
          "no-store",
      },
    );

  if (!response.ok) {
    const responseText =
      await response.text();

    throw new Error(
      `Failed to delete Transactions Trello card: ${
        responseText ||
        response.statusText
      }`,
    );
  }

  return {
    success:
      true,
  };
}

export async function verifyTransactionsTrelloConfig() {
  const {
    key,
    token,
    boardId,
    listId,
  } =
    getTransactionsTrelloConfig();

  const [
    boardResponse,
    listResponse,
  ] =
    await Promise.all([
      fetch(
        buildTrelloUrl(
          `/boards/${encodeURIComponent(
            boardId,
          )}`,
          key,
          token,
        ),
        {
          method:
            "GET",

          cache:
            "no-store",
        },
      ),

      fetch(
        buildTrelloUrl(
          `/lists/${encodeURIComponent(
            listId,
          )}`,
          key,
          token,
        ),
        {
          method:
            "GET",

          cache:
            "no-store",
        },
      ),
    ]);

  if (!boardResponse.ok) {
    const responseText =
      await boardResponse.text();

    throw new Error(
      `Transactions Trello board could not be loaded: ${
        responseText ||
        boardResponse.statusText
      }`,
    );
  }

  if (!listResponse.ok) {
    const responseText =
      await listResponse.text();

    throw new Error(
      `Transactions Trello ATP list could not be loaded: ${
        responseText ||
        listResponse.statusText
      }`,
    );
  }

  const board =
    (await boardResponse.json()) as {
      id:
        string;

      name:
        string;
    };

  const list =
    (await listResponse.json()) as {
      id:
        string;

      idBoard:
        string;

      name:
        string;
    };

  if (
    list.idBoard !==
    board.id
  ) {
    throw new Error(
      `The Transactions list "${list.name}" does not belong to the configured board "${board.name}".`,
    );
  }

  return {
    success:
      true,

    board,

    list,
  };
}