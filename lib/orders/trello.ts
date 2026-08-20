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
      return `#${index + 1}
Description : ${clean(document.description) || "-"}
Manner      : ${clean(document.manner) || "-"}
Booklets    : ${clean(document.booklets) || "-"}
Sets        : ${clean(document.setsPerBooklet) || "-"}
Copies      : ${clean(document.copiesPerSet) || "-"}
Serial      : ${clean(document.serialNumbers) || "-"}`;
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
      return `#${index + 1}
Description : ${clean(document.description) || "-"}
Booklets    : ${clean(document.booklets) || "-"}
Serial      : ${clean(document.serialNumbers) || "-"}`;
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

  const tradeName = clean(
    order.businessName ||
      order.taxpayerName,
  );

  const branchNo =
    clean(order.branchNo) ||
    getBranchFromTin(order.tin);

  const rdoCode = clean(
    order.rdoCode,
  ).toUpperCase();

  const taxType = clean(
    order.taxType,
  ).toUpperCase();

  const submittedDate =
    formatDateForTitle(
      order.submittedAt ||
        order.dateOfAtp,
    );

  const atpStatus = clean(
    order.atpStatus ||
      order.atpReceived ||
      "ATP",
  ).toUpperCase();

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

  return `(${staffName || "NO STAFF"}) ${tradeName || "NO TRADE NAME"}${branchText}${rdoText}
${orderType || "ORDER TYPE"}
${taxType || "TAX TYPE"} ${submittedDate} (${atpStatus})`;
}

export function buildReceivedATPCardDescription(
  order: ReceivedATPOrder,
) {
  const tradeName = clean(
    order.businessName ||
      order.taxpayerName,
  );

  const rdoCode = clean(
    order.rdoCode,
  ).toUpperCase();

  const atpStatus = clean(
    order.atpStatus ||
      order.atpReceived ||
      "ATP",
  );

  return `
TRACKING:
${clean(order.trackingNo) || "-"}

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
${buildReceivedATPDocumentSection(
  order.documents,
)}

RDO:
${rdoCode || "-"}

TAX TYPE:
${clean(order.taxType) || "-"}

ATP STATUS:
${atpStatus || "-"}
`.trim();
}

export function buildNonBIRCardName(
  order: NonBIROrder,
) {
  const staffName =
    clean(order.salesAssigned) ||
    "-";

  const businessName =
    clean(order.businessName) ||
    "NO BUSINESS NAME";

  const orderType =
    order.documents
      .map((document) => {
        const description =
          clean(
            document.description,
          ).toUpperCase();

        const booklets =
          clean(
            document.booklets,
          ) || "0";

        return `${
          description ||
          "DOCUMENT"
        }-${booklets}`;
      })
      .filter(Boolean)
      .join(" / ");

  const dateReceived =
    formatDateForTitle(
      order.dateReceived,
    );

  return `(${staffName}) ${businessName}
${orderType || "ORDER TYPE"}
${dateReceived}
(NON-BIR)`;
}

export function buildNonBIRCardDescription(
  order: NonBIROrder,
) {
  return `
TRACKING: ${
    clean(
      order.trackingNumber,
    ) || "-"
  }

BUSINESS: ${
    clean(
      order.businessName,
    ) || "-"
  }

DOCUMENTS INCLUDED:
${buildNonBIRDocumentSection(
  order.documents,
)}

SALES ASSIGNED: ${
    clean(
      order.salesAssigned,
    ) || "-"
  }

ORDER TYPE: NON-BIR
`.trim();
}