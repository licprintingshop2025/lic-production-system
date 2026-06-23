"use client";

import { useState } from "react";

export default function ReceivedATPPage() {
  const [formData, setFormData] = useState({
    dateOfAtp: "",
    ocn: "",
    tin: "",
    taxpayerName: "",
    businessName: "",
    registeredAddress: "",
    rdoCode: "",
    mannerDocType: "",
    receiptType: "",
    receiptTypeOther: "",
    taxType: "",
    noOfBooklets: "",
    setsPerBooklet: "50",
    copiesPerSet: "",
    copiesPerSetOther: "",
    serialNumbers: "",
    atpReceived: "",
    salesAssigned: "",
    salesAssignedOther: "",
  });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();

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

  alert(`ATP Record Saved!\n\nTracking No: ${result.trackingNo}`);

  console.log("Created Trello Card:", result.card);
}

  return (
    <main className="min-h-screen bg-[#070A0F] p-6 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 border-b border-zinc-800 pb-6">
          <h1 className="text-4xl font-bold text-yellow-400">Received ATP</h1>
          <p className="mt-2 text-sm text-zinc-400">
            PSMA-DSS Intake Module based on LIC Received ATP Form
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-8">
          <Section title="1. Taxpayer Information">
            <Input label="Date of ATP" name="dateOfAtp" type="date" onChange={handleChange} required />
            <Input label="OCN" name="ocn" onChange={handleChange} required />
            <Input label="TIN" name="tin" onChange={handleChange} required />
            <Input label="Taxpayer Name" name="taxpayerName" onChange={handleChange} required />
            <Input label="Business / Trade Name" name="businessName" onChange={handleChange} required />
            <Input label="RDO Code" name="rdoCode" onChange={handleChange} required />

            <div className="md:col-span-2">
              <Textarea label="Registered Address" name="registeredAddress" onChange={handleChange} required />
            </div>
          </Section>

          <Section title="2. Document Information">
            <Select
              label="Manner / Doc Type"
              name="mannerDocType"
              onChange={handleChange}
              required
              options={["BOUND", "LOOSE"]}
            />

            <Select
              label="Description / Kind of Invoice or Receipt"
              name="receiptType"
              onChange={handleChange}
              required
              options={[
                "SALES INVOICE",
                "SERVICE INVOICE",
                "BILLING INVOICE",
                "VAT INVOICE",
                "NON-VAT INVOICE",
                "INVOICE",
                "OFFICIAL RECEIPT",
                "COLLECTION RECEIPT",
                "DELIVERY RECEIPT",
                "ACKNOWLEDGEMENT RECEIPT",
                "OTHER",
              ]}
            />

            {formData.receiptType === "OTHER" && (
              <Input label="Specify Other Receipt Type" name="receiptTypeOther" onChange={handleChange} required />
            )}

            <Select
              label="Tax Type"
              name="taxType"
              onChange={handleChange}
              required
              options={["VAT", "NON-VAT"]}
            />
          </Section>

          <Section title="3. Booklet & Serial Information">
            <Input label="No. of Booklets" name="noOfBooklets" type="number" onChange={handleChange} required />

            <Select
              label="No. of Sets Per Booklet"
              name="setsPerBooklet"
              onChange={handleChange}
              required
              options={["50"]}
            />

            <Select
              label="No. of Copies Per Set"
              name="copiesPerSet"
              onChange={handleChange}
              required
              options={["2", "3", "4", "5", "6", "7", "OTHER"]}
            />

            {formData.copiesPerSet === "OTHER" && (
              <Input label="Specify Copies Per Set" name="copiesPerSetOther" type="number" onChange={handleChange} required />
            )}

            <Input
              label="Serial Numbers (From-To)"
              name="serialNumbers"
              placeholder="Example: 000001-000500"
              onChange={handleChange}
              required
            />
          </Section>

          <Section title="4. ATP Received & Sales Assigned">
            <Select
              label="ATP Received"
              name="atpReceived"
              onChange={handleChange}
              required
              options={["ORIGINAL", "PHOTOCOPY"]}
            />

            <Select
              label="Sales Assigned"
              name="salesAssigned"
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
              <Input label="Specify Sales Assigned" name="salesAssignedOther" onChange={handleChange} required />
            )}
          </Section>

          <div className="flex gap-4">
            <button
              type="submit"
              className="rounded-xl bg-yellow-400 px-8 py-3 font-bold text-black hover:bg-yellow-300"
            >
              Save ATP Record
            </button>

            <button
              type="reset"
              className="rounded-xl border border-zinc-700 px-8 py-3 font-bold text-zinc-300 hover:bg-zinc-900"
            >
              Clear Form
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-[#0D1118] p-6">
      <h2 className="mb-5 text-xl font-bold text-yellow-400">{title}</h2>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Input({
  label,
  name,
  type = "text",
  placeholder = "",
  required = false,
  onChange,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm text-zinc-400">
        {label} {required && <span className="text-red-400">*</span>}
      </label>

      <input
        type={type}
        name={name}
        placeholder={placeholder}
        required={required}
        onChange={onChange}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 outline-none focus:border-yellow-400"
      />
    </div>
  );
}

function Textarea({
  label,
  name,
  required = false,
  onChange,
}: {
  label: string;
  name: string;
  required?: boolean;
  onChange: React.ChangeEventHandler<HTMLTextAreaElement>;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm text-zinc-400">
        {label} {required && <span className="text-red-400">*</span>}
      </label>

      <textarea
        name={name}
        required={required}
        onChange={onChange}
        rows={3}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 outline-none focus:border-yellow-400"
      />
    </div>
  );
}

function Select({
  label,
  name,
  options,
  required = false,
  onChange,
}: {
  label: string;
  name: string;
  options: string[];
  required?: boolean;
  onChange: React.ChangeEventHandler<HTMLSelectElement>;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm text-zinc-400">
        {label} {required && <span className="text-red-400">*</span>}
      </label>

      <select
        name={name}
        required={required}
        onChange={onChange}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 outline-none focus:border-yellow-400"
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