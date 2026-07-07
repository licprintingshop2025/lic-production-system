"use client";

import { useState } from "react";
import AppShell from "../components/AppShell";
import PageHeader from "../components/PageHeader";
import DocumentItemCard, {
  createEmptyDocument,
} from "@/app/components/forms/DocumentItemCard";

import type { DocumentItem } from "@/lib/orders/types";

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
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [savedTrackingNo, setSavedTrackingNo] = useState("");

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  }

  function handleDocumentChange(
    id: string,
    field: keyof DocumentItem,
    value: string
  ) {
    setFormData((current) => ({
      ...current,
      documents: current.documents.map((doc) =>
        doc.id === id ? { ...doc, [field]: value } : doc
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
    fallbackField?: keyof DocumentItem
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

      const response = await fetch("/api/non-bir-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,

          // old API-compatible fields
          description: joinDocuments("description", "descriptionOther"),
          booklets: joinDocuments("booklets"),
          serialNumbers: joinDocuments("serialNumbers"),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error || "Failed to save Non-BIR order.");
        console.error(result);
        return;
      }

      setSavedTrackingNo(result.trackingNumber);
      alert(`Non-BIR Order Saved!\n\nTracking No: ${result.trackingNumber}`);

      setFormData(initialFormData);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell activePage="non-bir-orders">
      <div className="mx-auto max-w-[1200px]">
        <PageHeader
          title="Non-BIR Orders"
          description="Encode Non-BIR orders using LIC's current production record format and automatically create a Trello card."
        />

        {savedTrackingNo && (
          <section className="mt-7 rounded-xl border border-green-200 bg-green-50 p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-green-700">
              Record Saved
            </p>
            <h2 className="mt-2 text-2xl font-black text-black">
              Tracking Number Generated
            </h2>
            <p className="mt-3 rounded-lg border border-green-200 bg-white p-4 font-mono text-lg font-bold text-green-700">
              {savedTrackingNo}
            </p>
          </section>
        )}

        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          <section className="rounded-xl border border-[#e6ddd1] bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-black">
              Client / Order Information
            </h2>

            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
              <Input
                label="Date Received"
                name="dateReceived"
                type="date"
                value={formData.dateReceived}
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
                label="Sales Assigned"
                name="salesAssigned"
                value={formData.salesAssigned}
                onChange={handleChange}
                required
              />
            </div>
          </section>

          <section className="rounded-xl border border-[#e6ddd1] bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-black">Documents Included</h2>
            <p className="mt-1 text-sm text-[#6f6254]">
              Add one or more Non-BIR document orders under the same tracking number.
            </p>

            <div className="mt-6 space-y-5">
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

              <button
                type="button"
                onClick={handleAddDocument}
                className="rounded-xl border border-[#d6b46a] bg-white px-5 py-3 text-sm font-black text-[#8b5e24] hover:bg-[#fff7e6]"
              >
                + Add Another Document
              </button>
            </div>
          </section>

          <div className="sticky bottom-0 z-20 -mx-6 border-t border-[#e6ddd1] bg-[#fffaf2]/95 px-6 py-5 backdrop-blur lg:-mx-8 lg:px-8">
            <div className="mx-auto flex max-w-[1200px] flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-xs text-[#6f6254]">
                Saving this form will add a Non-BIR record to Google Sheets and
                create a Trello card.
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-lg border border-[#e6ddd1] bg-white px-6 py-3 text-sm font-bold text-black hover:bg-[#fbf7ef]"
                >
                  Clear Form
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[#e1bb5f] px-8 py-3 text-sm font-black text-black hover:bg-[#edca73] disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Non-BIR Order"}
                </button>
              </div>
            </div>
          </div>
        </form>

        <footer className="mt-8 text-center text-xs text-[#7c6a56]">
          © 2026 LIC Printing Shop. Production Management System.
        </footer>
      </div>
    </AppShell>
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
      <label className="mb-2 block text-sm font-bold text-black">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <input
        type={type}
        name={name}
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={onChange}
        className="w-full rounded-lg border border-[#e6ddd1] bg-white p-3 text-black outline-none transition placeholder:text-[#a99b8c] focus:border-[#c89132]"
      />
    </div>
  );
}