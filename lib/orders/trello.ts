import type {
  DocumentItem,
  NonBIROrder,
  ReceivedATPOrder,
} from "./types";
import {
  buildOrderType,
  clean,
  formatDateForTitle,
  getBranchFromTin,
} from "./utils";

export function buildReceivedATPDocumentSection(
  documents: DocumentItem[],
) {
  if (documents.length === 0) {
    return "-";
  }

  return documents
    .map((document, index) => {
      return [
        `DOCUMENT ${index + 1}`,
        `DESCRIPTION: ${document.description || "-"}`,
        `MANNER: ${document.manner || "-"}`,
        `BOOKLETS: ${document.booklets || "-"}`,
        `SETS: ${document.setsPerBooklet || "-"}`,
        `COPIES: ${document.copiesPerSet || "-"}`,
        `SERIAL: ${document.serialNumbers || "-"}`,
      ].join("\n");
    })
    .join("\n\n");
}

export function buildNonBIRDocumentSection(
  documents: DocumentItem[],
) {
  if (documents.length === 0) {
    return "-";
  }

  return documents
    .map((document, index) => {
      return [
        `DOCUMENT ${index + 1}`,
        `DESCRIPTION: ${document.description || "-"}`,
        `BOOKLETS: ${document.booklets || "-"}`,
        `SERIAL: ${document.serialNumbers || "-"}`,
      ].join("\n");
    })
    .join("\n\n");
}

export function buildReceivedATPCardName(
  order: ReceivedATPOrder,
) {
  const staffName =
    order.salesAssigned === "OTHERS"
      ? clean(order.salesAssignedOther)
      : clean(order.salesAssigned);

  const tradeName =
    clean(
      order.businessName ||
        order.taxpayerName,
    );

  const branchNo =
    clean(order.branchNo) ||
    getBranchFromTin(order.tin);

  const rdoCode =
    clean(order.rdoCode).toUpperCase();

  const taxType =
    clean(order.taxType);

  const submittedDate =
    formatDateForTitle(
      order.submittedAt ||
        order.dateOfAtp,
    );

  const atpStatus =
    clean(
      order.atpStatus ||
        order.atpReceived ||
        "ATP",
    );

  const orderType =
    buildOrderType(
      order.documents,
    );

  const branchText =
    branchNo
      ? ` (BRANCH ${branchNo})`
      : "";

  const rdoText =
    rdoCode
      ? ` (${rdoCode})`
      : "";

  return `(${staffName || "NO STAFF"}) ${
    tradeName || "NO TRADE NAME"
  }${branchText}${rdoText}
${orderType || "ORDER TYPE"}
${taxType || "TAX TYPE"} ${submittedDate} (${atpStatus.toUpperCase()})`;
}

export function buildReceivedATPCardDescription(
  order: ReceivedATPOrder,
) {
  const tradeName =
    clean(
      order.businessName ||
        order.taxpayerName,
    );

  const rdoCode =
    clean(
      order.rdoCode,
    ).toUpperCase();

  const atpStatus =
    clean(
      order.atpStatus ||
        order.atpReceived ||
        "ATP",
    );

  return [
    `TRACKING: ${clean(order.trackingNo) || "-"}`,
    `TIN: ${clean(order.tin) || "-"}`,
    `OCN: ${clean(order.ocn) || "-"}`,
    `TAXPAYER: ${clean(order.taxpayerName) || "-"}`,
    `TRADE NAME: ${tradeName || "-"}`,
    `ADDRESS: ${clean(order.registeredAddress) || "-"}`,
    "",
    "DOCUMENTS INCLUDED:",
    buildReceivedATPDocumentSection(
      order.documents,
    ),
    "",
    `RDO: ${rdoCode || "-"}`,
    `TAX TYPE: ${clean(order.taxType) || "-"}`,
    `ATP STATUS: ${atpStatus || "-"}`,
  ].join("\n");
}

export function buildNonBIRCardName(
  order: NonBIROrder,
) {
  const descriptionSummary =
    order.documents
      .map(
        (document) =>
          document.description,
      )
      .filter(Boolean)
      .join(" / ");

  const bookletSummary =
    order.documents
      .map(
        (document) =>
          document.booklets,
      )
      .filter(Boolean)
      .join(" / ");

  return `(${clean(order.salesAssigned) || "-"}) ${clean(order.businessName)}
${descriptionSummary}-${bookletSummary}
${formatDateForTitle(order.dateReceived)}
(NON-BIR)`;
}

export function buildNonBIRCardDescription(
  order: NonBIROrder,
) {
  return [
    `TRACKING: ${clean(order.trackingNumber) || "-"}`,
    `BUSINESS: ${clean(order.businessName) || "-"}`,
    `SALES ASSIGNED: ${clean(order.salesAssigned) || "-"}`,
    `ORDER TYPE: NON-BIR`,
    "",
    "DOCUMENTS INCLUDED:",
    buildNonBIRDocumentSection(
      order.documents,
    ),
  ].join("\n");
}