"use client";

import AppShell from "@/app/components/AppShell";
import PageHeader from "@/app/components/PageHeader";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

const FORM_USED_OPTIONS = [
  "1901",
  "1905",
  "1906",
  "S1905",
  "S1903",
  "0605",
  "1906 / 1900",
  "CANCELLATION",
  "CMS",
  "BOOKS",
  "DESTRUCTION",
  "COR",
  "1702-RT",
  "OTHER",
];

const FORM_1905_OPTIONS = [
  "UPDATING OF COR",
  "CHANGE OF REGISTERED ADDRESS",
  "CHANGE OF BUSINESS NAME",
  "CHANGE OF REGISTERED ACTIVITY",
  "CHANGE OF TAX TYPE",
  "CHANGE OF CONTACT INFORMATION",
  "REPLACEMENT OF COR",
  "CLOSURE OF BUSINESS",
  "OTHER",
];

const PENALTY_OPTIONS = [
  "ANNUAL REGISTRATION FEE",
  "LOST COR",
  "LOST ATP",
  "LOST NIRI",
  "LATE REGISTRATION COR",
  "LATE STAMPING ATP",
  "NO INVENTORY LIST",
  "SLS",
  "SLP",
  "SLI",
  "QAP",
  "SAWT",
  "LIS",
  "1604E - ALPHALIST",
  "1604C - ALPHALIST",
  "TCVD",
  "DESTRUCTION OF BOOKLETS",
  "1702-RT",
  "OTHER",
];

const DOCUMENT_OPTIONS = [
  "SALES INVOICE",
  "SERVICE INVOICE",
  "INVOICE",
  "COLLECTION RECEIPT",
  "DELIVERY RECEIPT",
  "ACKNOWLEDGEMENT RECEIPT",
  "BILLING INVOICE",
  "SERVICE / COLLECTION",
  "SALES / ACKNOWLEDGEMENT",
  "SALES / DR",
  "SALES / CR / DR",
  "SALES / SERVICE",
  "COLLECTION / ACKNOWLEDGEMENT",
  "CREDIT MEMO",
  "OTHER",
];

const TAX_TYPE_OPTIONS = [
  "VAT",
  "NON-VAT",
  "OTHER",
];

const ASSISTED_BY_OPTIONS = [
  "ADMIN - SHANE",
  "ADMIN - ALGEAN",
  "ADMIN - CHARINA",
  "ADMIN - CARLO",
  "CSR - TIN",
  "CSR - GELO",
  "CSR - TINA",
  "5 J'S",
  "HR - AY",
  "MAAM JESLIE",
  "SALES - JARYL",
  "SALES - ANGELICA",
  "SALES - RUBIE",
  "SALES - LANIE",
  "SIR DENNIS",
  "MARKETING - MARK",
  "OTHER",
];

type CreateTransactionResponse = {
  success: boolean;
  transactionNo?: string;
  error?: string;
  details?: string;
};

type DocumentItem = {
  id: string;
  documentType: string;
  documentTypeOther: string;
  taxType: string;
  taxTypeOther: string;
  quantity: string;
};

type NormalizedDocument = {
  documentType: string;
  taxType: string;
  quantity: number;
};

function createDocumentItem(): DocumentItem {
  return {
    id: crypto.randomUUID(),
    documentType: "",
    documentTypeOther: "",
    taxType: "",
    taxTypeOther: "",
    quantity: "",
  };
}

function getFormValue(
  formData: FormData,
  fieldName: string,
): string {
  return String(
    formData.get(fieldName) ?? "",
  ).trim();
}

function normalizeSelectedValues(
  selectedValues: string[],
  otherValue: string,
): string[] {
  return selectedValues
    .map((selectedValue) => {
      if (
        selectedValue !==
        "OTHER"
      ) {
        return selectedValue.trim();
      }

      return otherValue.trim();
    })
    .filter(Boolean);
}

function resolveDocumentType(
  document: DocumentItem,
): string {
  if (
    document.documentType ===
    "OTHER"
  ) {
    return document.documentTypeOther.trim();
  }

  return document.documentType.trim();
}

function resolveTaxType(
  document: DocumentItem,
): string {
  if (
    document.taxType ===
    "OTHER"
  ) {
    return document.taxTypeOther.trim();
  }

  return document.taxType.trim();
}

function hasDocumentInput(
  document: DocumentItem,
): boolean {
  return Boolean(
    resolveDocumentType(
      document,
    ) ||
      resolveTaxType(
        document,
      ) ||
      document.quantity.trim(),
  );
}

function getLocalDateValue(): string {
  const now = new Date();

  const offset =
    now.getTimezoneOffset() *
    60_000;

  return new Date(
    now.getTime() -
      offset,
  )
    .toISOString()
    .slice(0, 10);
}

export default function NewAtpApplicationPage() {
  const router = useRouter();

  const [
    selectedForms,
    setSelectedForms,
  ] =
    useState<string[]>([]);

  const [
    formUsedOther,
    setFormUsedOther,
  ] =
    useState("");

  const [
    selectedForm1905,
    setSelectedForm1905,
  ] =
    useState<string[]>([]);

  const [
    form1905Other,
    setForm1905Other,
  ] =
    useState("");

  const [
    selectedPenalties,
    setSelectedPenalties,
  ] =
    useState<string[]>([]);

  const [
    penaltyOther,
    setPenaltyOther,
  ] =
    useState("");

  const [
    documents,
    setDocuments,
  ] =
    useState<
      DocumentItem[]
    >([
      createDocumentItem(),
    ]);

  const [
    assistedBy,
    setAssistedBy,
  ] =
    useState("");

  const [
    isSubmitting,
    setIsSubmitting,
  ] =
    useState(false);

  const [
    submissionError,
    setSubmissionError,
  ] =
    useState("");

  const [
    createdTransactionNo,
    setCreatedTransactionNo,
  ] =
    useState("");

  const [
    showSuccessModal,
    setShowSuccessModal,
  ] =
    useState(false);

  const [
    copied,
    setCopied,
  ] =
    useState(false);

  function toggleSelectedValue(
    currentValues: string[],
    value: string,
    setter: (
      values: string[],
    ) => void,
  ) {
    if (
      currentValues.includes(
        value,
      )
    ) {
      setter(
        currentValues.filter(
          (
            currentValue,
          ) =>
            currentValue !==
            value,
        ),
      );

      return;
    }

    setter([
      ...currentValues,
      value,
    ]);
  }

  function updateDocument(
    id: string,
    field: keyof Omit<
      DocumentItem,
      "id"
    >,
    value: string,
  ) {
    setDocuments(
      (
        currentDocuments,
      ) =>
        currentDocuments.map(
          (document) =>
            document.id ===
            id
              ? {
                  ...document,
                  [field]:
                    value,
                }
              : document,
        ),
    );
  }

  function addDocument() {
    setDocuments(
      (
        currentDocuments,
      ) => [
        ...currentDocuments,
        createDocumentItem(),
      ],
    );
  }

  function removeDocument(
    id: string,
  ) {
    setDocuments(
      (
        currentDocuments,
      ) => {
        if (
          currentDocuments.length ===
          1
        ) {
          return [
            createDocumentItem(),
          ];
        }

        return currentDocuments.filter(
          (document) =>
            document.id !==
            id,
        );
      },
    );
  }

  function resetFormState(
    form: HTMLFormElement,
  ) {
    form.reset();

    setSelectedForms([]);
    setFormUsedOther("");

    setSelectedForm1905([]);
    setForm1905Other("");

    setSelectedPenalties([]);
    setPenaltyOther("");

    setDocuments([
      createDocumentItem(),
    ]);

    setAssistedBy("");
  }

  async function handleCopyTransactionNumber() {
    if (
      !createdTransactionNo
    ) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        createdTransactionNo,
      );

      setCopied(true);

      window.setTimeout(
        () => {
          setCopied(
            false,
          );
        },
        2000,
      );
    } catch (error) {
      console.error(
        "Failed to copy transaction number:",
        error,
      );
    }
  }

  function handleCloseSuccessModal() {
    setShowSuccessModal(
      false,
    );

    setCreatedTransactionNo(
      "",
    );

    setCopied(false);

    router.push(
      "/orders/transactions/atp",
    );

    router.refresh();
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      isSubmitting
    ) {
      return;
    }

    const form =
      event.currentTarget;

    const formData =
      new FormData(
        form,
      );

    setSubmissionError(
      "",
    );

    setCreatedTransactionNo(
      "",
    );

    setShowSuccessModal(
      false,
    );

    setCopied(false);

    const normalizedForms =
      normalizeSelectedValues(
        selectedForms,
        formUsedOther,
      );

    if (
      normalizedForms.length ===
      0
    ) {
      setSubmissionError(
        "Select at least one option under Form Used.",
      );

      return;
    }

    if (
      selectedForms.includes(
        "OTHER",
      ) &&
      !formUsedOther.trim()
    ) {
      setSubmissionError(
        "Specify the other form used.",
      );

      return;
    }

    if (
      selectedForm1905.includes(
        "OTHER",
      ) &&
      !form1905Other.trim()
    ) {
      setSubmissionError(
        "Specify the other 1905 transaction.",
      );

      return;
    }

    if (
      selectedPenalties.includes(
        "OTHER",
      ) &&
      !penaltyOther.trim()
    ) {
      setSubmissionError(
        "Specify the other penalty or transaction.",
      );

      return;
    }

    /*
     * DOCUMENTS ARE OPTIONAL.
     *
     * Completely blank document rows
     * are ignored.
     *
     * Once any part of a document is
     * entered, all required document
     * details must be completed.
     */
    const filledDocuments =
      documents.filter(
        hasDocumentInput,
      );

    const normalizedDocuments: NormalizedDocument[] =
      [];

    for (
      let index = 0;
      index <
      filledDocuments.length;
      index += 1
    ) {
      const sourceDocument =
        filledDocuments[
          index
        ];

      const documentType =
        resolveDocumentType(
          sourceDocument,
        );

      const taxType =
        resolveTaxType(
          sourceDocument,
        );

      const quantity =
        Number(
          sourceDocument.quantity,
        );

      const originalIndex =
        documents.findIndex(
          (document) =>
            document.id ===
            sourceDocument.id,
        );

      const documentNumber =
        originalIndex >= 0
          ? originalIndex + 1
          : index + 1;

      if (
        !documentType
      ) {
        setSubmissionError(
          `Select the invoice or receipt type for Document ${documentNumber}.`,
        );

        return;
      }

      if (!taxType) {
        setSubmissionError(
          `Select the tax type for Document ${documentNumber}.`,
        );

        return;
      }

      if (
        !Number.isFinite(
          quantity,
        ) ||
        !Number.isInteger(
          quantity,
        ) ||
        quantity < 1
      ) {
        setSubmissionError(
          `The quantity for Document ${documentNumber} must be a whole number of at least 1.`,
        );

        return;
      }

      normalizedDocuments.push(
        {
          documentType,
          taxType,
          quantity,
        },
      );
    }

    const resolvedAssistedBy =
      assistedBy ===
      "OTHER"
        ? getFormValue(
            formData,
            "assistedByOther",
          )
        : assistedBy;

    if (
      !resolvedAssistedBy
    ) {
      setSubmissionError(
        "Select or specify the staff member assisting the transaction.",
      );

      return;
    }

    const books =
      getFormValue(
        formData,
        "books",
      );

    const payload = {
      dateReceived:
        getFormValue(
          formData,
          "dateReceived",
        ),

      applicationMethod:
        getFormValue(
          formData,
          "processingMethod",
        ),

      formUsed:
        normalizedForms,

      form1905:
        normalizeSelectedValues(
          selectedForm1905,
          form1905Other,
        ),

      computePenalty:
        normalizeSelectedValues(
          selectedPenalties,
          penaltyOther,
        ),

      taxpayerName:
        getFormValue(
          formData,
          "taxpayerName",
        ),

      businessName:
        getFormValue(
          formData,
          "businessName",
        ),

      tin:
        getFormValue(
          formData,
          "tin",
        ),

      rdoCode:
        getFormValue(
          formData,
          "rdoCode",
        ).toUpperCase(),

      documents:
        normalizedDocuments,

      mobileNumber:
        getFormValue(
          formData,
          "mobileNumber",
        ),

      email:
        getFormValue(
          formData,
          "email",
        ),

      assistedBy:
        resolvedAssistedBy,

      books: books
        ? [books]
        : [],

      status:
        "Pending",
    };

    setIsSubmitting(
      true,
    );

    try {
      const response =
        await fetch(
          "/api/transactions",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                payload,
              ),
          },
        );

      const result =
        (await response.json()) as CreateTransactionResponse;

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ||
            result.details ||
            "The ATP application could not be created.",
        );
      }

      const transactionNo =
        result.transactionNo?.trim() ||
        "Not Available";

      setCreatedTransactionNo(
        transactionNo,
      );

      resetFormState(
        form,
      );

      setShowSuccessModal(
        true,
      );
    } catch (error) {
      setSubmissionError(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while creating the application.",
      );
    } finally {
      setIsSubmitting(
        false,
      );
    }
  }

  const enteredDocuments =
    documents.filter(
      hasDocumentInput,
    );

  const totalDocumentQuantity =
    enteredDocuments.reduce(
      (
        total,
        document,
      ) => {
        const quantity =
          Number(
            document.quantity,
          );

        if (
          !Number.isFinite(
            quantity,
          ) ||
          quantity < 1
        ) {
          return total;
        }

        return (
          total +
          quantity
        );
      },
      0,
    );

  return (
    <AppShell
      activePage="orders"
      contentWidth="form"
    >
      <PageHeader
        eyebrow="Transactions / ATP Processing"
        title="New ATP Application"
        description="Record the customer's ATP processing information. This transaction remains separate from printing and production."
      />

      <div className="mt-6">
        <Link
          href="/orders/transactions/atp"
          className="text-sm font-bold text-[#6b421f] hover:underline"
        >
          ← Back to ATP
          Processing
        </Link>
      </div>

      <form
        onSubmit={
          handleSubmit
        }
        className="mt-7 space-y-6"
      >
        {submissionError && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-5 py-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black text-red-800">
                  Unable to
                  create ATP
                  application
                </p>

                <p className="mt-1 text-sm leading-6 text-red-700">
                  {
                    submissionError
                  }
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSubmissionError(
                    "",
                  )
                }
                className="shrink-0 rounded-md px-2 py-1 text-sm font-black text-red-700 transition hover:bg-red-100"
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          </div>
        )}

        <FormSection
          number="1"
          title="Application Information"
          description="Enter the primary information shown in the ATP monitoring record."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <FormField
              label="Date Received of Application"
              required
            >
              <input
                type="date"
                name="dateReceived"
                required
                defaultValue={
                  getLocalDateValue()
                }
                disabled={
                  isSubmitting
                }
                className={
                  inputClassName
                }
              />
            </FormField>

            <FormField
              label="Manual or ORUS"
              required
            >
              <select
                name="processingMethod"
                required
                defaultValue=""
                disabled={
                  isSubmitting
                }
                className={
                  inputClassName
                }
              >
                <option
                  value=""
                  disabled
                >
                  Select
                  processing
                  method
                </option>

                <option value="MANUAL">
                  MANUAL
                </option>

                <option value="ORUS">
                  ORUS
                </option>
              </select>
            </FormField>

            <div>
              <MultiSelectDropdown
                label="Form Used"
                required
                options={
                  FORM_USED_OPTIONS
                }
                selectedValues={
                  selectedForms
                }
                disabled={
                  isSubmitting
                }
                placeholder="Select form used"
                onToggle={(
                  value,
                ) =>
                  toggleSelectedValue(
                    selectedForms,
                    value,
                    setSelectedForms,
                  )
                }
              />

              {selectedForms.includes(
                "OTHER",
              ) && (
                <input
                  type="text"
                  value={
                    formUsedOther
                  }
                  disabled={
                    isSubmitting
                  }
                  onChange={(
                    event,
                  ) =>
                    setFormUsedOther(
                      event
                        .target
                        .value,
                    )
                  }
                  placeholder="Specify other form used"
                  className={`${inputClassName} mt-3`}
                />
              )}
            </div>

            <FormField
              label="Taxpayer Name"
              required
            >
              <input
                type="text"
                name="taxpayerName"
                required
                disabled={
                  isSubmitting
                }
                placeholder="Enter taxpayer name"
                className={
                  inputClassName
                }
              />
            </FormField>

            <FormField
              label="Business / Trade Name"
              required
            >
              <input
                type="text"
                name="businessName"
                required
                disabled={
                  isSubmitting
                }
                placeholder="Enter business or trade name"
                className={
                  inputClassName
                }
              />
            </FormField>

            <FormField
              label="TIN"
              required
            >
              <input
                type="text"
                name="tin"
                required
                disabled={
                  isSubmitting
                }
                placeholder="Example: 123-456-789-00000"
                className={
                  inputClassName
                }
              />
            </FormField>

            <FormField
              label="RDO Code"
              required
            >
              <input
                type="text"
                name="rdoCode"
                required
                disabled={
                  isSubmitting
                }
                placeholder="Example: 046"
                className={
                  inputClassName
                }
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection
          number="2"
          title="Processing Details"
          description="Select all applicable registration updates and penalty transactions."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <MultiSelectDropdown
                label="1905"
                options={
                  FORM_1905_OPTIONS
                }
                selectedValues={
                  selectedForm1905
                }
                disabled={
                  isSubmitting
                }
                placeholder="Select 1905 transaction"
                onToggle={(
                  value,
                ) =>
                  toggleSelectedValue(
                    selectedForm1905,
                    value,
                    setSelectedForm1905,
                  )
                }
              />

              {selectedForm1905.includes(
                "OTHER",
              ) && (
                <input
                  type="text"
                  value={
                    form1905Other
                  }
                  required
                  disabled={
                    isSubmitting
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm1905Other(
                      event
                        .target
                        .value,
                    )
                  }
                  placeholder="Specify other 1905 transaction"
                  className={`${inputClassName} mt-3`}
                />
              )}
            </div>

            <div>
              <MultiSelectDropdown
                label="Compute Penalty (0605)"
                options={
                  PENALTY_OPTIONS
                }
                selectedValues={
                  selectedPenalties
                }
                disabled={
                  isSubmitting
                }
                placeholder="Select penalty or transaction"
                onToggle={(
                  value,
                ) =>
                  toggleSelectedValue(
                    selectedPenalties,
                    value,
                    setSelectedPenalties,
                  )
                }
              />

              {selectedPenalties.includes(
                "OTHER",
              ) && (
                <input
                  type="text"
                  value={
                    penaltyOther
                  }
                  required
                  disabled={
                    isSubmitting
                  }
                  onChange={(
                    event,
                  ) =>
                    setPenaltyOther(
                      event
                        .target
                        .value,
                    )
                  }
                  placeholder="Specify other penalty or transaction"
                  className={`${inputClassName} mt-3`}
                />
              )}
            </div>
          </div>
        </FormSection>

        <FormSection
          number="3"
          title="Invoice or Receipt Information"
          description="Add invoice or receipt information when applicable. This section may be left blank."
        >
          <div className="space-y-4">
            {documents.map(
              (
                document,
                index,
              ) => (
                <DocumentItemFields
                  key={
                    document.id
                  }
                  document={
                    document
                  }
                  index={
                    index
                  }
                  canRemove={
                    documents.length >
                    1
                  }
                  disabled={
                    isSubmitting
                  }
                  onChange={
                    updateDocument
                  }
                  onRemove={
                    removeDocument
                  }
                />
              ),
            )}

            <div className="flex flex-col gap-4 rounded-xl border border-[#e3d8c7] bg-[#fbf7ef] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black text-black">
                  Total
                  Booklets or
                  Pads
                </p>

                <p className="mt-1 text-sm text-[#6f6254]">
                  {
                    totalDocumentQuantity
                  }{" "}
                  total across{" "}
                  {
                    enteredDocuments.length
                  }{" "}
                  document
                  {enteredDocuments.length ===
                  1
                    ? ""
                    : "s"}
                </p>
              </div>

              <button
                type="button"
                disabled={
                  isSubmitting
                }
                onClick={
                  addDocument
                }
                className="inline-flex h-11 items-center justify-center rounded-lg border border-black bg-white px-5 text-sm font-black text-black transition hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                + Add Another
                Document
              </button>
            </div>
          </div>
        </FormSection>

        <FormSection
          number="4"
          title="Contact and Assignment"
          description="Enter any available customer contact information and the staff member assisting the transaction."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <FormField label="Mobile / Viber Number">
              <input
                type="tel"
                name="mobileNumber"
                disabled={
                  isSubmitting
                }
                placeholder="Enter mobile or Viber number (optional)"
                className={
                  inputClassName
                }
              />
            </FormField>

            <FormField label="Email">
              <input
                type="email"
                name="email"
                disabled={
                  isSubmitting
                }
                placeholder="Enter email address (optional)"
                className={
                  inputClassName
                }
              />
            </FormField>

            <FormField
              label="Assisted By"
              required
            >
              <select
                name="assistedBy"
                required
                value={
                  assistedBy
                }
                disabled={
                  isSubmitting
                }
                onChange={(
                  event,
                ) =>
                  setAssistedBy(
                    event
                      .target
                      .value,
                  )
                }
                className={
                  inputClassName
                }
              >
                <option
                  value=""
                  disabled
                >
                  Select staff
                  member
                </option>

                {ASSISTED_BY_OPTIONS.map(
                  (
                    option,
                  ) => (
                    <option
                      key={
                        option
                      }
                      value={
                        option
                      }
                    >
                      {
                        option
                      }
                    </option>
                  ),
                )}
              </select>

              {assistedBy ===
                "OTHER" && (
                <input
                  type="text"
                  name="assistedByOther"
                  required
                  disabled={
                    isSubmitting
                  }
                  placeholder="Specify staff member"
                  className={`${inputClassName} mt-3`}
                />
              )}
            </FormField>

            <FormField
              label="Books"
              required
            >
              <select
                name="books"
                required
                defaultValue=""
                disabled={
                  isSubmitting
                }
                className={
                  inputClassName
                }
              >
                <option
                  value=""
                  disabled
                >
                  Select option
                </option>

                <option value="YES">
                  YES
                </option>

                <option value="NO">
                  NO
                </option>
              </select>
            </FormField>
          </div>
        </FormSection>

        <section className="flex flex-col-reverse gap-3 rounded-2xl border border-[#e3d8c7] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-end">
          <Link
            href="/orders/transactions/atp"
            aria-disabled={
              isSubmitting
            }
            className={`inline-flex h-12 items-center justify-center rounded-lg border border-[#cfc1ae] bg-white px-6 text-sm font-black text-black transition ${
              isSubmitting
                ? "pointer-events-none cursor-not-allowed opacity-50"
                : "hover:bg-[#f8f2e8]"
            }`}
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={
              isSubmitting
            }
            className="inline-flex h-12 min-w-44 items-center justify-center rounded-lg bg-black px-7 text-sm font-black text-white transition hover:bg-[#6b421f] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? "Creating Application..."
              : "Create Application"}
          </button>
        </section>
      </form>

      {showSuccessModal && (
        <SuccessModal
          transactionNumber={
            createdTransactionNo
          }
          copied={
            copied
          }
          onCopy={
            handleCopyTransactionNumber
          }
          onClose={
            handleCloseSuccessModal
          }
        />
      )}
    </AppShell>
  );
}

function SuccessModal({
  transactionNumber,
  copied,
  onCopy,
  onClose,
}: {
  transactionNumber: string;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="success-modal-title"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#d9c9b1] bg-white shadow-2xl">
        <div className="bg-black px-6 py-5 sm:px-7">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#b58a52] text-xl font-black text-black">
              ✓
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c6a66f]">
                Application
                Created
              </p>

              <h2
                id="success-modal-title"
                className="mt-1 text-xl font-black text-white"
              >
                ATP Application
                Successfully
                Created
              </h2>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-7">
          <p className="text-sm leading-6 text-[#6f6254]">
            The ATP
            application has
            been recorded
            successfully and
            is now available
            in the ATP
            Processing
            module.
          </p>

          <div className="mt-6 rounded-xl border border-[#dfd1bd] bg-[#fbf7ef] p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#7c6a56]">
              Transaction
              Number
            </p>

            <p className="mt-2 break-all font-mono text-xl font-black tracking-wide text-black sm:text-2xl">
              {
                transactionNumber
              }
            </p>

            {transactionNumber !==
              "Not Available" && (
              <button
                type="button"
                onClick={
                  onCopy
                }
                className="mt-4 inline-flex h-10 items-center justify-center rounded-lg border border-[#bda98c] bg-white px-4 text-xs font-black text-black transition hover:border-black hover:bg-black hover:text-white"
              >
                {copied
                  ? "Transaction Number Copied"
                  : "Copy Transaction Number"}
              </button>
            )}
          </div>

          <div className="mt-6 rounded-lg border border-[#eadfce] bg-[#fffdf9] px-4 py-3">
            <p className="text-xs leading-5 text-[#766958]">
              Click Done to
              return to ATP
              Processing and
              continue
              monitoring this
              application.
            </p>
          </div>

          <div className="mt-7 flex justify-end">
            <button
              type="button"
              onClick={
                onClose
              }
              className="inline-flex h-12 min-w-36 items-center justify-center rounded-lg bg-black px-6 text-sm font-black text-white transition hover:bg-[#6b421f]"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MultiSelectDropdown({
  label,
  required = false,
  options,
  selectedValues,
  disabled,
  placeholder,
  onToggle,
}: {
  label: string;
  required?: boolean;
  options: string[];
  selectedValues: string[];
  disabled: boolean;
  placeholder: string;
  onToggle: (
    value: string,
  ) => void;
}) {
  const containerRef =
    useRef<HTMLDivElement>(
      null,
    );

  const [
    isOpen,
    setIsOpen,
  ] =
    useState(false);

  useEffect(() => {
    function handleOutsideClick(
      event: MouseEvent,
    ) {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node,
        )
      ) {
        setIsOpen(
          false,
        );
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick,
      );
    };
  }, []);

  useEffect(() => {
    if (
      disabled
    ) {
      setIsOpen(
        false,
      );
    }
  }, [disabled]);

  return (
    <div
      ref={
        containerRef
      }
      className="relative"
    >
      <span className="mb-2 block text-sm font-black text-black">
        {label}

        {required && (
          <span className="ml-1 text-red-600">
            *
          </span>
        )}
      </span>

      <button
        type="button"
        disabled={
          disabled
        }
        aria-expanded={
          isOpen
        }
        onClick={() =>
          setIsOpen(
            (
              currentValue,
            ) =>
              !currentValue,
          )
        }
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-[#d8cbb9] bg-white px-4 py-2 text-left text-sm text-black outline-none transition hover:border-[#8b5e34] focus:border-[#8b5e34] focus:ring-2 focus:ring-[#8b5e34]/10 disabled:cursor-not-allowed disabled:bg-[#f4f1ec] disabled:text-[#7c7165]"
      >
        <span className="min-w-0 flex-1">
          {selectedValues.length ===
          0 ? (
            <span className="text-[#9a8d7d]">
              {
                placeholder
              }
            </span>
          ) : (
            <span className="flex flex-wrap gap-1.5">
              {selectedValues.map(
                (
                  value,
                ) => (
                  <span
                    key={
                      value
                    }
                    className="max-w-full truncate rounded-md bg-[#f3eadc] px-2 py-1 text-xs font-black text-[#6b421f]"
                  >
                    {
                      value
                    }
                  </span>
                ),
              )}
            </span>
          )}
        </span>

        <span
          aria-hidden="true"
          className={`shrink-0 text-xs transition-transform ${
            isOpen
              ? "rotate-180"
              : ""
          }`}
        >
          ▼
        </span>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-40 mt-2 overflow-hidden rounded-xl border border-[#d8cbb9] bg-white shadow-xl">
          <div className="max-h-64 overflow-y-auto p-2">
            <div className="space-y-1">
              {options.map(
                (
                  option,
                ) => {
                  const selected =
                    selectedValues.includes(
                      option,
                    );

                  return (
                    <label
                      key={
                        option
                      }
                      className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition ${
                        selected
                          ? "bg-black text-white"
                          : "text-black hover:bg-[#f8f2e8]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={
                          selected
                        }
                        disabled={
                          disabled
                        }
                        onChange={() =>
                          onToggle(
                            option,
                          )
                        }
                        className="h-4 w-4 shrink-0 accent-black"
                      />

                      <span>
                        {
                          option
                        }
                      </span>
                    </label>
                  );
                },
              )}
            </div>
          </div>

          <div className="border-t border-[#eee5d8] bg-[#fbf7ef] p-2">
            <button
              type="button"
              onClick={() =>
                setIsOpen(
                  false,
                )
              }
              className="h-10 w-full rounded-lg bg-black text-xs font-black text-white transition hover:bg-[#6b421f]"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentItemFields({
  document,
  index,
  canRemove,
  disabled,
  onChange,
  onRemove,
}: {
  document: DocumentItem;
  index: number;
  canRemove: boolean;
  disabled: boolean;
  onChange: (
    id: string,
    field: keyof Omit<
      DocumentItem,
      "id"
    >,
    value: string,
  ) => void;
  onRemove: (
    id: string,
  ) => void;
}) {
  return (
    <section className="rounded-xl border border-[#ddd0bd] bg-[#fffdf9] p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8b5e34]">
            Invoice or
            Receipt
          </p>

          <h3 className="mt-1 text-base font-black text-black">
            Document{" "}
            {index + 1}
          </h3>
        </div>

        {canRemove && (
          <button
            type="button"
            disabled={
              disabled
            }
            onClick={() =>
              onRemove(
                document.id,
              )
            }
            className="inline-flex h-9 items-center justify-center rounded-lg border border-red-200 bg-white px-4 text-xs font-black text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <FormField label="Kind of Invoice or Receipt">
          <select
            value={
              document.documentType
            }
            disabled={
              disabled
            }
            onChange={(
              event,
            ) =>
              onChange(
                document.id,
                "documentType",
                event.target
                  .value,
              )
            }
            className={
              inputClassName
            }
          >
            <option
              value=""
              disabled
            >
              Select
              invoice or
              receipt
            </option>

            {DOCUMENT_OPTIONS.map(
              (
                option,
              ) => (
                <option
                  key={
                    option
                  }
                  value={
                    option
                  }
                >
                  {
                    option
                  }
                </option>
              ),
            )}
          </select>

          {document.documentType ===
            "OTHER" && (
            <input
              type="text"
              value={
                document.documentTypeOther
              }
              disabled={
                disabled
              }
              onChange={(
                event,
              ) =>
                onChange(
                  document.id,
                  "documentTypeOther",
                  event.target
                    .value,
                )
              }
              placeholder="Specify invoice or receipt"
              className={`${inputClassName} mt-3`}
            />
          )}
        </FormField>

        <FormField label="Tax Type">
          <select
            value={
              document.taxType
            }
            disabled={
              disabled
            }
            onChange={(
              event,
            ) =>
              onChange(
                document.id,
                "taxType",
                event.target
                  .value,
              )
            }
            className={
              inputClassName
            }
          >
            <option
              value=""
              disabled
            >
              Select tax
              type
            </option>

            {TAX_TYPE_OPTIONS.map(
              (
                option,
              ) => (
                <option
                  key={
                    option
                  }
                  value={
                    option
                  }
                >
                  {
                    option
                  }
                </option>
              ),
            )}
          </select>

          {document.taxType ===
            "OTHER" && (
            <input
              type="text"
              value={
                document.taxTypeOther
              }
              disabled={
                disabled
              }
              onChange={(
                event,
              ) =>
                onChange(
                  document.id,
                  "taxTypeOther",
                  event.target
                    .value,
                )
              }
              placeholder="Specify tax type"
              className={`${inputClassName} mt-3`}
            />
          )}
        </FormField>

        <FormField label="No. of Booklets or Pads">
          <input
            type="number"
            min="1"
            step="1"
            value={
              document.quantity
            }
            disabled={
              disabled
            }
            onChange={(
              event,
            ) =>
              onChange(
                document.id,
                "quantity",
                event.target
                  .value,
              )
            }
            placeholder="Enter quantity"
            className={
              inputClassName
            }
          />
        </FormField>
      </div>
    </section>
  );
}

function FormSection({
  number,
  title,
  description,
  children,
}: {
  number: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-visible rounded-2xl border border-[#e3d8c7] bg-white shadow-sm">
      <div className="rounded-t-2xl border-b border-[#eee5d8] bg-[#fbf7ef] px-5 py-4 sm:px-7">
        <div className="flex items-start gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-sm font-black text-white">
            {number}
          </div>

          <div>
            <h2 className="text-lg font-black">
              {title}
            </h2>

            <p className="mt-1 text-sm leading-6 text-[#6f6254]">
              {
                description
              }
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-7">
        {children}
      </div>
    </section>
  );
}

function FormField({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-black">
        {label}

        {required && (
          <span className="ml-1 text-red-600">
            *
          </span>
        )}
      </span>

      {children}
    </label>
  );
}

const inputClassName =
  "h-12 w-full rounded-lg border border-[#d8cbb9] bg-white px-4 text-sm text-black outline-none transition placeholder:text-[#9a8d7d] focus:border-[#8b5e34] focus:ring-2 focus:ring-[#8b5e34]/10 disabled:cursor-not-allowed disabled:bg-[#f4f1ec] disabled:text-[#7c7165]";