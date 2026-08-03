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
} from "@/lib/transactions/types";
import {
  generateTransactionNumber,
  normalizeTransactionInput,
} from "@/lib/transactions/utils";

export const dynamic = "force-dynamic";

function isValidationError(message: string): boolean {
  return (
    message.endsWith("is required.") ||
    message.startsWith("Please select") ||
    message.startsWith("Please add") ||
    message.startsWith("Each invoice")
  );
}

export async function GET() {
  try {
    const transactions = await getTransactionRecords();

    const sortedTransactions = [...transactions].sort(
      (first, second) => {
        const firstTime = new Date(
          first.createdAt || first.updatedAt,
        ).getTime();

        const secondTime = new Date(
          second.createdAt || second.updatedAt,
        ).getTime();

        if (
          Number.isNaN(firstTime) ||
          Number.isNaN(secondTime)
        ) {
          return second.rowNumber - first.rowNumber;
        }

        return secondTime - firstTime;
      },
    );

    return NextResponse.json({
      success: true,
      data: sortedTransactions,
      transactions: sortedTransactions,
      total: sortedTransactions.length,
    });
  } catch (error) {
    console.error("Load transactions error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load transactions.",
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
): Promise<NextResponse<CreateTransactionResponse>> {
  let createdCardId = "";

  try {
    const body = (await request.json()) as Record<
      string,
      unknown
    >;

    const transactionInput =
      normalizeTransactionInput(body);

    const transactionNo =
      generateTransactionNumber();

    const now = new Date().toISOString();

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

    const transactionRecord: TransactionRecord = {
      ...transactionWithoutCard,
      trelloCardId: trelloCard.id,
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
        transaction: transactionRecord,
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error";

    console.error("Create transaction error:", {
      createdCardId,
      message,
    });

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
        status: validationError ? 400 : 500,
      },
    );
  }
}