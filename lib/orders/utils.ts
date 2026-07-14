import type { DocumentItem } from "./types";

export function clean(value: unknown) {
  return value?.toString().trim() || "";
}

export function formatDateForTitle(dateString: string) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return clean(dateString).toUpperCase();
  }

  return date
    .toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();
}

export function getDocumentDescription(document: DocumentItem) {
  if (document.description === "OTHER") {
    return clean(document.descriptionOther);
  }

  return clean(document.description);
}

export function getDocumentCopies(document: DocumentItem) {
  if (document.copiesPerSet === "OTHER") {
    return clean(document.copiesPerSetOther);
  }

  return clean(document.copiesPerSet);
}

export function normalizeDocuments(documents: DocumentItem[] | undefined) {
  if (!Array.isArray(documents)) return [];

  return documents
    .map((document) => ({
      ...document,
      description: getDocumentDescription(document),
      manner: clean(document.manner),
      booklets: clean(document.booklets),
      setsPerBooklet: clean(document.setsPerBooklet),
      copiesPerSet: getDocumentCopies(document),
      serialNumbers: clean(document.serialNumbers),
    }))
    .filter((document) => document.description);
}

export function joinDocumentValues(
  documents: DocumentItem[],
  field: keyof DocumentItem,
) {
  return documents
    .map((document) => clean(document[field]))
    .filter(Boolean)
    .join(" / ");
}

export function getReceiptCode(receiptType: string) {
  const value = clean(receiptType).toUpperCase();

  if (value.includes("SALES")) return "SALES";
  if (value.includes("SERVICE")) return "SI";
  if (value.includes("BILLING")) return "BI";
  if (value.includes("COLLECTION")) return "CR";
  if (value.includes("OFFICIAL")) return "OR";
  if (value.includes("DELIVERY")) return "DR";
  if (value.includes("ACKNOWLEDGEMENT")) return "AR";
  if (value.includes("ORDER SLIP")) return "OS";
  if (value.includes("DISBURSEMENT")) return "DV";
  if (value.includes("NON-VAT")) return "NVI";
  if (value.includes("VAT")) return "VI";
  if (value.includes("INVOICE")) return "INV";

  return value || "DOC";
}

export function buildOrderType(documents: DocumentItem[]) {
  return documents
    .map((document) => {
      return `${getReceiptCode(document.description)}-${document.booklets || "0"}`;
    })
    .join(" ");
}
