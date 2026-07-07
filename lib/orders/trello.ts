import type { DocumentItem, NonBIROrder, ReceivedATPOrder } from "./types";
import {
  buildOrderType,
  clean,
  formatDateForTitle,
} from "./utils";

export function buildReceivedATPDocumentSection(documents: DocumentItem[]) {
  if (documents.length === 0) return "-";

  return documents
    .map((document, index) => {
      return `#${index + 1}
Description : ${document.description || "-"}
Manner      : ${document.manner || "-"}
Booklets    : ${document.booklets || "-"}
Sets        : ${document.setsPerBooklet || "-"}
Copies      : ${document.copiesPerSet || "-"}
Serial      : ${document.serialNumbers || "-"}`;
    })
    .join("\n\n");
}

export function buildNonBIRDocumentSection(documents: DocumentItem[]) {
  if (documents.length === 0) return "-";

  return documents
    .map((document, index) => {
      return `#${index + 1}
Description : ${document.description || "-"}
Booklets    : ${document.booklets || "-"}
Serial      : ${document.serialNumbers || "-"}`;
    })
    .join("\n\n");
}

export function buildReceivedATPCardName(order: ReceivedATPOrder) {
  const staffName =
    order.salesAssigned === "OTHERS"
      ? clean(order.salesAssignedOther)
      : clean(order.salesAssigned);

  const tradeName = clean(order.businessName || order.taxpayerName);
  const branchNo = clean(order.branchNo);
  const rdoCode = clean(order.rdoCode).toUpperCase();
  const taxType = clean(order.taxType);
  const dateOfAtp = formatDateForTitle(order.dateOfAtp);
  const atpStatus = clean(order.atpStatus || order.atpReceived || "ATP");
  const orderType = buildOrderType(order.documents);

  const branchText = branchNo ? ` (BRANCH ${branchNo})` : "";
  const rdoText = rdoCode ? ` (${rdoCode})` : "";

  return `(${staffName || "NO STAFF"}) ${tradeName || "NO TRADE NAME"}${branchText}${rdoText}
${orderType || "ORDER TYPE"}
${taxType || "TAX TYPE"} ${dateOfAtp} (${atpStatus.toUpperCase()})`;
}

export function buildReceivedATPCardDescription(order: ReceivedATPOrder) {
  const tradeName = clean(order.businessName || order.taxpayerName);
  const rdoCode = clean(order.rdoCode).toUpperCase();
  const atpStatus = clean(order.atpStatus || order.atpReceived || "ATP");

  return `
TRACKING:
${order.trackingNo}

TIN:
${clean(order.tin) || "-"}

OCN:
${clean(order.ocn) || "-"}

TAXPAYER:
${clean(order.taxpayerName) || "-"}

TRADE NAME:
${tradeName || "-"}

ADDRESS:
${clean(order.registeredAddress) || "-"}

DOCUMENTS INCLUDED:
${buildReceivedATPDocumentSection(order.documents)}

RDO:
${rdoCode || "-"}

TAX TYPE:
${clean(order.taxType) || "-"}

ATP STATUS:
${atpStatus || "-"}
`.trim();
}

export function buildNonBIRCardName(order: NonBIROrder) {
  const descriptionSummary = order.documents
    .map((doc) => doc.description)
    .filter(Boolean)
    .join(" / ");

  const bookletSummary = order.documents
    .map((doc) => doc.booklets)
    .filter(Boolean)
    .join(" / ");

  return `(${clean(order.salesAssigned) || "-"}) ${clean(order.businessName)}
${descriptionSummary}-${bookletSummary}
${formatDateForTitle(order.dateReceived)}
(NON-BIR)`;
}

export function buildNonBIRCardDescription(order: NonBIROrder) {
  return `
Tracking Number
${order.trackingNumber}

Business
${clean(order.businessName)}

Documents Included
${buildNonBIRDocumentSection(order.documents)}

Sales Assigned
${clean(order.salesAssigned) || "-"}

Order Type
NON-BIR
`.trim();
}