"use client";

import { useState } from "react";
import AppShell from "../components/AppShell";
import PageHeader from "../components/PageHeader";
import DocumentItemCard, {
  createEmptyDocument,
} from "@/app/components/forms/DocumentItemCard";

import type { DocumentItem } from "@/lib/orders/types";

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
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [savedTrackingNo, setSavedTrackingNo] = useState("");

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  }

  function handleDocumentChange(
    id: string,
    field: keyof DocumentItem,
    value: string,
  ) {
    setFormData((current) => ({
      ...current,
      documents: current.documents.map((doc) =>
        doc.id === id ? { ...doc, [field]: value } : doc,
      ),
    }));
  }

  function handleAddDocument() {
    setFormData((current) => ({
      ...current,
      documents: [...current.documents, createEmptyDocument()],
    }));
  }

  function handleRemoveDocument(id: string) {
    setFormData((current) => ({
      ...current,
      documents:
        current.documents.length === 1
          ? current.documents
          : current.documents.filter((doc) => doc.id !== id),
    }));
  }

  function joinDocuments(
    field: keyof DocumentItem,
    fallbackField?: keyof DocumentItem,
  ) {
    return formData.documents
      .map((doc) => {
        if (fallbackField && doc[field] === "OTHER") {
          return doc[fallbackField];
        }

        return doc[field];
      })
      .filter(Boolean)
      .join(" / ");
  }

  function handleReset() {
    setFormData(initialFormData);
    setSavedTrackingNo("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

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
      alert(`ATP Record Saved!\n\nTracking No: ${result.trackingNo}`);

      setFormData(initialFormData);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell activePage="received-atp" contentWidth="form">
      <PageHeader
        title="Received ATP Intake"
        description="Encode received ATP records and automatically create a Trello job card using LIC's production workflow format."
      />

      {savedTrackingNo && (
        <section className="mt-8 rounded-2xl border border-green-200 bg-green-50 p-6 shadow-[0_2px_10px_rgba(70,45,20,0.08)]">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-green-700">
            Record Saved
          </p>
          <h2 className="mt-2 text-2xl font-black text-black">
            Tracking Number Generated
          </h2>
          <p className="mt-3 rounded-xl border border-green-200 bg-white p-4 font-mono text-lg font-bold text-green-700">
            {savedTrackingNo}
          </p>
        </section>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <FormSection
          number="01"
          title="Taxpayer Information"
          description="Basic taxpayer and registered business details."
        >
          <Input
            label="Date of ATP"
            name="dateOfAtp"
            type="date"
            value={formData.dateOfAtp}
            onChange={handleChange}
            required
          />

          <Input
            label="OCN"
            name="ocn"
            value={formData.ocn}
            onChange={handleChange}
            required
          />

          <Input
            label="TIN"
            name="tin"
            value={formData.tin}
            onChange={handleChange}
            required
          />

          <Input
            label="Taxpayer Name"
            name="taxpayerName"
            value={formData.taxpayerName}
            onChange={handleChange}
            required
          />

          <Input
            label="Business / Trade Name"
            name="businessName"
            value={formData.businessName}
            onChange={handleChange}
            required
          />

          <Input
            label="RDO Code"
            name="rdoCode"
            value={formData.rdoCode}
            onChange={handleChange}
            required
          />

          <div className="md:col-span-2">
            <Textarea
              label="Registered Address"
              name="registeredAddress"
              value={formData.registeredAddress}
              onChange={handleChange}
              required
            />
          </div>
        </FormSection>

        <FormSection
          number="02"
          title="Documents Included"
          description="Add one or more invoice or receipt documents under the same ATP order."
        >
          <Select
            label="Tax Type"
            name="taxType"
            value={formData.taxType}
            onChange={handleChange}
            required
            options={["VAT", "NON-VAT"]}
          />

          <div className="md:col-span-2 space-y-5">
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

            <button
              type="button"
              onClick={handleAddDocument}
              className="rounded-xl border border-[#d6b46a] bg-white px-5 py-3 text-sm font-black text-[#8b5e24] hover:bg-[#fff7e6]"
            >
              + Add Another Document
            </button>
          </div>
        </FormSection>

        <FormSection
          number="03"
          title="ATP Received & Staff Assignment"
          description="Record ATP source and assigned sales/staff name."
        >
          <Select
            label="ATP Received"
            name="atpReceived"
            value={formData.atpReceived}
            onChange={handleChange}
            required
            options={["ORIGINAL", "PHOTOCOPY", "ORUS ATP"]}
          />

          <Select
            label="Sales Assigned"
            name="salesAssigned"
            value={formData.salesAssigned}
            onChange={handleChange}
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
              required
            />
          )}
        </FormSection>

        <div className="mt-8 border-t border-[#e3d8c7] bg-[#fffaf2] px-6 py-5 lg:px-8">
          <div className="mx-auto flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[#7c6a56]">
              Saving this form will create a Trello ATP intake card. Production
              details will be completed in the next workflow step.
            </p>

            <div className="flex shrink-0 justify-end gap-3">
              <button
                type="button"
                onClick={handleReset}
                disabled={saving}
                className="rounded-xl border border-[#dfd4c4] bg-white px-6 py-3 text-sm font-bold text-[#3f352a] transition hover:bg-[#fbf7ef] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Clear Form
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[#e1bb5f] px-8 py-3 text-sm font-black text-black transition hover:bg-[#edca73] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save ATP Record"}
              </button>
            </div>
          </div>
        </div>
      </form>

      <footer className="mt-10 text-center text-xs text-[#7c6a56]">
        © 2026 LIC Printing Shop. Production Management System.
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
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#e3d8c7] bg-white p-6 shadow-[0_2px_10px_rgba(70,45,20,0.08)]">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f8ead3] text-sm font-black text-[#8b5e24]">
          {number}
        </div>

        <div>
          <h2 className="text-xl font-black text-black">{title}</h2>
          <p className="mt-1 text-sm text-[#6f6254]">{description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">{children}</div>
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
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-[#3f352a]">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <input
        type={type}
        name={name}
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={onChange}
        className="w-full rounded-xl border border-[#dfd4c4] bg-white p-3 text-black outline-none transition placeholder:text-[#a99b8c] focus:border-[#c89132] focus:ring-2 focus:ring-[#f4dfb9]"
      />
    </div>
  );
}

function Textarea({
  label,
  name,
  value,
  required = false,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  required?: boolean;
  onChange: React.ChangeEventHandler<HTMLTextAreaElement>;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-[#3f352a]">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <textarea
        name={name}
        value={value}
        required={required}
        onChange={onChange}
        rows={3}
        className="w-full rounded-xl border border-[#dfd4c4] bg-white p-3 text-black outline-none transition placeholder:text-[#a99b8c] focus:border-[#c89132] focus:ring-2 focus:ring-[#f4dfb9]"
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
  options: string[];
  required?: boolean;
  onChange: React.ChangeEventHandler<HTMLSelectElement>;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-[#3f352a]">
        {label} {required && <span className="text-red-500">*</span>}
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
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
