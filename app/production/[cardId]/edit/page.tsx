"use client";

import { useParams, useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ChangeEventHandler,
  type FormEvent,
} from "react";
import AppShell from "../../../components/AppShell";
import PageHeader from "../../../components/PageHeader";

type DeliveryStrategy = "COMPLETE" | "PARTIAL";

type OrderDocument = {
  id: string;
  documentType: string;
  quantity: string;
  serialRange: string;

  paperType: string;

  ply: string;
  customPly: string;

  size: string;
  customSize: string;

  specialInstructions: string;
};

type OrderFormData = {
  orderPriority: string;

  deliveryStrategy: DeliveryStrategy;
  initialReleaseQty: string;
  initialDueWorkingDays: string;
  finalDueWorkingDays: string;
};

type ProductionDetailsResponse = {
  cardId?: string;
  cardName?: string;
  sourceType?: "BIR" | "NON_BIR";

  orderPriority?: string;
  deliveryStrategy?: DeliveryStrategy;
  initialReleaseQty?: string | number;
  initialDueWorkingDays?: string | number;
  finalDueWorkingDays?: string | number;

  documents?: Array<{
    id?: string;
    documentId?: string;

    documentType?: string;
    type?: string;
    name?: string;

    quantity?: string | number;

    serialRange?: string;
    serial?: string;

    paperType?: string;
    ply?: string;
    size?: string;
    specialInstructions?: string;
  }>;

  error?: string;
};

type SelectOption = {
  value: string;
  label: string;
};

const PAPER_TYPE_OPTIONS = ["Ordinary", "Carbonized"];

const PLY_OPTIONS = [
  "1-Ply",
  "2-Ply",
  "3-Ply",
  "4-Ply",
  "Other",
];

const SIZE_OPTIONS = [
  "1/3",
  "1/4",
  "1/2",
  "Whole",
  "Other",
];

function cleanValue(input: unknown) {
  if (input === null || input === undefined) {
    return "";
  }

  const cleaned = String(input).trim();

  if (!cleaned || cleaned === "-") {
    return "";
  }

  return cleaned;
}

function createFallbackDocumentId(index: number) {
  return `document-${index + 1}`;
}

function isStandardOption(
  value: string,
  options: string[],
) {
  return options.includes(value);
}

function normalizeDocument(
  document: NonNullable<
    ProductionDetailsResponse["documents"]
  >[number],
  index: number,
): OrderDocument {
  const rawPly = cleanValue(document.ply);
  const rawSize = cleanValue(document.size);

  const standardPly = isStandardOption(
    rawPly,
    PLY_OPTIONS,
  );

  const standardSize = isStandardOption(
    rawSize,
    SIZE_OPTIONS,
  );

  return {
    id:
      cleanValue(document.id) ||
      cleanValue(document.documentId) ||
      createFallbackDocumentId(index),

    documentType:
      cleanValue(document.documentType) ||
      cleanValue(document.type) ||
      cleanValue(document.name) ||
      `Document ${index + 1}`,

    quantity: cleanValue(document.quantity),

    serialRange:
      cleanValue(document.serialRange) ||
      cleanValue(document.serial),

    paperType: cleanValue(document.paperType),

    ply: rawPly
      ? standardPly
        ? rawPly
        : "Other"
      : "",

    customPly:
      rawPly && !standardPly ? rawPly : "",

    size: rawSize
      ? standardSize
        ? rawSize
        : "Other"
      : "",

    customSize:
      rawSize && !standardSize ? rawSize : "",

    specialInstructions: cleanValue(
      document.specialInstructions,
    ),
  };
}

export default function CompleteProductionDetailsPage() {
  const router = useRouter();
  const params = useParams();

  const cardId =
    typeof params.cardId === "string"
      ? params.cardId
      : Array.isArray(params.cardId)
        ? params.cardId[0]
        : "";

  const [formData, setFormData] =
    useState<OrderFormData>({
      orderPriority: "",

      deliveryStrategy: "COMPLETE",
      initialReleaseQty: "10",
      initialDueWorkingDays: "10",
      finalDueWorkingDays: "30",
    });

  const [documents, setDocuments] = useState<
    OrderDocument[]
  >([]);

  const [cardName, setCardName] = useState("");
  const [sourceType, setSourceType] = useState<
    "BIR" | "NON_BIR" | ""
  >("");

  const [initialLoading, setInitialLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!cardId) {
      setLoadError("Missing Trello card ID.");
      setInitialLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadProductionDetails() {
      try {
        setInitialLoading(true);
        setLoadError("");

        const response = await fetch(
          `/api/production/${cardId}`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const result =
          (await response.json()) as ProductionDetailsResponse;

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Failed to load production details.",
          );
        }

        const loadedDocuments = Array.isArray(
          result.documents,
        )
          ? result.documents.map(normalizeDocument)
          : [];

        setDocuments(loadedDocuments);
        setCardName(cleanValue(result.cardName));

        if (
          result.sourceType === "BIR" ||
          result.sourceType === "NON_BIR"
        ) {
          setSourceType(result.sourceType);
        }

        setFormData((previous) => ({
          ...previous,

          orderPriority:
            cleanValue(result.orderPriority) ||
            previous.orderPriority,

          deliveryStrategy:
            result.deliveryStrategy === "PARTIAL"
              ? "PARTIAL"
              : "COMPLETE",

          initialReleaseQty:
            cleanValue(result.initialReleaseQty) ||
            previous.initialReleaseQty,

          initialDueWorkingDays:
            cleanValue(
              result.initialDueWorkingDays,
            ) ||
            previous.initialDueWorkingDays,

          finalDueWorkingDays:
            cleanValue(
              result.finalDueWorkingDays,
            ) ||
            previous.finalDueWorkingDays,
        }));
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        console.error(
          "Load production details error:",
          error,
        );

        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load production details.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setInitialLoading(false);
        }
      }
    }

    void loadProductionDetails();

    return () => {
      controller.abort();
    };
  }, [cardId]);

  const completedDocumentCount = useMemo(() => {
    return documents.filter((document) => {
      const finalPly =
        document.ply === "Other"
          ? document.customPly.trim()
          : document.ply.trim();

      const finalSize =
        document.size === "Other"
          ? document.customSize.trim()
          : document.size.trim();

      return Boolean(
        document.paperType.trim() &&
          finalPly &&
          finalSize,
      );
    }).length;
  }, [documents]);

  const allDocumentsComplete =
    documents.length > 0 &&
    completedDocumentCount === documents.length;

  function handleOrderChange(
    event: ChangeEvent<
      HTMLInputElement |
        HTMLSelectElement |
        HTMLTextAreaElement
    >,
  ) {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function updateDocument(
    documentId: string,
    field: keyof OrderDocument,
    value: string,
  ) {
    setDocuments((previous) =>
      previous.map((document) => {
        if (document.id !== documentId) {
          return document;
        }

        const updatedDocument: OrderDocument = {
          ...document,
          [field]: value,
        };

        if (
          field === "ply" &&
          value !== "Other"
        ) {
          updatedDocument.customPly = "";
        }

        if (
          field === "size" &&
          value !== "Other"
        ) {
          updatedDocument.customSize = "";
        }

        return updatedDocument;
      }),
    );
  }

  function copyPreviousDocumentSpecifications(
    documentId: string,
  ) {
    const currentIndex = documents.findIndex(
      (document) => document.id === documentId,
    );

    if (currentIndex <= 0) {
      return;
    }

    const previousDocument =
      documents[currentIndex - 1];

    setDocuments((currentDocuments) =>
      currentDocuments.map((document) => {
        if (document.id !== documentId) {
          return document;
        }

        return {
          ...document,
          paperType:
            previousDocument.paperType,
          ply: previousDocument.ply,
          customPly:
            previousDocument.customPly,
          size: previousDocument.size,
          customSize:
            previousDocument.customSize,
          specialInstructions:
            previousDocument.specialInstructions,
        };
      }),
    );
  }

  function applyFirstDocumentToAll() {
    const firstDocument = documents[0];

    if (!firstDocument) {
      return;
    }

    setDocuments((currentDocuments) =>
      currentDocuments.map(
        (document, index) => {
          if (index === 0) {
            return document;
          }

          return {
            ...document,
            paperType:
              firstDocument.paperType,
            ply: firstDocument.ply,
            customPly:
              firstDocument.customPly,
            size: firstDocument.size,
            customSize:
              firstDocument.customSize,
            specialInstructions:
              firstDocument.specialInstructions,
          };
        },
      ),
    );
  }

  function validateForm() {
    if (!formData.orderPriority.trim()) {
      return "Select an order priority.";
    }

    if (documents.length === 0) {
      return (
        "No documents were found for this order. " +
        "Add the order documents before completing production details."
      );
    }

    for (
      let index = 0;
      index < documents.length;
      index += 1
    ) {
      const document = documents[index];

      const documentName =
        document.documentType ||
        `Document ${index + 1}`;

      if (!document.paperType.trim()) {
        return `Select the paper type for ${documentName}.`;
      }

      if (!document.ply.trim()) {
        return `Select the ply for ${documentName}.`;
      }

      if (
        document.ply === "Other" &&
        !document.customPly.trim()
      ) {
        return `Enter the custom ply for ${documentName}.`;
      }

      if (!document.size.trim()) {
        return `Select the size for ${documentName}.`;
      }

      if (
        document.size === "Other" &&
        !document.customSize.trim()
      ) {
        return `Enter the custom size for ${documentName}.`;
      }
    }

    if (
      formData.deliveryStrategy === "PARTIAL"
    ) {
      const initialQuantity = Number(
        formData.initialReleaseQty,
      );

      const initialDays = Number(
        formData.initialDueWorkingDays,
      );

      const finalDays = Number(
        formData.finalDueWorkingDays,
      );

      if (
        !Number.isFinite(initialQuantity) ||
        initialQuantity < 1
      ) {
        return (
          "Initial release quantity must be " +
          "at least 1."
        );
      }

      if (
        !Number.isFinite(initialDays) ||
        initialDays < 1
      ) {
        return (
          "Initial due working days must be " +
          "at least 1."
        );
      }

      if (
        !Number.isFinite(finalDays) ||
        finalDays < 1
      ) {
        return (
          "Final due working days must be " +
          "at least 1."
        );
      }

      if (finalDays < initialDays) {
        return (
          "Final due working days cannot be " +
          "earlier than the initial due working days."
        );
      }
    }

    return "";
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      alert(validationError);
      return;
    }

    setSubmitting(true);

    try {
      const normalizedDocuments = documents.map(
        (document) => ({
          id: document.id,
          documentType:
            document.documentType,
          quantity: document.quantity,
          serialRange:
            document.serialRange,

          paperType:
            document.paperType.trim(),

          ply:
            document.ply === "Other"
              ? document.customPly.trim()
              : document.ply.trim(),

          size:
            document.size === "Other"
              ? document.customSize.trim()
              : document.size.trim(),

          specialInstructions:
            document.specialInstructions.trim(),
        }),
      );

      const payload = {
        orderPriority:
          formData.orderPriority.trim(),

        deliveryStrategy:
          formData.deliveryStrategy,

        initialReleaseQty:
          formData.deliveryStrategy === "PARTIAL"
            ? formData.initialReleaseQty
            : "",

        initialDueWorkingDays:
          formData.deliveryStrategy === "PARTIAL"
            ? formData.initialDueWorkingDays
            : "",

        finalDueWorkingDays:
          formData.deliveryStrategy === "PARTIAL"
            ? formData.finalDueWorkingDays
            : "",

        documents: normalizedDocuments,
      };

      const response = await fetch(
        `/api/production/${cardId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const result = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        alert(
          result.error ||
            "Failed to save production details.",
        );

        console.error(
          "Save production details response:",
          result,
        );

        return;
      }

      alert(
        "Production details saved and card moved to Station 4.",
      );

      router.push(`/production/${cardId}`);
      router.refresh();
    } catch (error) {
      alert(
        "Unexpected error. Check the browser console and terminal.",
      );

      console.error(
        "Save production details error:",
        error,
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (initialLoading) {
    return (
      <AppShell
        activePage="production"
        contentWidth="standard"
      >
        <PageHeader
          title="Complete Production Details"
          description="Loading the order documents and current production details."
        />

        <div className="mt-8 rounded-2xl border border-[#e3d8c7] bg-white p-10 text-center shadow-[0_2px_10px_rgba(70,45,20,0.08)]">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#eadfcf] border-t-[#c89132]" />

          <p className="mt-4 text-sm font-semibold text-[#6f6254]">
            Loading production details...
          </p>
        </div>
      </AppShell>
    );
  }

  if (loadError) {
    return (
      <AppShell
        activePage="production"
        contentWidth="standard"
      >
        <PageHeader
          title="Complete Production Details"
          description="The production details could not be loaded."
        />

        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6">
          <h2 className="font-black text-red-900">
            Unable to load this order
          </h2>

          <p className="mt-2 text-sm text-red-700">
            {loadError}
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                window.location.reload()
              }
              className="rounded-xl bg-red-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-800"
            >
              Try Again
            </button>

            <button
              type="button"
              onClick={() =>
                router.push("/production")
              }
              className="rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-bold text-red-800 transition hover:bg-red-100"
            >
              Return to Production
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      activePage="production"
      contentWidth="standard"
    >
      <PageHeader
        title="Complete Production Details"
        description="Define the order handling and individual specifications for every document before sending this job to Station 4."
      />

      {(cardName || sourceType) && (
        <section className="mt-5 rounded-2xl border border-[#e3d8c7] bg-[#fffaf2] p-5 shadow-[0_2px_10px_rgba(70,45,20,0.05)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#8b5e24]">
                Current Order
              </p>

              <h2 className="mt-1 text-lg font-black text-black">
                {cardName || "Production Order"}
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {sourceType && (
                <span className="rounded-full border border-[#dfd4c4] bg-white px-3 py-2 text-xs font-bold text-[#6f6254]">
                  {sourceType === "NON_BIR"
                    ? "Non-BIR"
                    : "BIR"}
                </span>
              )}

              <span className="rounded-full bg-[#f8ead3] px-3 py-2 text-xs font-black text-[#8b5e24]">
                {documents.length}{" "}
                {documents.length === 1
                  ? "Document"
                  : "Documents"}
              </span>
            </div>
          </div>
        </section>
      )}

      <form
        onSubmit={handleSubmit}
        className="mt-8 space-y-6"
      >
        <section className="rounded-2xl border border-[#e3d8c7] bg-white p-6 shadow-[0_2px_10px_rgba(70,45,20,0.08)]">
          <SectionHeading
            number="01"
            title="Order Handling"
            description="Define the priority and delivery strategy for the entire order."
          />

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Select
              label="Order Priority"
              name="orderPriority"
              value={
                formData.orderPriority
              }
              options={[
                {
                  value: "Normal",
                  label: "Normal",
                },
                {
                  value: "Rush",
                  label: "Rush",
                },
              ]}
              onChange={
                handleOrderChange
              }
              required
            />

            <Select
              label="Delivery Strategy"
              name="deliveryStrategy"
              value={
                formData.deliveryStrategy
              }
              options={[
                {
                  value: "COMPLETE",
                  label: "Complete Order",
                },
                {
                  value: "PARTIAL",
                  label: "Partial Release",
                },
              ]}
              onChange={
                handleOrderChange
              }
              required
            />

            {formData.deliveryStrategy ===
              "PARTIAL" && (
              <>
                <Input
                  label="Initial Release Quantity"
                  name="initialReleaseQty"
                  type="number"
                  value={
                    formData.initialReleaseQty
                  }
                  onChange={
                    handleOrderChange
                  }
                  required
                />

                <Input
                  label="Initial Due (Working Days)"
                  name="initialDueWorkingDays"
                  type="number"
                  value={
                    formData.initialDueWorkingDays
                  }
                  onChange={
                    handleOrderChange
                  }
                  required
                />

                <Input
                  label="Final Due (Working Days)"
                  name="finalDueWorkingDays"
                  type="number"
                  value={
                    formData.finalDueWorkingDays
                  }
                  onChange={
                    handleOrderChange
                  }
                  required
                />
              </>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-[#e3d8c7] bg-white p-6 shadow-[0_2px_10px_rgba(70,45,20,0.08)]">
          <SectionHeading
            number="02"
            title="Document Specifications"
            description="Complete the paper type, ply, size, and instructions for every document included in this order."
          />

          <div className="mb-6 flex flex-col gap-4 rounded-xl border border-[#eadfcf] bg-[#fffaf2] px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-black text-black">
                Specification Progress
              </p>

              <p className="mt-1 text-xs text-[#6f6254]">
                All required document specifications
                must be completed before saving.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {documents.length > 1 && (
                <button
                  type="button"
                  onClick={
                    applyFirstDocumentToAll
                  }
                  disabled={
                    submitting ||
                    !documents[0]
                      ?.paperType
                  }
                  className="rounded-xl border border-[#dfd4c4] bg-white px-4 py-2 text-xs font-bold text-[#3f352a] transition hover:bg-[#fbf7ef] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Apply First Document to All
                </button>
              )}

              <span
                className={`rounded-full px-4 py-2 text-xs font-black ${
                  allDocumentsComplete
                    ? "bg-green-100 text-green-800"
                    : "bg-[#f8ead3] text-[#8b5e24]"
                }`}
              >
                {completedDocumentCount} of{" "}
                {documents.length} complete
              </span>
            </div>
          </div>

          {documents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#d6c4aa] bg-[#fffaf2] p-8 text-center">
              <p className="font-black text-black">
                No documents found
              </p>

              <p className="mt-2 text-sm text-[#6f6254]">
                This order does not contain a
                recognised document list. Check the
                source Google Sheet record before
                completing production details.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {documents.map(
                (document, index) => (
                  <DocumentSpecificationCard
                    key={document.id}
                    document={document}
                    index={index}
                    onChange={
                      updateDocument
                    }
                    onCopyPrevious={
                      copyPreviousDocumentSpecifications
                    }
                  />
                ),
              )}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[#e3d8c7] bg-[#fffaf2] p-5 shadow-[0_2px_10px_rgba(70,45,20,0.06)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-bold text-black">
                Next Step
              </p>

              <p className="mt-1 text-sm text-[#6f6254]">
                Saving will update the Trello
                description, labels, due date and
                checklist, then move the card to
                Station 4.
              </p>
            </div>

            <span className="rounded-xl bg-[#f8ead3] px-4 py-2 text-sm font-black text-[#8b5e24]">
              Station 4
            </span>
          </div>
        </section>

        <div className="mt-8 border-t border-[#e3d8c7] bg-[#fffaf2] px-6 py-5 lg:px-8">
          <div className="mx-auto flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[#7c6a56]">
              Review every document before sending
              this order to production.
            </p>

            <div className="flex shrink-0 justify-end gap-3">
              <button
                type="button"
                onClick={() =>
                  router.push("/production")
                }
                disabled={submitting}
                className="rounded-xl border border-[#dfd4c4] bg-white px-6 py-3 text-sm font-bold text-[#3f352a] transition hover:bg-[#fbf7ef] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  submitting ||
                  documents.length === 0 ||
                  !allDocumentsComplete
                }
                className="rounded-xl bg-[#e1bb5f] px-8 py-3 text-sm font-black text-black transition hover:bg-[#edca73] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting
                  ? "Saving..."
                  : "Save & Send to Station 4"}
              </button>
            </div>
          </div>
        </div>
      </form>

      <footer className="mt-10 text-center text-xs text-[#7c6a56]">
        © 2026 LIC Printing Shop. Production
        Management System.
      </footer>
    </AppShell>
  );
}

function DocumentSpecificationCard({
  document,
  index,
  onChange,
  onCopyPrevious,
}: {
  document: OrderDocument;
  index: number;
  onChange: (
    documentId: string,
    field: keyof OrderDocument,
    value: string,
  ) => void;
  onCopyPrevious: (documentId: string) => void;
}) {
  const finalPly =
    document.ply === "Other"
      ? document.customPly.trim()
      : document.ply.trim();

  const finalSize =
    document.size === "Other"
      ? document.customSize.trim()
      : document.size.trim();

  const isComplete = Boolean(
    document.paperType.trim() &&
      finalPly &&
      finalSize,
  );

  return (
    <article className="overflow-hidden rounded-2xl border border-[#e3d8c7] bg-[#fffdf9]">
      <div className="border-b border-[#eadfcf] bg-[#fff8ec] px-5 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e1bb5f] text-xs font-black text-black">
              {index + 1}
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#8b5e24]">
                Document {index + 1}
              </p>

              <h3 className="mt-1 text-lg font-black text-black">
                {document.documentType}
              </h3>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {document.quantity && (
              <MetadataBadge
                label="Quantity"
                value={document.quantity}
              />
            )}

            {document.serialRange && (
              <MetadataBadge
                label="Serial"
                value={document.serialRange}
              />
            )}

            <span
              className={`rounded-full px-3 py-2 text-xs font-black ${
                isComplete
                  ? "bg-green-100 text-green-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {isComplete
                ? "Complete"
                : "Incomplete"}
            </span>
          </div>
        </div>

        {index > 0 && (
          <button
            type="button"
            onClick={() =>
              onCopyPrevious(document.id)
            }
            className="mt-4 rounded-lg border border-[#dfd4c4] bg-white px-3 py-2 text-xs font-bold text-[#3f352a] transition hover:bg-[#fbf7ef]"
          >
            Copy Previous Document
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">
        <Select
          label="Paper Type"
          name={`paperType-${document.id}`}
          value={document.paperType}
          options={PAPER_TYPE_OPTIONS.map(
            (option) => ({
              value: option,
              label: option,
            }),
          )}
          onChange={(event) =>
            onChange(
              document.id,
              "paperType",
              event.target.value,
            )
          }
          required
        />

        <div>
          <label className="mb-2 block text-sm font-semibold text-[#3f352a]">
            Ply{" "}
            <span className="text-red-500">
              *
            </span>
          </label>

          <select
            name={`ply-${document.id}`}
            value={document.ply}
            onChange={(event) =>
              onChange(
                document.id,
                "ply",
                event.target.value,
              )
            }
            required
            className="w-full rounded-xl border border-[#dfd4c4] bg-white p-3 text-black outline-none transition focus:border-[#c89132] focus:ring-2 focus:ring-[#f4dfb9]"
          >
            <option value="">Select</option>

            {PLY_OPTIONS.map((option) => (
              <option
                key={option}
                value={option}
              >
                {option}
              </option>
            ))}
          </select>

          {document.ply === "Other" && (
            <input
              type="text"
              name={`customPly-${document.id}`}
              value={document.customPly}
              onChange={(event) =>
                onChange(
                  document.id,
                  "customPly",
                  event.target.value,
                )
              }
              required
              placeholder="Enter custom ply"
              className="mt-3 w-full rounded-xl border border-[#dfd4c4] bg-white p-3 text-black outline-none transition placeholder:text-[#a99b8c] focus:border-[#c89132] focus:ring-2 focus:ring-[#f4dfb9]"
            />
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-[#3f352a]">
            Size{" "}
            <span className="text-red-500">
              *
            </span>
          </label>

          <select
            name={`size-${document.id}`}
            value={document.size}
            onChange={(event) =>
              onChange(
                document.id,
                "size",
                event.target.value,
              )
            }
            required
            className="w-full rounded-xl border border-[#dfd4c4] bg-white p-3 text-black outline-none transition focus:border-[#c89132] focus:ring-2 focus:ring-[#f4dfb9]"
          >
            <option value="">Select</option>

            {SIZE_OPTIONS.map((option) => (
              <option
                key={option}
                value={option}
              >
                {option}
              </option>
            ))}
          </select>

          {document.size === "Other" && (
            <input
              type="text"
              name={`customSize-${document.id}`}
              value={document.customSize}
              onChange={(event) =>
                onChange(
                  document.id,
                  "customSize",
                  event.target.value,
                )
              }
              required
              placeholder="Enter custom size"
              className="mt-3 w-full rounded-xl border border-[#dfd4c4] bg-white p-3 text-black outline-none transition placeholder:text-[#a99b8c] focus:border-[#c89132] focus:ring-2 focus:ring-[#f4dfb9]"
            />
          )}
        </div>

        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-semibold text-[#3f352a]">
            Special Instructions
          </label>

          <textarea
            name={`specialInstructions-${document.id}`}
            value={
              document.specialInstructions
            }
            onChange={(event) =>
              onChange(
                document.id,
                "specialInstructions",
                event.target.value,
              )
            }
            rows={3}
            placeholder={`Enter special instructions for ${document.documentType}.`}
            className="w-full rounded-xl border border-[#dfd4c4] bg-white p-3 text-black outline-none transition placeholder:text-[#a99b8c] focus:border-[#c89132] focus:ring-2 focus:ring-[#f4dfb9]"
          />
        </div>
      </div>
    </article>
  );
}

function SectionHeading({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6 flex items-start gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f8ead3] text-sm font-black text-[#8b5e24]">
        {number}
      </div>

      <div>
        <h2 className="text-xl font-black text-black">
          {title}
        </h2>

        <p className="mt-1 text-sm text-[#6f6254]">
          {description}
        </p>
      </div>
    </div>
  );
}

function MetadataBadge({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <span className="rounded-lg border border-[#e3d8c7] bg-white px-3 py-2 text-xs text-[#6f6254]">
      <span className="font-bold text-[#3f352a]">
        {label}:
      </span>{" "}
      {value}
    </span>
  );
}

function Input({
  label,
  name,
  value,
  type = "text",
  required = false,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  type?: string;
  required?: boolean;
  onChange: ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-[#3f352a]">
        {label}{" "}
        {required && (
          <span className="text-red-500">
            *
          </span>
        )}
      </label>

      <input
        name={name}
        type={type}
        value={value}
        required={required}
        onChange={onChange}
        min={
          type === "number" ? 1 : undefined
        }
        className="w-full rounded-xl border border-[#dfd4c4] bg-white p-3 text-black outline-none transition focus:border-[#c89132] focus:ring-2 focus:ring-[#f4dfb9]"
      />
    </div>
  );
}

function Select({
  label,
  name,
  value,
  options,
  required = false,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  options: SelectOption[];
  required?: boolean;
  onChange: ChangeEventHandler<HTMLSelectElement>;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-[#3f352a]">
        {label}{" "}
        {required && (
          <span className="text-red-500">
            *
          </span>
        )}
      </label>

      <select
        name={name}
        value={value}
        required={required}
        onChange={onChange}
        className="w-full rounded-xl border border-[#dfd4c4] bg-white p-3 text-black outline-none transition focus:border-[#c89132] focus:ring-2 focus:ring-[#f4dfb9]"
      >
        <option value="">Select</option>

        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}