import { NextResponse } from "next/server";
import {
  appendNonBIROrderRow,
  getNonBIROrderRows,
} from "@/lib/googleSheets";
import { generateTrackingNumber } from "@/lib/tracking";
import type { NonBIROrder } from "@/lib/orders/types";
import {
  clean,
  normalizeDocuments,
} from "@/lib/orders/utils";
import {
  buildNonBIRCardDescription,
  buildNonBIRCardName,
} from "@/lib/orders/trello";
import { buildNonBIRRow } from "@/lib/orders/sheets";

type DashboardCard = {
  id: string;
  idList: string;
  url?: string;
};

type DashboardList = {
  id: string;
  name: string;
};

function classifyPrintingStatus(
  listName: string,
) {
  const normalized =
    listName
      .trim()
      .toUpperCase();

  if (!normalized) {
    return "Unknown" as const;
  }

  if (
    normalized.includes(
      "READY FOR RELEASE",
    )
  ) {
    return "Ready for Release" as const;
  }

  if (
    normalized.includes(
      "DELIVERED",
    ) ||
    normalized.includes(
      "PICKED UP",
    )
  ) {
    return "Completed" as const;
  }

  if (
    normalized.includes(
      "NON-BIR INTAKE",
    ) ||
    normalized.includes(
      "NON BIR INTAKE",
    ) ||
    normalized.includes(
      "STATION 4",
    )
  ) {
    return "In Admin" as const;
  }

  return "In Production" as const;
}

async function getPrintingBoardState() {
  const key =
    process.env.TRELLO_KEY;

  const token =
    process.env.TRELLO_TOKEN;

  const boardId =
    process.env.TRELLO_BOARD_ID;

  if (
    !key ||
    !token ||
    !boardId
  ) {
    return {
      cards:
        new Map<
          string,
          DashboardCard
        >(),

      lists:
        new Map<
          string,
          string
        >(),

      warning:
        "Missing Trello environment variables.",
    };
  }

  try {
    const [
      cardsResponse,
      listsResponse,
    ] =
      await Promise.all([
        fetch(
          `https://api.trello.com/1/boards/${boardId}/cards?filter=all&fields=id,idList,url&key=${key}&token=${token}`,
          {
            cache:
              "no-store",
          },
        ),

        fetch(
          `https://api.trello.com/1/boards/${boardId}/lists?fields=id,name&key=${key}&token=${token}`,
          {
            cache:
              "no-store",
          },
        ),
      ]);

    if (
      !cardsResponse.ok ||
      !listsResponse.ok
    ) {
      throw new Error(
        "Failed to load Trello board status.",
      );
    }

    const cards =
      (await cardsResponse.json()) as DashboardCard[];

    const lists =
      (await listsResponse.json()) as DashboardList[];

    return {
      cards: new Map(
        cards.map(
          (card) => [
            card.id,
            card,
          ],
        ),
      ),

      lists: new Map(
        lists.map(
          (list) => [
            list.id,
            list.name,
          ],
        ),
      ),

      warning: "",
    };
  } catch (error) {
    return {
      cards:
        new Map<
          string,
          DashboardCard
        >(),

      lists:
        new Map<
          string,
          string
        >(),

      warning:
        error instanceof Error
          ? error.message
          : "Trello status unavailable.",
    };
  }
}

export async function GET() {
  try {
    const rows =
      await getNonBIROrderRows();

    const boardState =
      await getPrintingBoardState();

    const orders =
      rows
        .slice(1)
        .map(
          (
            row,
            index,
          ) => {
            const cardId =
              String(
                row[7] ||
                  "",
              ).trim();

            const card =
              boardState.cards.get(
                cardId,
              );

            const currentStage =
              card
                ? boardState.lists.get(
                    card.idList,
                  ) ||
                  "Unknown"
                : "Unknown";

            return {
              rowNumber:
                index + 2,

              trackingNumber:
                String(
                  row[0] ||
                    "",
                ).trim(),

              submittedAt:
                String(
                  row[1] ||
                    "",
                ).trim(),

              businessName:
                String(
                  row[2] ||
                    "",
                ).trim(),

              orderSummary:
                String(
                  row[3] ||
                    "",
                ).trim(),

              quantitySummary:
                String(
                  row[4] ||
                    "",
                ).trim(),

              salesAssigned:
                String(
                  row[6] ||
                    "",
                ).trim(),

              trelloCardId:
                cardId,

              trelloCardUrl:
                card?.url ||
                "",

              currentStage,

              currentListId:
                card?.idList ||
                "",

              status:
                classifyPrintingStatus(
                  currentStage,
                ),
            };
          },
        )
        .filter(
          (order) =>
            order.trackingNumber ||
            order.businessName ||
            order.trelloCardId,
        );

    return NextResponse.json(
      {
        success: true,
        orders,
        warning:
          boardState.warning ||
          undefined,
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,

        error:
          "Failed to load Non-BIR printing orders.",

        details:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(
  req: Request,
) {
  try {
    const body =
      await req.json();

    const key =
      process.env.TRELLO_KEY;

    const token =
      process.env.TRELLO_TOKEN;

    const intakeListId =
      process.env
        .TRELLO_NON_BIR_INTAKE_LIST_ID;

    if (
      !key ||
      !token ||
      !intakeListId
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

    const trackingNumber =
      body.trackingNumber ||
      generateTrackingNumber();

    const documents =
      normalizeDocuments(
        body.documents,
      );

    if (
      documents.length ===
      0
    ) {
      return NextResponse.json(
        {
          error:
            "Please add at least one document.",
        },
        {
          status: 400,
        },
      );
    }

    const order: NonBIROrder =
      {
        ...body,

        trackingNumber,

        businessName:
          clean(
            body.businessName,
          ),

        salesAssigned:
          clean(
            body.salesAssigned,
          ) || "-",

        documents,
      };

    const cardName =
      buildNonBIRCardName(
        order,
      );

    const cardDesc =
      buildNonBIRCardDescription(
        order,
      );

    const trelloRes =
      await fetch(
        `https://api.trello.com/1/cards?key=${key}&token=${token}`,
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
                intakeListId,

              name:
                cardName,

              desc:
                cardDesc,
            }),
        },
      );

    if (!trelloRes.ok) {
      return NextResponse.json(
        {
          error:
            "Failed to create Trello card.",

          details:
            await trelloRes.text(),
        },
        {
          status:
            trelloRes.status,
        },
      );
    }

    const trelloCard =
      await trelloRes.json();

    await appendNonBIROrderRow(
      buildNonBIRRow(
        order,
        trelloCard.id,
      ),
    );

    return NextResponse.json(
      {
        success: true,
        trackingNumber,
        trelloCardId:
          trelloCard.id,
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save Non-BIR order.",
      },
      {
        status: 500,
      },
    );
  }
}