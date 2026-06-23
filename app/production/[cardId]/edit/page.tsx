"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

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
    <main className="min-h-screen bg-[#070A0F] p-8 text-white">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-yellow-400">
          Complete Production Details
        </h1>

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-6 rounded-2xl border border-zinc-800 bg-[#0D1118] p-6"
        >
          <Select label="Paper Type" name="paperType" options={["Ordinary", "Carbonized"]} onChange={handleChange} required />
          <Select label="Ply" name="ply" options={["2-Ply", "3-Ply"]} onChange={handleChange} required />
          <Select label="Size" name="size" options={["1/3", "1/4", "1/2", "Whole"]} onChange={handleChange} required />
          <Select label="Order Priority" name="orderPriority" options={["Normal", "Rush"]} onChange={handleChange} required />

          <textarea
            name="specialInstructions"
            onChange={handleChange}
            rows={4}
            placeholder="Special Instructions"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 outline-none focus:border-yellow-400"
          />

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-yellow-400 px-8 py-3 font-bold text-black disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save & Move to Station 4"}
          </button>
        </form>
      </div>
    </main>
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