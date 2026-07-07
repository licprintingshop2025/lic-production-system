import { getPHDateTime } from "@/lib/dateTime";
import type { NonBIROrder, ReceivedATPOrder } from "./types";
import { clean, joinDocumentValues } from "./utils";

export function buildReceivedATPRow(order: ReceivedATPOrder, cardId: string) {
  const rdoCode = clean(order.rdoCode).toUpperCase();
  const rdoCodeForSheet = rdoCode;

  const staffName =
    order.salesAssigned === "OTHERS"
      ? clean(order.salesAssignedOther)
      : clean(order.salesAssigned);

  const tradeName = clean(order.businessName || order.taxpayerName);
  const atpStatus = clean(order.atpStatus || order.atpReceived || "ATP");

  return [
    getPHDateTime(),
    order.trackingNo,
    order.dateOfAtp,
    clean(order.ocn),
    clean(order.tin),
    clean(order.taxpayerName),
    tradeName,
    clean(order.registeredAddress),
    rdoCodeForSheet,
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