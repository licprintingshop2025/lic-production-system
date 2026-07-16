"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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

export default function EmployeeDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const employeeId = params.employeeId as string;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);



  const loadEmployee = useCallback(async () => {
    try {
      setLoading(true);

      const res = await fetch("/api/employees", { cache: "no-store" });

      if (!res.ok) {
        setEmployee(null);
        return;
      }

      const data = await res.json();

      const found = data.employees?.find(
        (item: Employee) =>
          item.employeeId?.toString().trim() ===
          employeeId.toString().trim(),
      );

      if (!found) {
        setEmployee(null);
        return;
      }

      setEmployee({
        employeeId: found.employeeId || "",
        name: found.name || "",
        position: found.position || "",
        skills: found.skills || [],
        status: found.status || "Inactive",
        maxStations: Number(found.maxStations || 1),
        shift: found.shift || "Whole Day",
        employmentType: found.employmentType || "Full-time",
      });
    } catch (error) {
      console.error("Employee fetch failed:", error);
      setEmployee(null);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void loadEmployee();
  }, [loadEmployee]);

  function updateField(field: keyof Employee, value: string | number) {
    if (!employee) return;

    setEmployee({
      ...employee,
      [field]: value,
    });
  }

  function toggleSkill(skill: string) {
    if (!employee) return;

    const currentSkills = employee.skills || [];
    const hasSkill = currentSkills.includes(skill);

    setEmployee({
      ...employee,
      skills: hasSkill
        ? currentSkills.filter((item) => item !== skill)
        : [...currentSkills, skill],
    });
  }

  async function handleSave() {
    if (!employee) return;

    setSaving(true);

    const res = await fetch(`/api/employees/${employee.employeeId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(employee),
    });

    const result = await res.json();

    setSaving(false);

    if (!res.ok) {
      alert(result.error || "Failed to update employee.");
      return;
    }

    alert("Employee updated successfully.");
    router.push("/employees");
  }

  if (loading) {
    return (
      <AppShell activePage="employees">
        <div className="mx-auto max-w-[1200px]">
          <PageHeader
            title="Loading Employee"
            description="Please wait while the employee details are being loaded."
          />
        </div>
      </AppShell>
    );
  }

  if (!employee) {
    return (
      <AppShell activePage="employees">
        <div className="mx-auto max-w-[1200px]">
          <PageHeader
            title="Employee Not Found"
            description="The selected employee could not be loaded."
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activePage="employees" contentWidth="wide">
      <PageHeader
        title="Employee Details"
        description="Update employee information, active status, shift, employment type, maximum station capacity, and production skills."
      />

      <section className="mt-7 rounded-xl border border-[#e6ddd1] bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-black">Employee Information</h2>

        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="Employee ID">
            <input
              value={employee.employeeId}
              disabled
              className="w-full rounded-lg border border-[#e6ddd1] bg-[#fbf7ef] p-3 text-black"
            />
          </Field>

          <Field label="Name">
            <input
              value={employee.name}
              onChange={(e) => updateField("name", e.target.value)}
              className="w-full rounded-lg border border-[#e6ddd1] bg-white p-3 text-black outline-none focus:border-[#c89132]"
            />
          </Field>

          <Field label="Position">
            <input
              value={employee.position}
              onChange={(e) => updateField("position", e.target.value)}
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
              value={employee.employmentType || "Full-time"}
              onChange={(e) => updateField("employmentType", e.target.value)}
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
            const checked = (employee.skills || []).includes(skill);

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

      <div className="mt-8 border-t border-[#e6ddd1] bg-[#fffaf2] px-6 py-5 lg:px-8">
        <div className="mx-auto flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[#6f6254]">
            Saving this employee will update the Google Sheets Employee
            Database.
          </p>

          <div className="flex shrink-0 justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push("/employees")}
              className="rounded-lg border border-[#e6ddd1] bg-white px-6 py-3 text-sm font-bold text-black transition hover:bg-[#fbf7ef]"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-[#e1bb5f] px-8 py-3 text-sm font-black text-black transition hover:bg-[#edca73] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
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
