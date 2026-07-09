"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import AppShell from "../../../components/AppShell";
import PageHeader from "../../../components/PageHeader";

export default function CompleteProductionDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const cardId = params.cardId as string;

  const [formData, setFormData] = useState({
    paperType: "",
    ply: "",
    size: "",
    orderPriority: "",
    specialInstructions: "",

    deliveryStrategy: "COMPLETE",
    initialReleaseQty: "10",
    initialDueWorkingDays: "10",
    finalDueWorkingDays: "30",
  });

  const [loading, setLoading] = useState(false);

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`/api/production/${cardId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await res.json();

      if (!res.ok) {
        alert(result.error || "Failed to save production details.");
        console.error(result);
        setLoading(false);
        return;
      }

      alert("Production details saved and card moved to Station 4.");
      router.push(`/production/${cardId}`);
    } catch (error) {
      alert("Unexpected error. Check console/terminal.");
      console.error(error);
      setLoading(false);
    }
  }

  return (
    <AppShell activePage="production">
      <div className="mx-auto max-w-[1200px]">
        <PageHeader
          title="Complete Production Details"
          description="Complete the print specifications before sending this job to Station 4."
        />

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <section className="rounded-2xl border border-[#e3d8c7] bg-white p-6 shadow-[0_2px_10px_rgba(70,45,20,0.08)]">
            <div className="mb-6 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f8ead3] text-sm font-black text-[#8b5e24]">
                01
              </div>

              <div>
                <h2 className="text-xl font-black text-black">
                  Production Specifications
                </h2>
                <p className="mt-1 text-sm text-[#6f6254]">
                  Define paper type, ply, size, priority, and special
                  instructions.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Select
                label="Paper Type"
                name="paperType"
                value={formData.paperType}
                options={["Ordinary", "Carbonized"]}
                onChange={handleChange}
                required
              />

              <Select
                label="Ply"
                name="ply"
                value={formData.ply}
                options={["2-Ply", "3-Ply"]}
                onChange={handleChange}
                required
              />

              <Select
                label="Size"
                name="size"
                value={formData.size}
                options={["1/3", "1/4", "1/2", "Whole"]}
                onChange={handleChange}
                required
              />

              <Select
                label="Order Priority"
                name="orderPriority"
                value={formData.orderPriority}
                options={["Normal", "Rush"]}
                onChange={handleChange}
                required
              />

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-[#3f352a]">
                  Special Instructions
                </label>

                <textarea
                  name="specialInstructions"
                  value={formData.specialInstructions}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Enter special instructions, notes, or production reminders."
                  className="w-full rounded-xl border border-[#dfd4c4] bg-white p-3 text-black outline-none transition placeholder:text-[#a99b8c] focus:border-[#c89132] focus:ring-2 focus:ring-[#f4dfb9]"
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#e3d8c7] bg-white p-6 shadow-[0_2px_10px_rgba(70,45,20,0.08)]">
            <div className="mb-6 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f8ead3] text-sm font-black text-[#8b5e24]">
                02
              </div>

              <div>
                <h2 className="text-xl font-black text-black">
                  Delivery Commitment
                </h2>
                <p className="mt-1 text-sm text-[#6f6254]">
                  Define how this order will be delivered to the client.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Select
                label="Delivery Strategy"
                name="deliveryStrategy"
                value={formData.deliveryStrategy}
                options={["COMPLETE", "PARTIAL"]}
                onChange={handleChange}
                required
              />

              {formData.deliveryStrategy === "PARTIAL" && (
                <>
                  <Input
                    label="Initial Release Quantity"
                    name="initialReleaseQty"
                    type="number"
                    value={formData.initialReleaseQty}
                    onChange={handleChange}
                    required
                  />

                  <Input
                    label="Initial Due (Working Days)"
                    name="initialDueWorkingDays"
                    type="number"
                    value={formData.initialDueWorkingDays}
                    onChange={handleChange}
                    required
                  />

                  <Input
                    label="Final Due (Working Days)"
                    name="finalDueWorkingDays"
                    type="number"
                    value={formData.finalDueWorkingDays}
                    onChange={handleChange}
                    required
                  />
                </>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-[#e3d8c7] bg-[#fffaf2] p-5 shadow-[0_2px_10px_rgba(70,45,20,0.06)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-bold text-black">Next Step</p>
                <p className="mt-1 text-sm text-[#6f6254]">
                  Once saved, this card will be moved to Station 4.
                </p>
              </div>

              <span className="rounded-xl bg-[#f8ead3] px-4 py-2 text-sm font-black text-[#8b5e24]">
                Station 4
              </span>
            </div>
          </section>

          <div className="sticky bottom-0 z-20 -mx-6 border-t border-[#e3d8c7] bg-[#fffaf2]/95 px-6 py-5 backdrop-blur lg:-mx-8 lg:px-8">
            <div className="mx-auto flex max-w-[1200px] flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-xs text-[#7c6a56]">
                Saving this form will update the Trello card and move it to
                Station 4.
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/production")}
                  className="rounded-xl border border-[#dfd4c4] bg-white px-6 py-3 text-sm font-bold text-[#3f352a] hover:bg-[#fbf7ef]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-[#e1bb5f] px-8 py-3 text-sm font-black text-black hover:bg-[#edca73] disabled:opacity-60"
                >
                  {loading ? "Saving..." : "Save & Send to Station 4"}
                </button>
              </div>
            </div>
          </div>
        </form>

        <footer className="mt-10 text-center text-xs text-[#7c6a56]">
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
  required = false,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  type?: string;
  required?: boolean;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-[#3f352a]">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <input
        name={name}
        type={type}
        value={value}
        required={required}
        onChange={onChange}
        min={type === "number" ? 1 : undefined}
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
            {option === "COMPLETE"
              ? "Complete Order"
              : option === "PARTIAL"
              ? "Partial Release"
              : option}
          </option>
        ))}
      </select>
    </div>
  );
}