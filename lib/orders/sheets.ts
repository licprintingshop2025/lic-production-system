import { formatPHDateTime, getPHDateTime } from "@/lib/dateTime";
import type { DocumentItem, NonBIROrder, ReceivedATPOrder } from "./types";
import { COPIES_PER_SET_OPTIONS, RECEIPT_TYPES } from "./constants";
import { clean, getBranchFromTin, joinDocumentValues } from "./utils";

const STANDARD_SALES_ASSIGNED = new Set([
  "JARYLL",
  "ANGELICA",
  "RUBY",
  "LANIE",
  "MARK",
  "SHANE",
  "ALGEAN",
  "AI",
  "DENNIS",
  "LIC NEW CUSTOMER",
  "LIC REPEAT CUSTOMER",
]);

function splitJoinedValues(value: unknown) {
  const raw = clean(value);

  if (!raw || raw === "-") return [];

  return raw
    .split(/\s*\/\s*/)
    .map((item) => clean(item))
    .filter(Boolean);
}

function buildDocumentsFromColumns({
  descriptions,
  manners = [],
  booklets = [],
  setsPerBooklet = [],
  copiesPerSet = [],
  serialNumbers = [],
}: {
  descriptions: string[];
  manners?: string[];
  booklets?: string[];
  setsPerBooklet?: string[];
  copiesPerSet?: string[];
  serialNumbers?: string[];
}): DocumentItem[] {
  const count = Math.max(
    descriptions.length,
    manners.length,
    booklets.length,
    setsPerBooklet.length,
    copiesPerSet.length,
    serialNumbers.length,
  );

  return Array.from({ length: count }, (_, index): DocumentItem => {
    const rawDescription = descriptions[index] || "";
    const rawCopiesPerSet = copiesPerSet[index] || "";
    const knownDescription = RECEIPT_TYPES.includes(rawDescription);
    const knownCopies = COPIES_PER_SET_OPTIONS.includes(rawCopiesPerSet);

    return {
      id: `sheet-${index + 1}`,
      description: rawDescription
        ? knownDescription
          ? rawDescription
          : "OTHER"
        : "",
      descriptionOther: rawDescription && !knownDescription ? rawDescription : "",
      manner: manners[index] || "",
      booklets: booklets[index] || "",
      setsPerBooklet: setsPerBooklet[index] || "",
      copiesPerSet: rawCopiesPerSet
        ? knownCopies
          ? rawCopiesPerSet
          : "OTHER"
        : "",
      copiesPerSetOther: rawCopiesPerSet && !knownCopies ? rawCopiesPerSet : "",
      serialNumbers: serialNumbers[index] || "",
    };
  }).filter((document) =>
    Boolean(
      document.description ||
        document.manner ||
        document.booklets ||
        document.setsPerBooklet ||
        document.copiesPerSet ||
        document.serialNumbers,
    ),
  );
}

export function buildReceivedATPRow(order: ReceivedATPOrder, cardId: string) {
  const rdoCode = clean(order.rdoCode).toUpperCase();
  const staffName =
    order.salesAssigned === "OTHERS"
      ? clean(order.salesAssignedOther)
      : clean(order.salesAssigned);
  const tradeName = clean(order.businessName || order.taxpayerName);
  const atpStatus = clean(order.atpStatus || order.atpReceived || "ATP");

  return [
    order.submittedAt ? formatPHDateTime(order.submittedAt) : getPHDateTime(),
    order.trackingNo,
    order.dateOfAtp,
    clean(order.ocn),
    clean(order.tin),
    clean(order.taxpayerName),
    tradeName,
    clean(order.registeredAddress),
    rdoCode,
    joinDocumentValues(order.documents, "manner"),
    joinDocumentValues(order.documents, "description"),
    clean(order.taxType),
    joinDocumentValues(order.documents, "booklets"),
    joinDocumentValues(order.documents, "setsPerBooklet"),
    joinDocumentValues(order.documents, "copiesPerSet"),
    joinDocumentValues(order.documents, "serialNumbers"),
    atpStatus,
    staffName,
    cardId,
  ];
}

export function parseReceivedATPRow(row: unknown[]): ReceivedATPOrder {
  const tin = clean(row[4]);
  const rawStaff = clean(row[17]);
  const normalizedStaff = rawStaff.toUpperCase();
  const isStandardStaff = STANDARD_SALES_ASSIGNED.has(normalizedStaff);

  return {
    trackingNo: clean(row[1]),
    submittedAt: clean(row[0]),
    dateOfAtp: clean(row[2]),
    ocn: clean(row[3]),
    tin,
    taxpayerName: clean(row[5]),
    businessName: clean(row[6]),
    registeredAddress: clean(row[7]),
    rdoCode: clean(row[8]).toUpperCase(),
    taxType: clean(row[11]),
    documents: buildDocumentsFromColumns({
      manners: splitJoinedValues(row[9]),
      descriptions: splitJoinedValues(row[10]),
      booklets: splitJoinedValues(row[12]),
      setsPerBooklet: splitJoinedValues(row[13]),
      copiesPerSet: splitJoinedValues(row[14]),
      serialNumbers: splitJoinedValues(row[15]),
    }),
    atpReceived: clean(row[16]),
    atpStatus: clean(row[16]),
    salesAssigned: rawStaff
      ? isStandardStaff
        ? normalizedStaff
        : "OTHERS"
      : "",
    salesAssignedOther: rawStaff && !isStandardStaff ? rawStaff : "",
    branchNo: getBranchFromTin(tin),
  };
}

export function buildNonBIRRow(order: NonBIROrder, cardId: string) {
  return [
    order.trackingNumber,
    order.dateReceived,
    clean(order.businessName),
    joinDocumentValues(order.documents, "description"),
    joinDocumentValues(order.documents, "booklets"),
    joinDocumentValues(order.documents, "serialNumbers"),
    clean(order.salesAssigned) || "-",
    cardId,
  ];
}

export function parseNonBIROrderRow(row: unknown[]): NonBIROrder {
  return {
    trackingNumber: clean(row[0]),
    dateReceived: clean(row[1]),
    businessName: clean(row[2]),
    salesAssigned: clean(row[6]),
    documents: buildDocumentsFromColumns({
      descriptions: splitJoinedValues(row[3]),
      booklets: splitJoinedValues(row[4]),
      serialNumbers: splitJoinedValues(row[5]),
    }),
  };
}
