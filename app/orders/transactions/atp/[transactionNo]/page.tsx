"use client";

import AppShell from "@/app/components/AppShell";
import PageHeader from "@/app/components/PageHeader";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
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

const TAX_TYPE_OPTIONS = ["VAT", "NON-VAT", "OTHER"];

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

const STATUS_OPTIONS = [
  "Pending",
  "In Progress",
  "Waiting for Client",
  "Completed",
  "Cancelled",
];

type TransactionDocument = {
  documentType: string;
  taxType: string;
  quantity: number;
};

type TransactionRecord = {
  rowNumber: number;
  dateReceived: string;
  applicationMethod: string;
  formUsed: string[];
  taxpayerName: string;
  businessName: string;
  branch: string;
  form1905: string[];
  computePenalty: string[];
  documents: TransactionDocument[];
  mobileNumber: string;
  email: string;
  assistedBy: string;
  books: string[];
  transactionNo: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  trelloCardId: string;
  trelloCardUrl: string;
};

type TransactionResponse = {
  success: boolean;
  transaction?: TransactionRecord;
  data?: TransactionRecord;
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

function createDocumentItem(
  document?: Partial<TransactionDocument>,
): DocumentItem {
  const documentType = document?.documentType || "";
  const taxType = document?.taxType || "";

  return {
    id: crypto.randomUUID(),

    documentType: DOCUMENT_OPTIONS.includes(documentType)
      ? documentType
      : documentType
        ? "OTHER"
        : "",

    documentTypeOther: DOCUMENT_OPTIONS.includes(documentType)
      ? ""
      : documentType,

    taxType: TAX_TYPE_OPTIONS.includes(taxType)
      ? taxType
      : taxType
        ? "OTHER"
        : "",

    taxTypeOther: TAX_TYPE_OPTIONS.includes(taxType)
      ? ""
      : taxType,

    quantity:
      document?.quantity !== undefined
        ? String(document.quantity)
        : "",
  };
}

function splitKnownAndOtherValues(
  values: string[],
  availableOptions: string[],
): {
  selected: string[];
  other: string;
} {
  const knownValues = values.filter((value) =>
    availableOptions.includes(value),
  );

  const customValues = values.filter(
    (value) => !availableOptions.includes(value),
  );

  if (customValues.length > 0) {
    return {
      selected: [...knownValues, "OTHER"],
      other: customValues.join(" | "),
    };
  }

  return {
    selected: knownValues,
    other: "",
  };
}

function normalizeSelectedValues(
  selectedValues: string[],
  otherValue: string,
): string[] {
  return selectedValues
    .map((selectedValue) => {
      if (selectedValue !== "OTHER") {
        return selectedValue.trim();
      }

      return otherValue.trim();
    })
    .filter(Boolean);
}

function resolveDocumentType(document: DocumentItem): string {
  if (document.documentType === "OTHER") {
    return document.documentTypeOther.trim();
  }

  return document.documentType.trim();
}

function resolveTaxType(document: DocumentItem): string {
  if (document.taxType === "OTHER") {
    return document.taxTypeOther.trim();
  }

  return document.taxType.trim();
}

export default function EditAtpApplicationPage() {
  const router = useRouter();
  const params = useParams<{
    transactionNo: string;
  }>();

  const transactionNo = decodeURIComponent(
    String(params.transactionNo || ""),
  );

  const [transaction, setTransaction] =
    useState<TransactionRecord | null>(null);

  const [dateReceived, setDateReceived] = useState("");
  const [applicationMethod, setApplicationMethod] =
    useState("");

  const [selectedForms, setSelectedForms] = useState<
    string[]
  >([]);
  const [formUsedOther, setFormUsedOther] = useState("");

  const [taxpayerName, setTaxpayerName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [branch, setBranch] = useState("");

  const [selectedForm1905, setSelectedForm1905] =
    useState<string[]>([]);
  const [form1905Other, setForm1905Other] = useState("");

  const [selectedPenalties, setSelectedPenalties] =
    useState<string[]>([]);
  const [penaltyOther, setPenaltyOther] = useState("");

  const [documents, setDocuments] = useState<DocumentItem[]>([
    createDocumentItem(),
  ]);

  const [mobileNumber, setMobileNumber] = useState("");
  const [email, setEmail] = useState("");

  const [assistedBy, setAssistedBy] = useState("");
  const [assistedByOther, setAssistedByOther] =
    useState("");

  const [books, setBooks] = useState("");
  const [status, setStatus] = useState("Pending");

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [loadError, setLoadError] = useState("");
  const [submissionError, setSubmissionError] =
    useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const populateForm = useCallback(
    (record: TransactionRecord) => {
      setTransaction(record);

      setDateReceived(record.dateReceived || "");
      setApplicationMethod(record.applicationMethod || "");

      const formUsedValues = splitKnownAndOtherValues(
        record.formUsed || [],
        FORM_USED_OPTIONS,
      );

      setSelectedForms(formUsedValues.selected);
      setFormUsedOther(formUsedValues.other);

      setTaxpayerName(record.taxpayerName || "");
      setBusinessName(record.businessName || "");
      setBranch(record.branch || "");

      const form1905Values = splitKnownAndOtherValues(
        record.form1905 || [],
        FORM_1905_OPTIONS,
      );

      setSelectedForm1905(form1905Values.selected);
      setForm1905Other(form1905Values.other);

      const penaltyValues = splitKnownAndOtherValues(
        record.computePenalty || [],
        PENALTY_OPTIONS,
      );

      setSelectedPenalties(penaltyValues.selected);
      setPenaltyOther(penaltyValues.other);

      setDocuments(
        record.documents?.length
          ? record.documents.map((document) =>
              createDocumentItem(document),
            )
          : [createDocumentItem()],
      );

      setMobileNumber(record.mobileNumber || "");
      setEmail(record.email || "");

      if (
        record.assistedBy &&
        ASSISTED_BY_OPTIONS.includes(record.assistedBy)
      ) {
        setAssistedBy(record.assistedBy);
        setAssistedByOther("");
      } else if (record.assistedBy) {
        setAssistedBy("OTHER");
        setAssistedByOther(record.assistedBy);
      } else {
        setAssistedBy("");
        setAssistedByOther("");
      }

      setBooks(record.books?.[0] || "");
      setStatus(record.status || "Pending");
    },
    [],
  );

  const loadTransaction = useCallback(async () => {
    if (!transactionNo) {
      setLoadError("Transaction number is missing.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError("");

    try {
      const response = await fetch(
        `/api/transactions/${encodeURIComponent(
          transactionNo,
        )}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const result =
        (await response.json()) as TransactionResponse;

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            result.details ||
            "Failed to load the transaction.",
        );
      }

      const record = result.transaction || result.data;

      if (!record) {
        throw new Error(
          "The API returned no transaction record.",
        );
      }

      populateForm(record);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Failed to load the transaction.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [populateForm, transactionNo]);

  useEffect(() => {
    void loadTransaction();
  }, [loadTransaction]);

  function toggleSelectedValue(
    currentValues: string[],
    value: string,
    setter: (values: string[]) => void,
  ) {
    if (currentValues.includes(value)) {
      setter(
        currentValues.filter(
          (currentValue) => currentValue !== value,
        ),
      );

      return;
    }

    setter([...currentValues, value]);
  }

  function updateDocument(
    id: string,
    field: keyof Omit<DocumentItem, "id">,
    value: string,
  ) {
    setDocuments((currentDocuments) =>
      currentDocuments.map((document) =>
        document.id === id
          ? {
              ...document,
              [field]: value,
            }
          : document,
      ),
    );
  }

  function addDocument() {
    setDocuments((currentDocuments) => [
      ...currentDocuments,
      createDocumentItem(),
    ]);
  }

  function removeDocument(id: string) {
    setDocuments((currentDocuments) => {
      if (currentDocuments.length === 1) {
        return currentDocuments;
      }

      return currentDocuments.filter(
        (document) => document.id !== id,
      );
    });
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setSubmissionError("");
    setSuccessMessage("");

    const normalizedForms = normalizeSelectedValues(
      selectedForms,
      formUsedOther,
    );

    if (normalizedForms.length === 0) {
      setSubmissionError(
        "Select at least one option under Form Used.",
      );
      return;
    }

    if (
      selectedForms.includes("OTHER") &&
      !formUsedOther.trim()
    ) {
      setSubmissionError("Specify the other form used.");
      return;
    }

    if (
      selectedForm1905.includes("OTHER") &&
      !form1905Other.trim()
    ) {
      setSubmissionError(
        "Specify the other 1905 transaction.",
      );
      return;
    }

    if (
      selectedPenalties.includes("OTHER") &&
      !penaltyOther.trim()
    ) {
      setSubmissionError(
        "Specify the other penalty or transaction.",
      );
      return;
    }

    const normalizedDocuments = documents.map(
      (document) => ({
        documentType: resolveDocumentType(document),
        taxType: resolveTaxType(document),
        quantity: Number(document.quantity),
      }),
    );

    for (
      let index = 0;
      index < normalizedDocuments.length;
      index += 1
    ) {
      const document = normalizedDocuments[index];

      if (!document.documentType) {
        setSubmissionError(
          `Select the invoice or receipt type for Document ${
            index + 1
          }.`,
        );
        return;
      }

      if (!document.taxType) {
        setSubmissionError(
          `Select the tax type for Document ${index + 1}.`,
        );
        return;
      }

      if (
        !Number.isFinite(document.quantity) ||
        !Number.isInteger(document.quantity) ||
        document.quantity < 1
      ) {
        setSubmissionError(
          `The quantity for Document ${
            index + 1
          } must be a whole number of at least 1.`,
        );
        return;
      }
    }

    const resolvedAssistedBy =
      assistedBy === "OTHER"
        ? assistedByOther.trim()
        : assistedBy.trim();

    if (!resolvedAssistedBy) {
      setSubmissionError(
        "Select or specify the staff member assisting the transaction.",
      );
      return;
    }

    const payload = {
      dateReceived,
      applicationMethod,

      formUsed: normalizedForms,

      form1905: normalizeSelectedValues(
        selectedForm1905,
        form1905Other,
      ),

      computePenalty: normalizeSelectedValues(
        selectedPenalties,
        penaltyOther,
      ),

      taxpayerName: taxpayerName.trim(),
      businessName: businessName.trim(),
      branch: branch.trim(),

      documents: normalizedDocuments,

      mobileNumber: mobileNumber.trim(),
      email: email.trim(),

      assistedBy: resolvedAssistedBy,

      books: books ? [books] : [],

      status,
    };

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/transactions/${encodeURIComponent(
          transactionNo,
        )}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const result =
        (await response.json()) as TransactionResponse;

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            result.details ||
            "The transaction could not be updated.",
        );
      }

      if (result.transaction) {
        populateForm(result.transaction);
      }

      setSuccessMessage(
        `Transaction ${transactionNo} was updated successfully.`,
      );

      window.setTimeout(() => {
        router.push("/orders/transactions/atp");
        router.refresh();
      }, 1200);
    } catch (error) {
      setSubmissionError(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while updating the transaction.",
      );

      setIsSubmitting(false);
    }
  }

  const totalDocumentQuantity = documents.reduce(
    (total, document) => {
      const quantity = Number(document.quantity);

      if (!Number.isFinite(quantity) || quantity < 0) {
        return total;
      }

      return total + quantity;
    },
    0,
  );

  if (isLoading) {
    return (
      <AppShell activePage="orders" contentWidth="form">
        <PageHeader
          eyebrow="Transactions / ATP Processing"
          title="Edit ATP Application"
          description="Loading transaction details..."
        />

        <div className="mt-7 rounded-2xl border border-[#e3d8c7] bg-white px-6 py-16 text-center shadow-sm">
          <p className="text-sm font-bold text-[#6f6254]">
            Loading ATP application...
          </p>
        </div>
      </AppShell>
    );
  }

  if (loadError || !transaction) {
    return (
      <AppShell activePage="orders" contentWidth="form">
        <PageHeader
          eyebrow="Transactions / ATP Processing"
          title="Edit ATP Application"
          description="The requested transaction could not be loaded."
        />

        <div className="mt-7 rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="font-black text-red-800">
            Unable to load transaction
          </p>

          <p className="mt-2 text-sm text-red-700">
            {loadError || "Transaction not found."}
          </p>

          <Link
            href="/orders/transactions/atp"
            className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-black px-5 text-sm font-black text-white"
          >
            Back to ATP Processing
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activePage="orders" contentWidth="form">
      <PageHeader
        eyebrow="Transactions / ATP Processing"
        title="Edit ATP Application"
        description={`Update transaction ${transactionNo}. Changes will be synchronized to Google Sheets and Trello.`}
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/orders/transactions/atp"
          className="text-sm font-bold text-[#6b421f] hover:underline"
        >
          ← Back to ATP Processing
        </Link>

        {transaction.trelloCardUrl && (
          <a
            href={transaction.trelloCardUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-black px-4 text-xs font-black text-white transition hover:bg-[#6b421f]"
          >
            Open Trello Card
          </a>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-7 space-y-6">
        {submissionError && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700"
          >
            {submissionError}
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            className="rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-sm font-bold text-green-800"
          >
            {successMessage}
          </div>
        )}

        <FormSection
          number="1"
          title="Application Information"
          description="Update the primary ATP application information."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <FormField
              label="Date Received of Application"
              required
            >
              <input
                type="date"
                value={dateReceived}
                required
                disabled={isSubmitting}
                onChange={(event) =>
                  setDateReceived(event.target.value)
                }
                className={inputClassName}
              />
            </FormField>

            <FormField label="Manual or ORUS" required>
              <select
                value={applicationMethod}
                required
                disabled={isSubmitting}
                onChange={(event) =>
                  setApplicationMethod(event.target.value)
                }
                className={inputClassName}
              >
                <option value="" disabled>
                  Select processing method
                </option>

                <option value="MANUAL">MANUAL</option>
                <option value="ORUS">ORUS</option>
              </select>
            </FormField>

            <div>
              <MultiSelectDropdown
                label="Form Used"
                required
                options={FORM_USED_OPTIONS}
                selectedValues={selectedForms}
                disabled={isSubmitting}
                placeholder="Select form used"
                onToggle={(value) =>
                  toggleSelectedValue(
                    selectedForms,
                    value,
                    setSelectedForms,
                  )
                }
              />

              {selectedForms.includes("OTHER") && (
                <input
                  type="text"
                  value={formUsedOther}
                  required
                  disabled={isSubmitting}
                  onChange={(event) =>
                    setFormUsedOther(event.target.value)
                  }
                  placeholder="Specify other form used"
                  className={`${inputClassName} mt-3`}
                />
              )}
            </div>

            <FormField label="Status" required>
              <select
                value={status}
                required
                disabled={isSubmitting}
                onChange={(event) =>
                  setStatus(event.target.value)
                }
                className={inputClassName}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Taxpayer Name" required>
              <input
                type="text"
                value={taxpayerName}
                required
                disabled={isSubmitting}
                onChange={(event) =>
                  setTaxpayerName(event.target.value)
                }
                className={inputClassName}
              />
            </FormField>

            <FormField
              label="Business / Trade Name"
              required
            >
              <input
                type="text"
                value={businessName}
                required
                disabled={isSubmitting}
                onChange={(event) =>
                  setBusinessName(event.target.value)
                }
                className={inputClassName}
              />
            </FormField>

            <FormField label="Branch">
              <input
                type="text"
                value={branch}
                disabled={isSubmitting}
                onChange={(event) =>
                  setBranch(event.target.value)
                }
                className={inputClassName}
              />
            </FormField>

            <FormField label="Transaction Number">
              <input
                type="text"
                value={transactionNo}
                disabled
                className={inputClassName}
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection
          number="2"
          title="Processing Details"
          description="Update all applicable registration and penalty transactions."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <MultiSelectDropdown
                label="1905"
                options={FORM_1905_OPTIONS}
                selectedValues={selectedForm1905}
                disabled={isSubmitting}
                placeholder="Select 1905 transaction"
                onToggle={(value) =>
                  toggleSelectedValue(
                    selectedForm1905,
                    value,
                    setSelectedForm1905,
                  )
                }
              />

              {selectedForm1905.includes("OTHER") && (
                <input
                  type="text"
                  value={form1905Other}
                  required
                  disabled={isSubmitting}
                  onChange={(event) =>
                    setForm1905Other(event.target.value)
                  }
                  placeholder="Specify other 1905 transaction"
                  className={`${inputClassName} mt-3`}
                />
              )}
            </div>

            <div>
              <MultiSelectDropdown
                label="Compute Penalty (0605)"
                options={PENALTY_OPTIONS}
                selectedValues={selectedPenalties}
                disabled={isSubmitting}
                placeholder="Select penalty or transaction"
                onToggle={(value) =>
                  toggleSelectedValue(
                    selectedPenalties,
                    value,
                    setSelectedPenalties,
                  )
                }
              />

              {selectedPenalties.includes("OTHER") && (
                <input
                  type="text"
                  value={penaltyOther}
                  required
                  disabled={isSubmitting}
                  onChange={(event) =>
                    setPenaltyOther(event.target.value)
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
          description="Update each document type, tax type, and corresponding quantity."
        >
          <div className="space-y-4">
            {documents.map((document, index) => (
              <DocumentItemFields
                key={document.id}
                document={document}
                index={index}
                canRemove={documents.length > 1}
                disabled={isSubmitting}
                onChange={updateDocument}
                onRemove={removeDocument}
              />
            ))}

            <div className="flex flex-col gap-4 rounded-xl border border-[#e3d8c7] bg-[#fbf7ef] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black text-black">
                  Total Booklets or Pads
                </p>

                <p className="mt-1 text-sm text-[#6f6254]">
                  {totalDocumentQuantity} total across{" "}
                  {documents.length} document
                  {documents.length === 1 ? "" : "s"}
                </p>
              </div>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={addDocument}
                className="inline-flex h-11 items-center justify-center rounded-lg border border-black bg-white px-5 text-sm font-black text-black transition hover:bg-black hover:text-white disabled:opacity-50"
              >
                + Add Another Document
              </button>
            </div>
          </div>
        </FormSection>

        <FormSection
          number="4"
          title="Contact and Assignment"
          description="Update available customer contact details and assignment information."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <FormField label="Mobile / Viber Number">
              <input
                type="tel"
                value={mobileNumber}
                disabled={isSubmitting}
                onChange={(event) =>
                  setMobileNumber(event.target.value)
                }
                placeholder="Optional"
                className={inputClassName}
              />
            </FormField>

            <FormField label="Email">
              <input
                type="email"
                value={email}
                disabled={isSubmitting}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="Optional"
                className={inputClassName}
              />
            </FormField>

            <FormField label="Assisted By" required>
              <select
                value={assistedBy}
                required
                disabled={isSubmitting}
                onChange={(event) =>
                  setAssistedBy(event.target.value)
                }
                className={inputClassName}
              >
                <option value="" disabled>
                  Select staff member
                </option>

                {ASSISTED_BY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>

              {assistedBy === "OTHER" && (
                <input
                  type="text"
                  value={assistedByOther}
                  required
                  disabled={isSubmitting}
                  onChange={(event) =>
                    setAssistedByOther(event.target.value)
                  }
                  placeholder="Specify staff member"
                  className={`${inputClassName} mt-3`}
                />
              )}
            </FormField>

            <FormField label="Books" required>
              <select
                value={books}
                required
                disabled={isSubmitting}
                onChange={(event) =>
                  setBooks(event.target.value)
                }
                className={inputClassName}
              >
                <option value="" disabled>
                  Select option
                </option>

                <option value="YES">YES</option>
                <option value="NO">NO</option>
              </select>
            </FormField>
          </div>
        </FormSection>

        <section className="flex flex-col-reverse gap-3 rounded-2xl border border-[#e3d8c7] bg-white p-5 shadow-sm sm:flex-row sm:justify-end">
          <Link
            href="/orders/transactions/atp"
            className="inline-flex h-12 items-center justify-center rounded-lg border border-[#cfc1ae] bg-white px-6 text-sm font-black text-black transition hover:bg-[#f8f2e8]"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-12 min-w-44 items-center justify-center rounded-lg bg-black px-7 text-sm font-black text-white transition hover:bg-[#6b421f] disabled:opacity-60"
          >
            {isSubmitting
              ? "Saving Changes..."
              : "Save Changes"}
          </button>
        </section>
      </form>
    </AppShell>
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
  onToggle: (value: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
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

  return (
    <div ref={containerRef} className="relative">
      <span className="mb-2 block text-sm font-black">
        {label}

        {required && (
          <span className="ml-1 text-red-600">*</span>
        )}
      </span>

      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        className="flex min-h-12 w-full items-center justify-between rounded-lg border border-[#d8cbb9] bg-white px-4 py-2 text-left text-sm"
      >
        <span className="flex flex-wrap gap-1.5">
          {selectedValues.length === 0
            ? placeholder
            : selectedValues.map((value) => (
                <span
                  key={value}
                  className="rounded-md bg-[#f3eadc] px-2 py-1 text-xs font-black text-[#6b421f]"
                >
                  {value}
                </span>
              ))}
        </span>

        <span>▼</span>
      </button>

      {isOpen && (
        <div className="absolute z-40 mt-2 w-full rounded-xl border border-[#d8cbb9] bg-white shadow-xl">
          <div className="max-h-64 overflow-y-auto p-2">
            {options.map((option) => {
              const selected = selectedValues.includes(option);

              return (
                <label
                  key={option}
                  className={`flex cursor-pointer gap-3 rounded-lg px-3 py-2.5 text-sm font-bold ${
                    selected
                      ? "bg-black text-white"
                      : "hover:bg-[#f8f2e8]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => onToggle(option)}
                    className="accent-black"
                  />

                  {option}
                </label>
              );
            })}
          </div>

          <div className="border-t p-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="h-10 w-full rounded-lg bg-black text-xs font-black text-white"
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
    field: keyof Omit<DocumentItem, "id">,
    value: string,
  ) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <section className="rounded-xl border border-[#ddd0bd] bg-[#fffdf9] p-5">
      <div className="mb-4 flex justify-between">
        <h3 className="font-black">
          Document {index + 1}
        </h3>

        {canRemove && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onRemove(document.id)}
            className="text-xs font-black text-red-700"
          >
            Remove
          </button>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <FormField
          label="Kind of Invoice or Receipt"
          required
        >
          <select
            value={document.documentType}
            disabled={disabled}
            onChange={(event) =>
              onChange(
                document.id,
                "documentType",
                event.target.value,
              )
            }
            className={inputClassName}
          >
            <option value="" disabled>
              Select document
            </option>

            {DOCUMENT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          {document.documentType === "OTHER" && (
            <input
              value={document.documentTypeOther}
              onChange={(event) =>
                onChange(
                  document.id,
                  "documentTypeOther",
                  event.target.value,
                )
              }
              className={`${inputClassName} mt-3`}
              placeholder="Specify document"
            />
          )}
        </FormField>

        <FormField label="Tax Type" required>
          <select
            value={document.taxType}
            disabled={disabled}
            onChange={(event) =>
              onChange(
                document.id,
                "taxType",
                event.target.value,
              )
            }
            className={inputClassName}
          >
            <option value="" disabled>
              Select tax type
            </option>

            {TAX_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          {document.taxType === "OTHER" && (
            <input
              value={document.taxTypeOther}
              onChange={(event) =>
                onChange(
                  document.id,
                  "taxTypeOther",
                  event.target.value,
                )
              }
              className={`${inputClassName} mt-3`}
              placeholder="Specify tax type"
            />
          )}
        </FormField>

        <FormField
          label="No. of Booklets or Pads"
          required
        >
          <input
            type="number"
            min="1"
            step="1"
            value={document.quantity}
            disabled={disabled}
            onChange={(event) =>
              onChange(
                document.id,
                "quantity",
                event.target.value,
              )
            }
            className={inputClassName}
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
      <div className="border-b bg-[#fbf7ef] px-7 py-4">
        <div className="flex gap-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-sm font-black text-white">
            {number}
          </div>

          <div>
            <h2 className="text-lg font-black">{title}</h2>
            <p className="mt-1 text-sm text-[#6f6254]">
              {description}
            </p>
          </div>
        </div>
      </div>

      <div className="p-7">{children}</div>
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
      <span className="mb-2 block text-sm font-black">
        {label}
        {required && (
          <span className="ml-1 text-red-600">*</span>
        )}
      </span>

      {children}
    </label>
  );
}

const inputClassName =
  "h-12 w-full rounded-lg border border-[#d8cbb9] bg-white px-4 text-sm text-black outline-none focus:border-[#8b5e34] focus:ring-2 focus:ring-[#8b5e34]/10 disabled:bg-[#f4f1ec]";