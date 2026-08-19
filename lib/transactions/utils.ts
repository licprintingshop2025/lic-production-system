import { randomBytes } from "crypto";
import type {
  TransactionDocument,
  TransactionInput,
  TransactionStatus,
} from "@/lib/transactions/types";

const VALID_STATUSES: TransactionStatus[] = [
  "Pending",
  "In Progress",
  "On Hold",
  "Completed",
  "Cancelled",
];

const LEGACY_STATUS_MAP: Record<
  string,
  TransactionStatus
> = {
  "waiting for client": "On Hold",
};

export function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

export function requireText(
  value: unknown,
  fieldName: string,
): string {
  const cleanedValue = cleanText(value);

  if (!cleanedValue) {
    throw new Error(
      `${fieldName} is required.`,
    );
  }

  return cleanedValue;
}

export function normalizeStringArray(
  value: unknown,
): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => cleanText(item))
          .filter(Boolean),
      ),
    );
  }

  const cleanedValue = cleanText(value);

  if (!cleanedValue) {
    return [];
  }

  return Array.from(
    new Set(
      cleanedValue
        .split(
          /\s*\|\s*|\r?\n|,\s*/g,
        )
        .map((item) =>
          item.trim(),
        )
        .filter(Boolean),
    ),
  );
}

export function serializeStringArray(
  values: string[],
): string {
  return normalizeStringArray(
    values,
  ).join(" | ");
}

export function normalizeTransactionStatus(
  value: unknown,
): TransactionStatus {
  const cleanedValue =
    cleanText(value);

  if (!cleanedValue) {
    return "Pending";
  }

  const normalizedValue =
    cleanedValue.toLowerCase();

  const legacyStatus =
    LEGACY_STATUS_MAP[
      normalizedValue
    ];

  if (legacyStatus) {
    return legacyStatus;
  }

  const matchingStatus =
    VALID_STATUSES.find(
      (status) =>
        status.toLowerCase() ===
        normalizedValue,
    );

  return matchingStatus || "Pending";
}

export function generateTransactionNumber(
  date = new Date(),
): string {
  const year = String(
    date.getFullYear(),
  ).slice(-2);

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  const randomPart =
    randomBytes(4)
      .toString("hex")
      .toUpperCase();

  return `TRX-${year}${month}${day}-${randomPart}`;
}

export function normalizeTransactionDocuments(
  value: unknown,
): TransactionDocument[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (
        !item ||
        typeof item !==
          "object" ||
        Array.isArray(item)
      ) {
        return null;
      }

      const rawDocument =
        item as Record<
          string,
          unknown
        >;

      const documentType =
        cleanText(
          rawDocument.documentType,
        );

      const taxType =
        cleanText(
          rawDocument.taxType,
        );

      const quantity =
        Number(
          rawDocument.quantity,
        );

      if (
        !documentType ||
        !taxType ||
        !Number.isFinite(
          quantity,
        ) ||
        !Number.isInteger(
          quantity,
        ) ||
        quantity < 1
      ) {
        return null;
      }

      return {
        documentType,
        taxType,
        quantity,
      };
    })
    .filter(
      (
        document,
      ): document is TransactionDocument =>
        document !== null,
    );
}

export function validateTransactionDocuments(
  value: unknown,
): TransactionDocument[] {
  if (
    !Array.isArray(value) ||
    value.length === 0
  ) {
    throw new Error(
      "Please add at least one invoice or receipt.",
    );
  }

  const normalizedDocuments =
    normalizeTransactionDocuments(
      value,
    );

  if (
    normalizedDocuments.length !==
    value.length
  ) {
    throw new Error(
      "Each invoice or receipt must have a document type, tax type, and whole-number quantity of at least 1.",
    );
  }

  return normalizedDocuments;
}

export function normalizeTransactionInput(
  body: Record<
    string,
    unknown
  >,
): TransactionInput {
  const formUsed =
    normalizeStringArray(
      body.formUsed,
    );

  if (
    formUsed.length === 0
  ) {
    throw new Error(
      "Please select at least one Form Used option.",
    );
  }

  const documents =
    validateTransactionDocuments(
      body.documents,
    );

  return {
    dateReceived:
      requireText(
        body.dateReceived,
        "Date Received of Application",
      ),

    applicationMethod:
      requireText(
        body.applicationMethod ??
          body.processingMethod ??
          body.manualOrOrus,
        "Manual or ORUS",
      ),

    formUsed,

    form1905:
      normalizeStringArray(
        body.form1905,
      ),

    computePenalty:
      normalizeStringArray(
        body.computePenalty ??
          body.penalty0605,
      ),

    taxpayerName:
      requireText(
        body.taxpayerName,
        "Taxpayer Name",
      ),

    businessName:
      requireText(
        body.businessName ??
          body.businessTradename,
        "Business / Trade Name",
      ),

    tin:
      requireText(
        body.tin,
        "TIN",
      ),

    rdoCode:
      requireText(
        body.rdoCode ??
          body.rdo,
        "RDO Code",
      ).toUpperCase(),

    documents,

    mobileNumber:
      cleanText(
        body.mobileNumber ??
          body.mobile,
      ),

    email:
      cleanText(
        body.email,
      ),

    assistedBy:
      requireText(
        body.assistedBy,
        "Assisted By",
      ),

    books:
      normalizeStringArray(
        body.books,
      ),

    status:
      normalizeTransactionStatus(
        body.status,
      ),
  };
}

export function getTotalDocumentQuantity(
  documents: TransactionDocument[],
): number {
  return documents.reduce(
    (
      total,
      document,
    ) =>
      total +
      document.quantity,
    0,
  );
}

export function getDocumentDescriptions(
  documents: TransactionDocument[],
): string[] {
  return documents.map(
    (document) =>
      `${document.documentType} [${document.taxType}] x ${document.quantity}`,
  );
}

export function getUniqueTaxTypes(
  documents: TransactionDocument[],
): string[] {
  return Array.from(
    new Set(
      documents
        .map(
          (document) =>
            document.taxType,
        )
        .filter(Boolean),
    ),
  );
}

export function parseDocumentDescription(
  value: string,
): TransactionDocument | null {
  const cleanedValue =
    cleanText(value);

  if (!cleanedValue) {
    return null;
  }

  const match =
    cleanedValue.match(
      /^(.*?)\s*\[(.*?)\]\s*x\s*(\d+)$/i,
    );

  if (!match) {
    return null;
  }

  const documentType =
    cleanText(
      match[1],
    );

  const taxType =
    cleanText(
      match[2],
    );

  const quantity =
    Number(
      match[3],
    );

  if (
    !documentType ||
    !taxType ||
    !Number.isFinite(
      quantity,
    ) ||
    !Number.isInteger(
      quantity,
    ) ||
    quantity < 1
  ) {
    return null;
  }

  return {
    documentType,
    taxType,
    quantity,
  };
}

export function parseDocumentsFromSheet(
  value: unknown,
): TransactionDocument[] {
  return normalizeStringArray(
    value,
  )
    .map(
      parseDocumentDescription,
    )
    .filter(
      (
        document,
      ): document is TransactionDocument =>
        document !== null,
    );
}