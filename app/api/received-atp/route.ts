import { NextResponse } from "next/server";
import { appendReceivedATPRow } from "@/lib/googleSheets";
import { getPHDateTime } from "@/lib/dateTime";
import { generateTrackingNumber } from "@/lib/tracking";

function formatDate(dateValue: string) {
  if (!dateValue) return "-";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return dateValue.toUpperCase();

  return date
    .toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();
}

function clean(value: string | undefined | null) {
  return value?.toString().trim() || "";
}

function getReceiptCode(receiptType: string) {
  const value = receiptType.toUpperCase();

  if (value.includes("SALES")) return "SALES";
  if (value.includes("SERVICE")) return "SI";
  if (value.includes("BILLING")) return "BI";
  if (value.includes("COLLECTION")) return "CR";
  if (value.includes("OFFICIAL")) return "OR";
  if (value.includes("DELIVERY")) return "DR";
  if (value.includes("ACKNOWLEDGEMENT")) return "AR";
  if (value.includes("NON-VAT")) return "NVI";
  if (value.includes("VAT")) return "VI";
  if (value.includes("INVOICE")) return "INV";

  return value || "DOC";
}

function buildOrderType(receiptType: string, booklets: string) {
  const qty = booklets || "0";

  return receiptType
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => `${getReceiptCode(item)}-${qty}`)
    .join(" ");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const key = process.env.TRELLO_KEY;
    const token = process.env.TRELLO_TOKEN;
    const listId = process.env.TRELLO_ATP_INTAKE_LIST_ID;

    if (!key || !token || !listId) {
      return NextResponse.json(
        { error: "Missing Trello environment variables" },
        { status: 500 }
      );
    }

    const trackingNo = generateTrackingNumber();

    const staffName =
      body.salesAssigned === "OTHERS"
        ? clean(body.salesAssignedOther)
        : clean(body.salesAssigned);

    const receiptType =
      body.receiptType === "OTHER"
        ? clean(body.receiptTypeOther)
        : clean(body.receiptType);

    const copies =
      body.copiesPerSet === "OTHER"
        ? clean(body.copiesPerSetOther)
        : clean(body.copiesPerSet);

    const tradeName = clean(body.businessName || body.taxpayerName);
    const branchNo = clean(body.branchNo);
    const rdoCode = clean(body.rdoCode).padStart(3, "0");
    const rdoCodeForSheet = rdoCode ? `'${rdoCode}` : "";
    const taxType = clean(body.taxType);
    const dateOfAtp = formatDate(body.dateOfAtp);
    const atpStatus = clean(body.atpStatus || body.atpReceived || "ATP");
    const booklets = clean(body.noOfBooklets);

    const orderType = buildOrderType(receiptType, booklets);

    const branchText = branchNo ? ` (BRANCH ${branchNo})` : "";
    const rdoText = rdoCode ? ` (${rdoCode})` : "";

    const cardName = `(${staffName || "NO STAFF"}) ${
      tradeName || "NO TRADE NAME"
    }${branchText}${rdoText}
${orderType || "ORDER TYPE"}
${taxType || "TAX TYPE"} ${dateOfAtp} (${atpStatus.toUpperCase()})`;

    const description = `
TRACKING:
${trackingNo}

TIN:
${clean(body.tin) || "-"}

OCN:
${clean(body.ocn) || "-"}

TAXPAYER:
${clean(body.taxpayerName) || "-"}

TRADE NAME:
${tradeName || "-"}

ADDRESS:
${clean(body.registeredAddress) || "-"}

DOCUMENT:
${receiptType || "-"}

MANNER:
${clean(body.mannerDocType) || "-"}

QTY:
${booklets || "-"} Booklets

SETS:
${clean(body.setsPerBooklet) || "-"} per booklet

COPIES:
${copies || "-"} per set

SERIAL:
${clean(body.serialNumbers) || "-"}

RDO:
${rdoCode || "-"}

TAX TYPE:
${taxType || "-"}

ATP STATUS:
${atpStatus || "-"}
`.trim();

    const response = await fetch(
      `https://api.trello.com/1/cards?key=${key}&token=${token}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idList: listId,
          name: cardName,
          desc: description,
          pos: "top",
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      return NextResponse.json(
        { error: "Failed to create Trello card", details: errorText },
        { status: response.status }
      );
    }

    const card = await response.json();

    try {
      const rowData = [
        getPHDateTime(),
        trackingNo,
        body.dateOfAtp,
        clean(body.ocn),
        clean(body.tin),
        clean(body.taxpayerName),
        tradeName,
        clean(body.registeredAddress),
        rdoCodeForSheet,
        clean(body.mannerDocType),
        receiptType,
        taxType,
        booklets,
        clean(body.setsPerBooklet),
        copies,
        clean(body.serialNumbers),
        atpStatus,
        staffName,
        card.id,
      ];

      await appendReceivedATPRow(rowData);
      
    } catch (sheetError) {
      return NextResponse.json(
        {
          error: "Trello card created, but failed to save to Google Sheet",
          trackingNo,
          card,
          details:
            sheetError instanceof Error ? sheetError.message : "Unknown error",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      trackingNo,
      card,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Server error while creating ATP record",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}