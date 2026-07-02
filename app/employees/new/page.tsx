"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AppShell from "../../components/AppShell";
import PageHeader from "../../components/PageHeader";

type Employee = {
  employeeId: string;
  name: string;
  position: string;
  skills: string[];
  status: string;
  maxStations: number;
  shift: string;
  employmentType: string;
};

const STATION_SKILLS = [
  "Station 1 & 2 (Layouting & Encoding)",
  "Admin Head - (For Approval to Printing)",
  "Quality Checking",
  "Receiving & Pre-Print Formatting",
  "Running",
  "Numbering",
  "Collating",
  "Stapling / Padding",
  "Cutting & Trimming",
  "Browning",
  "Stamping",
  "Packaging & Labelling",
  "Finish Receipt",
  "Ready for Release",
];

export default function NewEmployeePage() {
  const router = useRouter();

  const [saving, setSaving] = useState(false);

  const [employee, setEmployee] = useState<Employee>({
    employeeId: "",
    name: "",
    position: "",
    skills: [],
    status: "Active",
    maxStations: 1,
    shift: "Whole Day",
    employmentType: "Full-time",
  });

  function updateField(field: keyof Employee, value: string | number) {
    setEmployee({
      ...employee,
      [field]: value,
    });
  }

  function toggleSkill(skill: string) {
    const currentSkills = employee.skills || [];
    const hasSkill = currentSkills.includes(skill);

    setEmployee({
      ...employee,
      skills: hasSkill
        ? currentSkills.filter((item) => item !== skill)
        : [...currentSkills, skill],
    });
  }

  async function handleCreate() {
    if (!employee.employeeId.trim() || !employee.name.trim()) {
      alert("Employee ID and Name are required.");
      return;
    }

    setSaving(true);

    const res = await fetch("/api/employees", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(employee),
    });

    const result = await res.json();

    setSaving(false);

    if (!res.ok) {
      alert(result.error || "Failed to create employee.");
      return;
    }

    alert("Employee created successfully.");
    router.push("/employees");
  }

  return (
    <AppShell activePage="employees">
      <div className="mx-auto max-w-[1200px]">
        <PageHeader
          title="New Employee"
          description="Add a new employee, assign production skills, set employment type, shift, and station capacity."
        />

        <section className="mt-7 rounded-xl border border-[#e6ddd1] bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-black">
            Employee Information
          </h2>

          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Employee ID">
              <input
                value={employee.employeeId}
                onChange={(e) => updateField("employeeId", e.target.value)}
                placeholder="Example: EMP-012"
                className="w-full rounded-lg border border-[#e6ddd1] bg-white p-3 text-black outline-none focus:border-[#c89132]"
              />
            </Field>

            <Field label="Name">
              <input
                value={employee.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Employee full name"
                className="w-full rounded-lg border border-[#e6ddd1] bg-white p-3 text-black outline-none focus:border-[#c89132]"
              />
            </Field>

            <Field label="Position">
              <input
                value={employee.position}
                onChange={(e) => updateField("position", e.target.value)}
                placeholder="Example: Skilled Worker"
                className="w-full rounded-lg border border-[#e6ddd1] bg-white p-3 text-black outline-none focus:border-[#c89132]"
              />
            </Field>

            <Field label="Status">
              <select
                value={employee.status}
                onChange={(e) => updateField("status", e.target.value)}
                className="w-full rounded-lg border border-[#e6ddd1] bg-white p-3 text-black outline-none focus:border-[#c89132]"
              >
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </Field>

            <Field label="Shift">
              <select
                value={employee.shift}
                onChange={(e) => updateField("shift", e.target.value)}
                className="w-full rounded-lg border border-[#e6ddd1] bg-white p-3 text-black outline-none focus:border-[#c89132]"
              >
                <option>Whole Day</option>
                <option>AM Shift</option>
                <option>PM Shift</option>
                <option>Part Time</option>
                <option>OJT</option>
              </select>
            </Field>

            <Field label="Employment Type">
              <select
                value={employee.employmentType}
                onChange={(e) =>
                  updateField("employmentType", e.target.value)
                }
                className="w-full rounded-lg border border-[#e6ddd1] bg-white p-3 text-black outline-none focus:border-[#c89132]"
              >
                <option>Full-time</option>
                <option>Part-time</option>
                <option>OJT</option>
                <option>Contractual</option>
              </select>
            </Field>

            <Field label="Maximum Stations">
              <input
                type="number"
                min={1}
                value={employee.maxStations}
                onChange={(e) =>
                  updateField("maxStations", Number(e.target.value))
                }
                className="w-full rounded-lg border border-[#e6ddd1] bg-white p-3 text-black outline-none focus:border-[#c89132]"
              />
            </Field>
          </div>
        </section>

        <section className="mt-5 rounded-xl border border-[#e6ddd1] bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-black">Production Skills</h2>
          <p className="mt-1 text-sm text-[#5f5448]">
            Select all stations this employee can work on.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
            {STATION_SKILLS.map((skill) => {
              const checked = employee.skills.includes(skill);

              return (
                <label
                  key={skill}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition ${
                    checked
                      ? "border-[#d6b25e] bg-[#fbf1d8]"
                      : "border-[#e6ddd1] bg-white hover:bg-[#fbf7ef]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSkill(skill)}
                    className="h-4 w-4"
                  />

                  <span className="text-sm font-semibold text-black">
                    {skill}
                  </span>
                </label>
              );
            })}
          </div>
        </section>

        <div className="sticky bottom-0 z-20 -mx-6 mt-8 border-t border-[#e6ddd1] bg-[#fffaf2]/95 px-6 py-5 backdrop-blur lg:-mx-8 lg:px-8">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-xs text-[#6f6254]">
              Creating this employee will add a new row to the Google Sheets
              Employee Database.
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => router.push("/employees")}
                className="rounded-lg border border-[#e6ddd1] bg-white px-6 py-3 text-sm font-bold text-black hover:bg-[#fbf7ef]"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleCreate}
                disabled={saving}
                className="rounded-lg bg-[#e1bb5f] px-8 py-3 text-sm font-black text-black hover:bg-[#edca73] disabled:opacity-60"
              >
                {saving ? "Creating..." : "Create Employee"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-black">{label}</label>
      {children}
    </div>
  );
}