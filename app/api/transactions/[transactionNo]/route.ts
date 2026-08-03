import { NextResponse } from "next/server";
import {
  findTransactionByNumber,
  mergeTransactionRecord,
  updateTransactionRow,
} from "@/lib/googleSheets";
import { updateTransactionTrelloCard } from "@/lib/transactions/trello";
import type {
  TransactionRecord,
  UpdateTransactionResponse,
} from "@/lib/transactions/types";
import { normalizeTransactionInput } from "@/lib/transactions/utils";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    transactionNo: string;
  }>;
};

function isValidationError(message: string): boolean {
  return (
    message.endsWith("is required.") ||
    message.startsWith("Please select") ||
    message.startsWith("Please add") ||
    message.startsWith("Each invoice")
  );
}

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    const { transactionNo: encodedTransactionNo } =
      await context.params;

    const transactionNo = decodeURIComponent(
      encodedTransactionNo,
    ).trim();

    if (!transactionNo) {
      return NextResponse.json(
        {
          success: false,
          error: "Transaction number is required.",
        },
        { status: 400 },
      );
    }

    const transaction =
      await findTransactionByNumber(transactionNo);

    if (!transaction) {
      return NextResponse.json(
        {
          success: false,
          error: `Transaction "${transactionNo}" was not found.`,
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: transaction,
      transaction,
    });
  } catch (error) {
    console.error("Load transaction error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load transaction.",
        details:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<UpdateTransactionResponse>> {
  try {
    const { transactionNo: encodedTransactionNo } =
      await context.params;

    const transactionNo = decodeURIComponent(
      encodedTransactionNo,
    ).trim();

    if (!transactionNo) {
      return NextResponse.json(
        {
          success: false,
          error: "Transaction number is required.",
        },
        { status: 400 },
      );
    }

    const existingTransaction =
      await findTransactionByNumber(transactionNo);

    if (!existingTransaction) {
      return NextResponse.json(
        {
          success: false,
          error: `Transaction "${transactionNo}" was not found.`,
        },
        { status: 404 },
      );
    }

    const body = (await request.json()) as Record<
      string,
      unknown
    >;

    const normalizedInput =
      normalizeTransactionInput(body);

    const updatedTransaction: TransactionRecord =
      mergeTransactionRecord(
        existingTransaction,
        normalizedInput,
      );

    /*
     * Update Trello first. If Trello fails, the Google Sheet
     * remains unchanged.
     */
    const updatedCard =
      await updateTransactionTrelloCard(
        existingTransaction.trelloCardId,
        updatedTransaction,
      );

    const finalTransaction: TransactionRecord = {
      ...updatedTransaction,
      trelloCardId: updatedCard.id,
      trelloCardUrl:
        updatedCard.url ||
        updatedCard.shortUrl ||
        existingTransaction.trelloCardUrl,
    };

    try {
      await updateTransactionRow(
        existingTransaction.rowNumber,
        finalTransaction,
      );
    } catch (sheetError) {
      /*
       * Trello has already been updated at this point.
       * Return a clear synchronization warning instead of
       * silently reporting success.
       */
      return NextResponse.json(
        {
          success: false,
          error:
            "The Trello card was updated, but the Google Sheet could not be updated.",
          details:
            sheetError instanceof Error
              ? sheetError.message
              : "Unknown Google Sheets error",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      transaction: finalTransaction,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error";

    console.error("Update transaction error:", error);

    const validationError =
      isValidationError(message);

    return NextResponse.json(
      {
        success: false,
        error: validationError
          ? message
          : "Failed to update transaction.",
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