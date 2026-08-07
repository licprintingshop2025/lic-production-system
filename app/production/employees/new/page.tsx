"use client";

import AppShell from "@/app/components/AppShell";
import PageHeader from "@/app/components/PageHeader";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  useState,
} from "react";

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

function createInitialEmployee(): Employee {
  return {
    employeeId: "",
    name: "",
    position: "",
    skills: [],
    status: "Active",
    maxStations: 1,
    shift: "Whole Day",
    employmentType: "Full-time",
  };
}

export default function NewEmployeePage() {
  const router = useRouter();

  const [saving, setSaving] =
    useState(false);

  const [employee, setEmployee] =
    useState<Employee>(createInitialEmployee());

  const [submissionError, setSubmissionError] =
    useState("");

  const [createdEmployee, setCreatedEmployee] =
    useState<{
      employeeId: string;
      name: string;
    } | null>(null);

  const [copied, setCopied] =
    useState(false);

  function updateField(
    field: keyof Employee,
    value: string | number,
  ) {
    setEmployee((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function toggleSkill(skill: string) {
    setEmployee((current) => {
      const currentSkills =
        current.skills || [];

      const hasSkill =
        currentSkills.includes(skill);

      return {
        ...current,
        skills: hasSkill
          ? currentSkills.filter(
              (item) => item !== skill,
            )
          : [...currentSkills, skill],
      };
    });
  }

  function handleReset() {
    setEmployee(createInitialEmployee());
    setSubmissionError("");
    setCopied(false);
  }

  async function handleCopyEmployeeId() {
    if (!createdEmployee?.employeeId) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        createdEmployee.employeeId,
      );

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error(
        "Failed to copy employee ID:",
        error,
      );
    }
  }

  function handleCloseSuccessModal() {
    setCreatedEmployee(null);
    setCopied(false);

    router.push("/production/employees");
    router.refresh();
  }

  async function handleCreate() {
    if (saving) {
      return;
    }

    setSubmissionError("");
    setCopied(false);

    if (!employee.employeeId.trim()) {
      setSubmissionError(
        "Employee ID is required.",
      );

      return;
    }

    if (!employee.name.trim()) {
      setSubmissionError(
        "Employee name is required.",
      );

      return;
    }

    if (
      !Number.isFinite(employee.maxStations) ||
      employee.maxStations < 1
    ) {
      setSubmissionError(
        "Maximum Stations must be at least 1.",
      );

      return;
    }

    try {
      setSaving(true);

      const normalizedEmployee: Employee = {
        ...employee,
        employeeId:
          employee.employeeId.trim(),
        name: employee.name.trim(),
        position:
          employee.position.trim(),
      };

      const response = await fetch(
        "/api/employees",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(
            normalizedEmployee,
          ),
        },
      );

      const result =
        await response.json();

      if (!response.ok) {
        setSubmissionError(
          result.error ||
            "Failed to create employee.",
        );

        console.error(
          "Create employee response:",
          result,
        );

        return;
      }

      setCreatedEmployee({
        employeeId:
          normalizedEmployee.employeeId,
        name: normalizedEmployee.name,
      });

      setEmployee(createInitialEmployee());
    } catch (error) {
      console.error(
        "Create employee error:",
        error,
      );

      setSubmissionError(
        "Unexpected error while creating the employee. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      activePage="employees"
      contentWidth="form"
    >
      <PageHeader
        eyebrow="Production / Employees"
        title="New Employee"
        description="Add a new employee, assign production skills, set employment type, shift, and station capacity."
      />

      <div className="mt-6">
        <button
          type="button"
          onClick={() =>
            router.push(
              "/production/employees",
            )
          }
          disabled={saving}
          className="text-sm font-bold text-[#6b421f] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          ← Back to Employee Management
        </button>
      </div>

      <div className="mt-7 space-y-6">
        {submissionError && (
          <section
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black text-red-800">
                  Unable to create employee
                </p>

                <p className="mt-1 text-sm leading-6 text-red-700">
                  {submissionError}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSubmissionError("")
                }
                className="shrink-0 rounded-md px-2 py-1 text-sm font-black text-red-700 transition hover:bg-red-100"
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          </section>
        )}

        <FormSection
          number="1"
          title="Employee Information"
          description="Enter the employee's basic information, availability, and station capacity."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="Employee ID"
              required
            >
              <input
                value={employee.employeeId}
                disabled={saving}
                onChange={(event) =>
                  updateField(
                    "employeeId",
                    event.target.value,
                  )
                }
                placeholder="Example: EMP-012"
                className={inputClassName}
              />
            </Field>

            <Field
              label="Name"
              required
            >
              <input
                value={employee.name}
                disabled={saving}
                onChange={(event) =>
                  updateField(
                    "name",
                    event.target.value,
                  )
                }
                placeholder="Employee full name"
                className={inputClassName}
              />
            </Field>

            <Field label="Position">
              <input
                value={employee.position}
                disabled={saving}
                onChange={(event) =>
                  updateField(
                    "position",
                    event.target.value,
                  )
                }
                placeholder="Example: Skilled Worker"
                className={inputClassName}
              />
            </Field>

            <Field label="Status">
              <select
                value={employee.status}
                disabled={saving}
                onChange={(event) =>
                  updateField(
                    "status",
                    event.target.value,
                  )
                }
                className={inputClassName}
              >
                <option value="Active">
                  Active
                </option>

                <option value="Inactive">
                  Inactive
                </option>
              </select>
            </Field>

            <Field label="Shift">
              <select
                value={employee.shift}
                disabled={saving}
                onChange={(event) =>
                  updateField(
                    "shift",
                    event.target.value,
                  )
                }
                className={inputClassName}
              >
                <option value="Whole Day">
                  Whole Day
                </option>

                <option value="AM Shift">
                  AM Shift
                </option>

                <option value="PM Shift">
                  PM Shift
                </option>

                <option value="Part Time">
                  Part Time
                </option>

                <option value="OJT">
                  OJT
                </option>
              </select>
            </Field>

            <Field label="Employment Type">
              <select
                value={
                  employee.employmentType
                }
                disabled={saving}
                onChange={(event) =>
                  updateField(
                    "employmentType",
                    event.target.value,
                  )
                }
                className={inputClassName}
              >
                <option value="Full-time">
                  Full-time
                </option>

                <option value="Part-time">
                  Part-time
                </option>

                <option value="OJT">
                  OJT
                </option>

                <option value="Contractual">
                  Contractual
                </option>
              </select>
            </Field>

            <Field label="Maximum Stations">
              <input
                type="number"
                min={1}
                value={employee.maxStations}
                disabled={saving}
                onChange={(event) =>
                  updateField(
                    "maxStations",
                    Math.max(
                      1,
                      Number(
                        event.target.value,
                      ) || 1,
                    ),
                  )
                }
                className={inputClassName}
              />
            </Field>
          </div>
        </FormSection>

        <FormSection
          number="2"
          title="Production Skills"
          description="Select all production stations this employee is qualified to work on."
        >
          <div className="grid gap-3 md:grid-cols-2">
            {STATION_SKILLS.map(
              (skill) => {
                const checked =
                  employee.skills.includes(
                    skill,
                  );

                return (
                  <label
                    key={skill}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${
                      checked
                        ? "border-black bg-[#f3eadc]"
                        : "border-[#e3d8c7] bg-white hover:bg-[#fbf7ef]"
                    } ${
                      saving
                        ? "cursor-not-allowed opacity-60"
                        : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={saving}
                      onChange={() =>
                        toggleSkill(skill)
                      }
                      className="h-4 w-4 shrink-0 accent-black"
                    />

                    <span className="text-sm font-bold text-black">
                      {skill}
                    </span>
                  </label>
                );
              },
            )}
          </div>

          <div className="mt-5 rounded-xl border border-[#e3d8c7] bg-[#fbf7ef] px-4 py-3 text-sm text-[#6f6254]">
            <span className="font-black text-black">
              {employee.skills.length}
            </span>{" "}
            skill
            {employee.skills.length === 1
              ? ""
              : "s"}{" "}
            selected.
          </div>
        </FormSection>

        <section className="flex flex-col gap-5 rounded-2xl border border-[#e3d8c7] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-xs leading-5 text-[#7c6a56]">
            Creating this employee will add
            a new row to the Google Sheets
            Employee Database.
          </p>

          <div className="flex shrink-0 flex-col-reverse gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              className="inline-flex h-12 items-center justify-center rounded-lg border border-[#cfc1ae] bg-white px-6 text-sm font-black text-black transition hover:bg-[#f8f2e8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear Form
            </button>

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/production/employees",
                )
              }
              disabled={saving}
              className="inline-flex h-12 items-center justify-center rounded-lg border border-[#cfc1ae] bg-white px-6 text-sm font-black text-black transition hover:bg-[#f8f2e8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleCreate}
              disabled={saving}
              className="inline-flex h-12 min-w-48 items-center justify-center rounded-lg bg-black px-7 text-sm font-black text-white transition hover:bg-[#6b421f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "Creating..."
                : "Create Employee"}
            </button>
          </div>
        </section>
      </div>

      {createdEmployee && (
        <SuccessModal
          employeeId={
            createdEmployee.employeeId
          }
          employeeName={
            createdEmployee.name
          }
          copied={copied}
          onCopy={handleCopyEmployeeId}
          onClose={handleCloseSuccessModal}
        />
      )}
    </AppShell>
  );
}

function SuccessModal({
  employeeId,
  employeeName,
  copied,
  onCopy,
  onClose,
}: {
  employeeId: string;
  employeeName: string;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="employee-success-title"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#d9c9b1] bg-white shadow-2xl">
        <div className="bg-black px-6 py-5 sm:px-7">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#b58a52] text-xl font-black text-black">
              ✓
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c6a66f]">
                Employee Created
              </p>

              <h2
                id="employee-success-title"
                className="mt-1 text-xl font-black text-white"
              >
                Employee Record Successfully Created
              </h2>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-7">
          <p className="text-sm leading-6 text-[#6f6254]">
            The employee record has been added successfully to
            the Employee Database and is now available in Employee
            Management.
          </p>

          <div className="mt-6 rounded-xl border border-[#dfd1bd] bg-[#fbf7ef] p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#7c6a56]">
              Employee
            </p>

            <p className="mt-2 text-lg font-black text-black">
              {employeeName}
            </p>

            <div className="mt-4 border-t border-[#e7dbc9] pt-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#7c6a56]">
                Employee ID
              </p>

              <p className="mt-2 break-all font-mono text-xl font-black tracking-wide text-black">
                {employeeId}
              </p>

              <button
                type="button"
                onClick={onCopy}
                className="mt-4 inline-flex h-10 items-center justify-center rounded-lg border border-[#bda98c] bg-white px-4 text-xs font-black text-black transition hover:border-black hover:bg-black hover:text-white"
              >
                {copied
                  ? "Employee ID Copied"
                  : "Copy Employee ID"}
              </button>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-[#eadfce] bg-[#fffdf9] px-4 py-3">
            <p className="text-xs leading-5 text-[#766958]">
              Click Done to return to Employee Management and
              review the new employee record.
            </p>
          </div>

          <div className="mt-7 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-12 min-w-36 items-center justify-center rounded-lg bg-black px-6 text-sm font-black text-white transition hover:bg-[#6b421f]"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
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

      <div className="p-5 sm:p-7">
        {children}
      </div>
    </section>
  );
}

function Field({
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
          <span className="ml-1 text-red-600">
            *
          </span>
        )}
      </span>

      {children}
    </label>
  );
}

const inputClassName =
  "h-12 w-full rounded-lg border border-[#d8cbb9] bg-white px-4 text-sm text-black outline-none transition placeholder:text-[#9a8d7d] focus:border-[#8b5e34] focus:ring-2 focus:ring-[#8b5e34]/10 disabled:cursor-not-allowed disabled:bg-[#f4f1ec] disabled:text-[#7c7165]";