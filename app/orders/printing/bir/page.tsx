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
  dateOfAtp: string;
  ocn: string;
  tin: string;
  taxpayerName: string;
  businessName: string;
  registeredAddress: string;
  rdoCode: string;
  taxType: string;
  documents: DocumentItem[];
  atpReceived: string;
  salesAssigned: string;
  salesAssignedOther: string;
};

const initialFormData: FormData = {
  dateOfAtp: "",
  ocn: "",
  tin: "",
  taxpayerName: "",
  businessName: "",
  registeredAddress: "",
  rdoCode: "",
  taxType: "",
  documents: [createEmptyDocument()],
  atpReceived: "",
  salesAssigned: "",
  salesAssignedOther: "",
};

export default function ReceivedATPPage() {
  const [formData, setFormData] =
    useState<FormData>(initialFormData);

  const [saving, setSaving] = useState(false);
  const [savedTrackingNo, setSavedTrackingNo] = useState("");

  function handleChange(
    event: ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
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

  function handleReset() {
    setFormData(initialFormData);
    setSavedTrackingNo("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    try {
      setSaving(true);
      setSavedTrackingNo("");

      const response = await fetch("/api/received-atp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error || "Failed to save ATP record.");
        console.error(result);
        return;
      }

      setSavedTrackingNo(result.trackingNo);

      alert(
        `ATP Record Saved!\n\nTracking No: ${result.trackingNo}`,
      );

      setFormData(initialFormData);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell activePage="received-atp" contentWidth="form">
      <PageHeader
        eyebrow="Orders / Printing"
        title="Received ATP Intake"
        description="Encode received ATP records and automatically create a Trello job card using LIC's production workflow format."
      />

      {savedTrackingNo && (
        <section
          role="status"
          className="mt-7 rounded-xl border border-green-200 bg-green-50 px-5 py-4 shadow-sm"
        >
          <p className="text-sm font-black text-green-800">
            ATP record saved successfully.
          </p>

          <p className="mt-2 text-sm text-green-700">
            Tracking Number:
            <span className="ml-2 font-mono font-black">
              {savedTrackingNo}
            </span>
          </p>
        </section>
      )}

      <form
        onSubmit={handleSubmit}
        className="mt-7 space-y-6"
      >
        <FormSection
          number="1"
          title="Taxpayer Information"
          description="Basic taxpayer and registered business details."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Input
              label="Date of ATP"
              name="dateOfAtp"
              type="date"
              value={formData.dateOfAtp}
              onChange={handleChange}
              disabled={saving}
              required
            />

            <Input
              label="OCN"
              name="ocn"
              value={formData.ocn}
              onChange={handleChange}
              disabled={saving}
              required
            />

            <Input
              label="TIN"
              name="tin"
              value={formData.tin}
              onChange={handleChange}
              disabled={saving}
              required
            />

            <Input
              label="Taxpayer Name"
              name="taxpayerName"
              value={formData.taxpayerName}
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
              label="RDO Code"
              name="rdoCode"
              value={formData.rdoCode}
              onChange={handleChange}
              disabled={saving}
              required
            />

            <div className="md:col-span-2">
              <Textarea
                label="Registered Address"
                name="registeredAddress"
                value={formData.registeredAddress}
                onChange={handleChange}
                disabled={saving}
                required
              />
            </div>
          </div>
        </FormSection>

        <FormSection
          number="2"
          title="Documents Included"
          description="Add one or more invoice or receipt documents under the same ATP order."
        >
          <div className="space-y-5">
            <div className="max-w-xl">
              <Select
                label="Tax Type"
                name="taxType"
                value={formData.taxType}
                onChange={handleChange}
                disabled={saving}
                required
                options={["VAT", "NON-VAT"]}
              />
            </div>

            <div className="space-y-4">
              {formData.documents.map((document, index) => (
                <DocumentItemCard
                  key={document.id}
                  document={document}
                  index={index}
                  canRemove={formData.documents.length > 1}
                  mode="received-atp"
                  onChange={handleDocumentChange}
                  onRemove={handleRemoveDocument}
                />
              ))}
            </div>

            <DocumentActions
              documentCount={formData.documents.length}
              disabled={saving}
              onAdd={handleAddDocument}
            />
          </div>
        </FormSection>

        <FormSection
          number="3"
          title="ATP Received & Staff Assignment"
          description="Record the ATP source and assigned sales or staff member."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Select
              label="ATP Received"
              name="atpReceived"
              value={formData.atpReceived}
              onChange={handleChange}
              disabled={saving}
              required
              options={["ORIGINAL", "PHOTOCOPY", "ORUS ATP"]}
            />

            <Select
              label="Sales Assigned"
              name="salesAssigned"
              value={formData.salesAssigned}
              onChange={handleChange}
              disabled={saving}
              required
              options={[
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
                "OTHERS",
              ]}
            />

            {formData.salesAssigned === "OTHERS" && (
              <Input
                label="Specify Sales Assigned"
                name="salesAssignedOther"
                value={formData.salesAssignedOther}
                onChange={handleChange}
                disabled={saving}
                required
              />
            )}
          </div>
        </FormSection>

        <FormActions
          description="Saving this form will create a Trello ATP intake card. Production details will be completed in the next workflow step."
          saving={saving}
          submitLabel="Save ATP Record"
          onReset={handleReset}
        />
      </form>

      <footer className="mt-10 text-center text-xs text-[#7c6a56]">
        © 2026 LIC Printing Corporation. Production Management
        System.
      </footer>
    </AppShell>
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
  submitLabel,
  onReset,
}: {
  description: string;
  saving: boolean;
  submitLabel: string;
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
          className="inline-flex h-12 min-w-48 items-center justify-center rounded-lg bg-black px-7 text-sm font-black text-white transition hover:bg-[#6b421f] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : submitLabel}
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
    <FormField label={label} required={required}>
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
    </FormField>
  );
}

function Textarea({
  label,
  name,
  value,
  required = false,
  disabled = false,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  required?: boolean;
  disabled?: boolean;
  onChange: React.ChangeEventHandler<HTMLTextAreaElement>;
}) {
  return (
    <FormField label={label} required={required}>
      <textarea
        name={name}
        value={value}
        required={required}
        disabled={disabled}
        onChange={onChange}
        rows={3}
        className={`${inputClassName} h-auto min-h-24 py-3`}
      />
    </FormField>
  );
}

function Select({
  label,
  name,
  value,
  options,
  required = false,
  disabled = false,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  options: string[];
  required?: boolean;
  disabled?: boolean;
  onChange: React.ChangeEventHandler<HTMLSelectElement>;
}) {
  return (
    <FormField label={label} required={required}>
      <select
        name={name}
        value={value}
        required={required}
        disabled={disabled}
        onChange={onChange}
        className={inputClassName}
      >
        <option value="">Select</option>

        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </FormField>
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
          <span className="ml-1 text-red-600">*</span>
        )}
      </span>

      {children}
    </label>
  );
}

const inputClassName =
  "h-12 w-full rounded-lg border border-[#d8cbb9] bg-white px-4 text-sm text-black outline-none transition placeholder:text-[#9a8d7d] focus:border-[#8b5e34] focus:ring-2 focus:ring-[#8b5e34]/10 disabled:cursor-not-allowed disabled:bg-[#f4f1ec] disabled:text-[#7c7165]";