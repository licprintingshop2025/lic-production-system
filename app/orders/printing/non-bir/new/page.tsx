"use client";

import AppShell from "@/app/components/AppShell";
import DocumentItemCard, {
  createEmptyDocument,
} from "@/app/components/forms/DocumentItemCard";
import PageHeader from "@/app/components/PageHeader";
import type { DocumentItem } from "@/lib/orders/types";
import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useState,
} from "react";

type FormData = {
  dateReceived: string;
  businessName: string;
  salesAssigned: string;
  documents: DocumentItem[];
};

const initialFormData: FormData = {
  dateReceived: "",
  businessName: "",
  salesAssigned: "",
  documents: [createEmptyDocument()],
};

export default function NonBIROrdersPage() {
  const [formData, setFormData] =
    useState<FormData>(initialFormData);

  const [saving, setSaving] = useState(false);
  const [savedTrackingNo, setSavedTrackingNo] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [copied, setCopied] = useState(false);

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    setFormData((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  function handleDocumentChange(
    id: string,
    field: keyof DocumentItem,
    value: string,
  ) {
    setFormData((current) => ({
      ...current,
      documents: current.documents.map((document) =>
        document.id === id
          ? {
              ...document,
              [field]: value,
            }
          : document,
      ),
    }));
  }

  function handleAddDocument() {
    setFormData((current) => ({
      ...current,
      documents: [
        ...current.documents,
        createEmptyDocument(),
      ],
    }));
  }

  function handleRemoveDocument(id: string) {
    setFormData((current) => ({
      ...current,
      documents:
        current.documents.length === 1
          ? current.documents
          : current.documents.filter(
              (document) => document.id !== id,
            ),
    }));
  }

  function joinDocuments(
    field: keyof DocumentItem,
    fallbackField?: keyof DocumentItem,
  ) {
    return formData.documents
      .map((document) => {
        if (
          fallbackField &&
          document[field] === "OTHER"
        ) {
          return document[fallbackField];
        }

        return document[field];
      })
      .filter(Boolean)
      .join(" / ");
  }

  function handleReset() {
    setFormData({
      dateReceived: "",
      businessName: "",
      salesAssigned: "",
      documents: [createEmptyDocument()],
    });

    setSavedTrackingNo("");
    setErrorMessage("");
    setCopied(false);
  }

  async function handleCopyTrackingNumber() {
    if (!savedTrackingNo) {
      return;
    }

    try {
      await navigator.clipboard.writeText(savedTrackingNo);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy tracking number:", error);
    }
  }

  function handleCloseSuccessModal() {
    setSavedTrackingNo("");
    setCopied(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    try {
      setSaving(true);
      setSavedTrackingNo("");
      setErrorMessage("");
      setCopied(false);

      const response = await fetch("/api/non-bir-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,

          // Existing API-compatible fields.
          description: joinDocuments(
            "description",
            "descriptionOther",
          ),
          booklets: joinDocuments("booklets"),
          serialNumbers: joinDocuments("serialNumbers"),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setErrorMessage(
          result.error || "Failed to save Non-BIR order.",
        );

        console.error(result);
        return;
      }

      setSavedTrackingNo(result.trackingNumber);

      setFormData({
        dateReceived: "",
        businessName: "",
        salesAssigned: "",
        documents: [createEmptyDocument()],
      });
    } catch (error) {
      console.error(error);

      setErrorMessage(
        "Something went wrong while saving the Non-BIR order. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell activePage="non-bir-orders" contentWidth="form">
      <PageHeader
        eyebrow="Orders / Printing"
        title="New Non-BIR Printing"
        description="Encode a new Non-BIR printing order and automatically create its production Trello card."
      />

      {errorMessage && (
        <section
          role="alert"
          className="mt-7 rounded-xl border border-red-200 bg-red-50 px-5 py-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-black text-red-800">
                Unable to save Non-BIR order
              </p>

              <p className="mt-1 text-sm leading-6 text-red-700">
                {errorMessage}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setErrorMessage("")}
              className="shrink-0 rounded-md px-2 py-1 text-sm font-black text-red-700 transition hover:bg-red-100"
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        </section>
      )}

      <form
        onSubmit={handleSubmit}
        className="mt-7 space-y-6"
      >
        <FormSection
          number="1"
          title="Client / Order Information"
          description="Enter the primary information for the Non-BIR printing order."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Input
              label="Date Received"
              name="dateReceived"
              type="date"
              value={formData.dateReceived}
              onChange={handleChange}
              disabled={saving}
              required
            />

            <Input
              label="Business / Trade Name"
              name="businessName"
              value={formData.businessName}
              onChange={handleChange}
              disabled={saving}
              required
            />

            <Input
              label="Sales Assigned"
              name="salesAssigned"
              value={formData.salesAssigned}
              onChange={handleChange}
              disabled={saving}
              required
            />
          </div>
        </FormSection>

        <FormSection
          number="2"
          title="Documents Included"
          description="Add one or more Non-BIR document orders under the same tracking number."
        >
          <div className="space-y-4">
            {formData.documents.map((document, index) => (
              <DocumentItemCard
                key={document.id}
                document={document}
                index={index}
                canRemove={formData.documents.length > 1}
                mode="non-bir"
                onChange={handleDocumentChange}
                onRemove={handleRemoveDocument}
              />
            ))}

            <DocumentActions
              documentCount={formData.documents.length}
              disabled={saving}
              onAdd={handleAddDocument}
            />
          </div>
        </FormSection>

        <FormActions
          description="Saving this form will add a Non-BIR record to Google Sheets and create a Trello card."
          saving={saving}
          onReset={handleReset}
        />
      </form>

      <footer className="mt-10 text-center text-xs text-[#7c6a56]">
        © 2026 LIC Printing Corporation. Production Management
        System.
      </footer>

      {savedTrackingNo && (
        <SuccessModal
          trackingNumber={savedTrackingNo}
          copied={copied}
          onCopy={handleCopyTrackingNumber}
          onClose={handleCloseSuccessModal}
        />
      )}
    </AppShell>
  );
}

function SuccessModal({
  trackingNumber,
  copied,
  onCopy,
  onClose,
}: {
  trackingNumber: string;
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
                Order Saved
              </p>

              <h2
                id="success-modal-title"
                className="mt-1 text-xl font-black text-white"
              >
                Non-BIR Order Successfully Saved
              </h2>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-7">
          <p className="text-sm leading-6 text-[#6f6254]">
            The Non-BIR printing order has been recorded in
            Google Sheets and added to the production workflow.
          </p>

          <div className="mt-6 rounded-xl border border-[#dfd1bd] bg-[#fbf7ef] p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#7c6a56]">
              Tracking Number
            </p>

            <p className="mt-2 break-all font-mono text-xl font-black tracking-wide text-black sm:text-2xl">
              {trackingNumber}
            </p>

            <button
              type="button"
              onClick={onCopy}
              className="mt-4 inline-flex h-10 items-center justify-center rounded-lg border border-[#bda98c] bg-white px-4 text-xs font-black text-black transition hover:border-black hover:bg-black hover:text-white"
            >
              {copied
                ? "Tracking Number Copied"
                : "Copy Tracking Number"}
            </button>
          </div>

          <div className="mt-6 rounded-lg border border-[#eadfce] bg-[#fffdf9] px-4 py-3">
            <p className="text-xs leading-5 text-[#766958]">
              Keep the tracking number for order monitoring and
              production reference.
            </p>
          </div>

          <div className="mt-7 flex justify-end">
            <button
              type="button"
              onClick={onClose}
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
            <h2 className="text-lg font-black text-black">
              {title}
            </h2>

            <p className="mt-1 text-sm leading-6 text-[#6f6254]">
              {description}
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-7">{children}</div>
    </section>
  );
}

function DocumentActions({
  documentCount,
  disabled,
  onAdd,
}: {
  documentCount: number;
  disabled: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-[#e3d8c7] bg-[#fbf7ef] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-black text-black">
          Documents Included
        </p>

        <p className="mt-1 text-sm text-[#6f6254]">
          {documentCount} document
          {documentCount === 1 ? "" : "s"} added
        </p>
      </div>

      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        className="inline-flex h-11 items-center justify-center rounded-lg border border-black bg-white px-5 text-sm font-black text-black transition hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        + Add Another Document
      </button>
    </div>
  );
}

function FormActions({
  description,
  saving,
  onReset,
}: {
  description: string;
  saving: boolean;
  onReset: () => void;
}) {
  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-[#e3d8c7] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="max-w-2xl text-xs leading-5 text-[#7c6a56]">
        {description}
      </p>

      <div className="flex shrink-0 flex-col-reverse gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onReset}
          disabled={saving}
          className="inline-flex h-12 items-center justify-center rounded-lg border border-[#cfc1ae] bg-white px-6 text-sm font-black text-black transition hover:bg-[#f8f2e8] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear Form
        </button>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-12 min-w-52 items-center justify-center rounded-lg bg-black px-7 text-sm font-black text-white transition hover:bg-[#6b421f] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving
            ? "Saving..."
            : "Save Non-BIR Order"}
        </button>
      </div>
    </section>
  );
}

function Input({
  label,
  name,
  value,
  type = "text",
  placeholder = "",
  required = false,
  disabled = false,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-black">
        {label}

        {required && (
          <span className="ml-1 text-red-600">*</span>
        )}
      </span>

      <input
        type={type}
        name={name}
        value={value}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        onChange={onChange}
        className={inputClassName}
      />
    </label>
  );
}

const inputClassName =
  "h-12 w-full rounded-lg border border-[#d8cbb9] bg-white px-4 text-sm text-black outline-none transition placeholder:text-[#9a8d7d] focus:border-[#8b5e34] focus:ring-2 focus:ring-[#8b5e34]/10 disabled:cursor-not-allowed disabled:bg-[#f4f1ec] disabled:text-[#7c7165]";