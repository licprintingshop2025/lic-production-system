"use client";

import AppShell from "@/app/components/AppShell";
import PageHeader from "@/app/components/PageHeader";
import DocumentItemCard, {
  createEmptyDocument,
} from "@/app/components/forms/DocumentItemCard";
import type {
  DocumentItem,
  NonBIROrder,
  ReceivedATPOrder,
} from "@/lib/orders/types";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useState,
} from "react";

const ATP_RECEIVED_OPTIONS = [
  "ORIG ATP - LIC Stamping",
  "ORIG ATP - Client Stamping",
  "PC ATP - LIC Stamping",
  "PC ATP - Client Stamping",
  "ORUS ATP - LIC Stamping",
  "ORUS ATP - Client Stamping",
];

const SALES_OPTIONS = [
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
];

const inputClassName =
  "h-12 w-full rounded-lg border border-[#d8cbb9] bg-white px-4 text-sm text-black outline-none transition placeholder:text-[#9a8d7d] focus:border-[#8b5e34] focus:ring-2 focus:ring-[#8b5e34]/10 disabled:cursor-not-allowed disabled:bg-[#f4f1ec] disabled:text-[#7c7165]";

type Props = {
  kind: "BIR" | "NON-BIR";
};

type BirFormData = Omit<ReceivedATPOrder, "trackingNo" | "submittedAt" | "branchNo">;
type NonBirFormData = Omit<NonBIROrder, "trackingNumber">;

type ApiResponse = {
  success?: boolean;
  order?: ReceivedATPOrder | NonBIROrder;
  error?: string;
  details?: string;
};

function ensureDocuments(documents: DocumentItem[] | undefined) {
  return Array.isArray(documents) && documents.length > 0
    ? documents
    : [createEmptyDocument()];
}

export default function PrintingOrderEditForm({ kind }: Props) {
  const router = useRouter();
  const params = useParams();
  const trackingNumber =
    typeof params.trackingNumber === "string"
      ? params.trackingNumber
      : Array.isArray(params.trackingNumber)
        ? params.trackingNumber[0]
        : "";

  const isBir = kind === "BIR";
  const endpoint = isBir ? "/api/received-atp" : "/api/non-bir-orders";
  const backHref = isBir ? "/orders/printing/bir" : "/orders/printing/non-bir";

  const [birForm, setBirForm] = useState<BirFormData>({
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
    atpStatus: "",
    salesAssigned: "",
    salesAssignedOther: "",
  });

  const [nonBirForm, setNonBirForm] = useState<NonBirFormData>({
    dateReceived: "",
    businessName: "",
    salesAssigned: "",
    documents: [createEmptyDocument()],
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!trackingNumber) {
      setError("Missing tracking number.");
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadOrder() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `${endpoint}/${encodeURIComponent(trackingNumber)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const result = (await response.json()) as ApiResponse;

        if (!response.ok || !result.order) {
          throw new Error(result.error || result.details || "Failed to load order.");
        }

        if (isBir) {
          const order = result.order as ReceivedATPOrder;
          setBirForm({
            dateOfAtp: order.dateOfAtp || "",
            ocn: order.ocn || "",
            tin: order.tin || "",
            taxpayerName: order.taxpayerName || "",
            businessName: order.businessName || "",
            registeredAddress: order.registeredAddress || "",
            rdoCode: order.rdoCode || "",
            taxType: order.taxType || "",
            documents: ensureDocuments(order.documents),
            atpReceived: order.atpReceived || order.atpStatus || "",
            atpStatus: order.atpStatus || order.atpReceived || "",
            salesAssigned: order.salesAssigned || "",
            salesAssignedOther: order.salesAssignedOther || "",
          });
        } else {
          const order = result.order as NonBIROrder;
          setNonBirForm({
            dateReceived: order.dateReceived || "",
            businessName: order.businessName || "",
            salesAssigned: order.salesAssigned || "",
            documents: ensureDocuments(order.documents),
          });
        }
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load order.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadOrder();
    return () => controller.abort();
  }, [endpoint, isBir, trackingNumber]);

  function handleBirChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;
    setBirForm((current) => ({
      ...current,
      [name]: value,
      ...(name === "atpReceived" ? { atpStatus: value } : {}),
    }));
  }

  function handleNonBirChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setNonBirForm((current) => ({ ...current, [name]: value }));
  }

  function updateDocument(id: string, field: keyof DocumentItem, value: string) {
    if (isBir) {
      setBirForm((current) => ({
        ...current,
        documents: current.documents.map((document) =>
          document.id === id ? { ...document, [field]: value } : document,
        ),
      }));
    } else {
      setNonBirForm((current) => ({
        ...current,
        documents: current.documents.map((document) =>
          document.id === id ? { ...document, [field]: value } : document,
        ),
      }));
    }
  }

  function addDocument() {
    if (isBir) {
      setBirForm((current) => ({
        ...current,
        documents: [...current.documents, createEmptyDocument()],
      }));
    } else {
      setNonBirForm((current) => ({
        ...current,
        documents: [...current.documents, createEmptyDocument()],
      }));
    }
  }

  function removeDocument(id: string) {
    if (isBir) {
      setBirForm((current) => ({
        ...current,
        documents:
          current.documents.length === 1
            ? current.documents
            : current.documents.filter((document) => document.id !== id),
      }));
    } else {
      setNonBirForm((current) => ({
        ...current,
        documents:
          current.documents.length === 1
            ? current.documents
            : current.documents.filter((document) => document.id !== id),
      }));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await fetch(
        `${endpoint}/${encodeURIComponent(trackingNumber)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(isBir ? birForm : nonBirForm),
        },
      );
      const result = (await response.json()) as ApiResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.error || result.details || "Failed to update order.");
      }

      setSuccess("Order details saved. Google Sheets and the Trello card were updated without changing the production workflow.");
      window.setTimeout(() => router.push(backHref), 900);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update order.");
    } finally {
      setSaving(false);
    }
  }

  const documents = isBir ? birForm.documents : nonBirForm.documents;

  return (
    <AppShell activePage="orders" contentWidth="form">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          eyebrow="Orders / Printing"
          title={`Edit ${isBir ? "BIR" : "Non-BIR"} Printing`}
          description={`Update order details for ${trackingNumber}. Saving updates the same Google Sheet row and Trello card.`}
        />
        <Link
          href={backHref}
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg border border-[#d5c6b2] bg-white px-5 text-sm font-black text-black transition hover:bg-[#f8f2e8]"
        >
          Back to Dashboard
        </Link>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {success && <Alert tone="success">{success}</Alert>}

      {loading ? (
        <div className="mt-7 rounded-2xl border border-[#e3d8c7] bg-white px-6 py-16 text-center text-sm font-bold text-[#6f6254]">
          Loading order details...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-7 space-y-6">
          {isBir ? (
            <>
              <FormSection title="Taxpayer Information">
                <div className="grid gap-5 md:grid-cols-2">
                  <Input label="Date of ATP" name="dateOfAtp" type="date" value={birForm.dateOfAtp} onChange={handleBirChange} disabled={saving} required />
                  <Input label="OCN" name="ocn" value={birForm.ocn} onChange={handleBirChange} disabled={saving} required />
                  <Input label="TIN" name="tin" value={birForm.tin} onChange={handleBirChange} disabled={saving} required />
                  <Input label="Taxpayer Name" name="taxpayerName" value={birForm.taxpayerName} onChange={handleBirChange} disabled={saving} required />
                  <Input label="Business / Trade Name" name="businessName" value={birForm.businessName} onChange={handleBirChange} disabled={saving} required />
                  <Input label="RDO Code" name="rdoCode" value={birForm.rdoCode} onChange={handleBirChange} disabled={saving} required />
                  <div className="md:col-span-2">
                    <Textarea label="Registered Address" name="registeredAddress" value={birForm.registeredAddress} onChange={handleBirChange} disabled={saving} required />
                  </div>
                </div>
              </FormSection>

              <FormSection title="Documents Included">
                <div className="mb-5 max-w-xl">
                  <Select label="Tax Type" name="taxType" value={birForm.taxType} options={["VAT", "NON-VAT"]} onChange={handleBirChange} disabled={saving} required />
                </div>
                <Documents documents={documents} mode="received-atp" saving={saving} onChange={updateDocument} onRemove={removeDocument} onAdd={addDocument} />
              </FormSection>

              <FormSection title="ATP Received & Staff Assignment">
                <div className="grid gap-5 md:grid-cols-2">
                  <Select label="ATP Received" name="atpReceived" value={birForm.atpReceived} options={ATP_RECEIVED_OPTIONS} onChange={handleBirChange} disabled={saving} required />
                  <Select label="Sales Assigned" name="salesAssigned" value={birForm.salesAssigned} options={SALES_OPTIONS} onChange={handleBirChange} disabled={saving} required />
                  {birForm.salesAssigned === "OTHERS" && (
                    <Input label="Specify Sales Assigned" name="salesAssignedOther" value={birForm.salesAssignedOther || ""} onChange={handleBirChange} disabled={saving} required />
                  )}
                </div>
              </FormSection>
            </>
          ) : (
            <>
              <FormSection title="Client / Order Information">
                <div className="grid gap-5 md:grid-cols-2">
                  <Input label="Date Received" name="dateReceived" type="date" value={nonBirForm.dateReceived} onChange={handleNonBirChange} disabled={saving} required />
                  <Input label="Business / Trade Name" name="businessName" value={nonBirForm.businessName} onChange={handleNonBirChange} disabled={saving} required />
                  <Input label="Sales Assigned" name="salesAssigned" value={nonBirForm.salesAssigned} onChange={handleNonBirChange} disabled={saving} required />
                </div>
              </FormSection>

              <FormSection title="Documents Included">
                <Documents documents={documents} mode="non-bir" saving={saving} onChange={updateDocument} onRemove={removeDocument} onAdd={addDocument} />
              </FormSection>
            </>
          )}

          <section className="flex flex-col gap-4 rounded-2xl border border-[#e3d8c7] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl text-xs leading-5 text-[#7c6a56]">
              This changes customer/order information only. Current station, labels, checklists, due dates, and production status are preserved.
            </p>
            <button type="submit" disabled={saving} className="inline-flex h-12 min-w-44 items-center justify-center rounded-lg bg-black px-7 text-sm font-black text-white transition hover:bg-[#6b421f] disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </section>
        </form>
      )}
    </AppShell>
  );
}

function Documents({
  documents,
  mode,
  saving,
  onChange,
  onRemove,
  onAdd,
}: {
  documents: DocumentItem[];
  mode: "received-atp" | "non-bir";
  saving: boolean;
  onChange: (id: string, field: keyof DocumentItem, value: string) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="space-y-4">
      {documents.map((document, index) => (
        <DocumentItemCard
          key={document.id}
          document={document}
          index={index}
          canRemove={documents.length > 1}
          mode={mode}
          onChange={onChange}
          onRemove={onRemove}
        />
      ))}
      <div className="flex items-center justify-between rounded-xl border border-[#e3d8c7] bg-[#fbf7ef] p-4">
        <p className="text-sm font-bold text-[#6f6254]">{documents.length} document{documents.length === 1 ? "" : "s"}</p>
        <button type="button" disabled={saving} onClick={onAdd} className="inline-flex h-10 items-center justify-center rounded-lg border border-black bg-white px-4 text-xs font-black text-black transition hover:bg-black hover:text-white disabled:opacity-50">
          + Add Document
        </button>
      </div>
    </div>
  );
}

function Alert({ children, tone }: { children: ReactNode; tone: "error" | "success" }) {
  return (
    <div className={`mt-7 rounded-xl border px-5 py-4 text-sm font-bold ${tone === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-800"}`}>
      {children}
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-visible rounded-2xl border border-[#e3d8c7] bg-white shadow-sm">
      <div className="rounded-t-2xl border-b border-[#eee5d8] bg-[#fbf7ef] px-5 py-4 sm:px-7">
        <h2 className="text-lg font-black text-black">{title}</h2>
      </div>
      <div className="p-5 sm:p-7">{children}</div>
    </section>
  );
}

function Input({ label, name, value, type = "text", required = false, disabled = false, onChange }: {
  label: string; name: string; value: string; type?: string; required?: boolean; disabled?: boolean; onChange: React.ChangeEventHandler<HTMLInputElement>;
}) {
  return <FormField label={label} required={required}><input type={type} name={name} value={value} required={required} disabled={disabled} onChange={onChange} className={inputClassName} /></FormField>;
}

function Textarea({ label, name, value, required = false, disabled = false, onChange }: {
  label: string; name: string; value: string; required?: boolean; disabled?: boolean; onChange: React.ChangeEventHandler<HTMLTextAreaElement>;
}) {
  return <FormField label={label} required={required}><textarea name={name} value={value} required={required} disabled={disabled} onChange={onChange} rows={3} className={`${inputClassName} h-auto min-h-24 py-3`} /></FormField>;
}

function Select({ label, name, value, options, required = false, disabled = false, onChange }: {
  label: string; name: string; value: string; options: string[]; required?: boolean; disabled?: boolean; onChange: React.ChangeEventHandler<HTMLSelectElement>;
}) {
  return <FormField label={label} required={required}><select name={name} value={value} required={required} disabled={disabled} onChange={onChange} className={inputClassName}><option value="">Select</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></FormField>;
}

function FormField({ label, required = false, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-black text-black">{label}{required && <span className="ml-1 text-red-600">*</span>}</span>{children}</label>;
}
