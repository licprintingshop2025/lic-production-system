import {
  COPIES_PER_SET_OPTIONS,
  MANNER_TYPES,
  RECEIPT_TYPES,
  SETS_PER_BOOKLET_OPTIONS,
} from "@/lib/orders/constants";

import type { DocumentItem } from "@/lib/orders/types";

type DocumentMode = "received-atp" | "non-bir";

type Props = {
  document: DocumentItem;
  index: number;
  canRemove: boolean;
  mode: DocumentMode;
  onChange: (id: string, field: keyof DocumentItem, value: string) => void;
  onRemove: (id: string) => void;
};

export function createEmptyDocument(): DocumentItem {
  return {
    id: `${Date.now()}-${Math.random()}`,
    description: "",
    descriptionOther: "",
    manner: "",
    booklets: "",
    setsPerBooklet: "50",
    copiesPerSet: "",
    copiesPerSetOther: "",
    serialNumbers: "",
  };
}

export default function DocumentItemCard({
  document,
  index,
  canRemove,
  mode,
  onChange,
  onRemove,
}: Props) {
  const isReceivedATP = mode === "received-atp";

  return (
    <div className="rounded-2xl border border-[#e3d8c7] bg-[#fffaf2] p-5">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-lg font-black text-black">
          Document #{index + 1}
        </h3>

        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(document.id)}
            className="rounded-lg border border-red-200 bg-white px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
          >
            Remove
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Select
          label="Description / Kind of Invoice or Receipt"
          value={document.description}
          onChange={(value) => onChange(document.id, "description", value)}
          required
          options={RECEIPT_TYPES}
        />

        {document.description === "OTHER" && (
          <Input
            label="Specify Other Receipt Type"
            value={document.descriptionOther || ""}
            onChange={(value) =>
              onChange(document.id, "descriptionOther", value)
            }
            required
          />
        )}

        {isReceivedATP && (
          <Select
            label="Manner / Doc Type"
            value={document.manner || ""}
            onChange={(value) => onChange(document.id, "manner", value)}
            required
            options={MANNER_TYPES}
          />
        )}

        <Input
          label="No. of Booklets"
          value={document.booklets}
          type="number"
          onChange={(value) => onChange(document.id, "booklets", value)}
          required
        />

        {isReceivedATP && (
          <Select
            label="No. of Sets Per Booklet"
            value={document.setsPerBooklet || "50"}
            onChange={(value) =>
              onChange(document.id, "setsPerBooklet", value)
            }
            required
            options={SETS_PER_BOOKLET_OPTIONS}
          />
        )}

        {isReceivedATP && (
          <Select
            label="No. of Copies Per Set"
            value={document.copiesPerSet || ""}
            onChange={(value) => onChange(document.id, "copiesPerSet", value)}
            required
            options={COPIES_PER_SET_OPTIONS}
          />
        )}

        {isReceivedATP && document.copiesPerSet === "OTHER" && (
          <Input
            label="Specify Copies Per Set"
            value={document.copiesPerSetOther || ""}
            type="number"
            onChange={(value) =>
              onChange(document.id, "copiesPerSetOther", value)
            }
            required
          />
        )}

        <Input
          label="Serial Numbers"
          value={document.serialNumbers || ""}
          placeholder="Example: 000001-000500"
          onChange={(value) => onChange(document.id, "serialNumbers", value)}
          required
        />
      </div>

    </div>
  );
}

function Input({
  label,
  value,
  type = "text",
  placeholder = "",
  required = false,
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-[#3f352a]">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-[#dfd4c4] bg-white p-3 text-black outline-none transition placeholder:text-[#a99b8c] focus:border-[#c89132] focus:ring-2 focus:ring-[#f4dfb9]"
      />
    </div>
  );
}

function Select({
  label,
  value,
  options,
  required = false,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-[#3f352a]">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <select
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
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