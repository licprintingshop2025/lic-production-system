import AppShell from "@/app/components/AppShell";
import PageHeader from "@/app/components/PageHeader";
import Link from "next/link";

type Employee = {
  employeeId: string;
  name: string;
  position: string;
  skills: string[];
  status: string;
  maxStations: number;
  shift: string;
  employmentType?: string;
};

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

async function getEmployees(): Promise<Employee[]> {
  const response = await fetch(
    `${BASE_URL}/api/employees`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as {
    employees?: Employee[];
  };

  return Array.isArray(data.employees)
    ? data.employees
    : [];
}

export default async function EmployeesPage() {
  const employees = await getEmployees();

  const activeEmployees = employees.filter(
    (employee) =>
      employee.status
        ?.toString()
        .trim()
        .toLowerCase() === "active",
  ).length;

  const inactiveEmployees =
    employees.length - activeEmployees;

  return (
    <AppShell
      activePage="employees"
      contentWidth="wide"
    >
      <PageHeader
        eyebrow="Production"
        title="Employee Management"
        description="Manage employee information, production skills, active status, station capacity, and shift schedule."
      />

      <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <EmployeeStat
          title="Total Employees"
          value={employees.length}
          subtitle="All employee records"
        />

        <EmployeeStat
          title="Active"
          value={activeEmployees}
          subtitle="Available employees"
        />

        <EmployeeStat
          title="Inactive"
          value={inactiveEmployees}
          subtitle="Currently unavailable"
        />
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-[#e3d8c7] bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-5 border-b border-[#eee5d8] bg-[#fbf7ef] px-5 py-5 sm:px-7 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-xl font-black text-black">
              Employee Database
            </h2>

            <p className="mt-1 text-sm leading-6 text-[#6f6254]">
              Source: Google Sheets → Employee
              Database tab
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href="https://docs.google.com/spreadsheets"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-[#cfc1ae] bg-white px-5 text-sm font-black text-black transition hover:bg-[#f8f2e8]"
            >
              Open Google Sheets
            </a>

            <Link
              href="/production/employees/new"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-black px-6 text-sm font-black text-white transition hover:bg-[#6b421f]"
            >
              + New Employee
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1250px] text-left text-sm">
            <thead className="bg-[#fffdf9] text-[#5f5448]">
              <tr>
                <th className="p-4 text-xs font-black uppercase tracking-wide">
                  Employee ID
                </th>

                <th className="p-4 text-xs font-black uppercase tracking-wide">
                  Full Name
                </th>

                <th className="p-4 text-xs font-black uppercase tracking-wide">
                  Position
                </th>

                <th className="p-4 text-xs font-black uppercase tracking-wide">
                  Skills
                </th>

                <th className="p-4 text-xs font-black uppercase tracking-wide">
                  Status
                </th>

                <th className="p-4 text-xs font-black uppercase tracking-wide">
                  Employment Type
                </th>

                <th className="p-4 text-center text-xs font-black uppercase tracking-wide">
                  Max Stations
                </th>

                <th className="p-4 text-xs font-black uppercase tracking-wide">
                  Shift
                </th>

                <th className="p-4 text-right text-xs font-black uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="border-t border-[#eee5d8] p-10 text-center text-[#6f6254]"
                  >
                    No employees found.
                  </td>
                </tr>
              ) : (
                employees.map((employee) => {
                  const isActive =
                    employee.status
                      ?.toString()
                      .trim()
                      .toLowerCase() === "active";

                  const employeeUrl =
                    `/production/employees/${encodeURIComponent(
                      employee.employeeId,
                    )}`;

                  return (
                    <tr
                      key={employee.employeeId}
                      className="border-t border-[#eee5d8] align-middle transition hover:bg-[#fbf7ef]"
                    >
                      <td className="p-4 font-mono text-xs font-black text-[#8b5e34]">
                        {employee.employeeId || "-"}
                      </td>

                      <td className="p-4 font-black text-black">
                        {employee.name || "-"}
                      </td>

                      <td className="p-4 text-[#5f5448]">
                        {employee.position || "-"}
                      </td>

                      <td className="p-4">
                        {employee.skills?.length > 0 ? (
                          <div className="flex max-w-[440px] flex-wrap gap-2">
                            {employee.skills.map(
                              (skill) => (
                                <span
                                  key={`${employee.employeeId}-${skill}`}
                                  className="rounded-md border border-[#e3d8c7] bg-[#fbf7ef] px-2.5 py-1 text-xs font-bold text-[#5f5448]"
                                >
                                  {skill}
                                </span>
                              ),
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-[#9b8c7c]">
                            —
                          </span>
                        )}
                      </td>

                      <td className="p-4">
                        <span
                          className={`inline-flex rounded-md px-3 py-1 text-xs font-black ${
                            isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {employee.status ||
                            "Inactive"}
                        </span>
                      </td>

                      <td className="p-4">
                        <span className="inline-flex rounded-md border border-[#e3d8c7] bg-white px-3 py-1 text-xs font-bold text-[#5f5448]">
                          {employee.employmentType ||
                            "Full-time"}
                        </span>
                      </td>

                      <td className="p-4 text-center font-black text-black">
                        {employee.maxStations || 1}
                      </td>

                      <td className="p-4">
                        <span className="inline-flex rounded-md border border-[#e3d8c7] bg-white px-3 py-1 text-xs font-bold text-[#5f5448]">
                          {employee.shift || "—"}
                        </span>
                      </td>

                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={employeeUrl}
                            className="inline-flex h-9 items-center justify-center rounded-lg border border-[#cfc1ae] bg-white px-4 text-xs font-black text-black transition hover:bg-[#f8f2e8]"
                          >
                            View
                          </Link>

                          <Link
                            href={employeeUrl}
                            className="inline-flex h-9 items-center justify-center rounded-lg bg-black px-4 text-xs font-black text-white transition hover:bg-[#6b421f]"
                          >
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-[#eee5d8] bg-[#fbf7ef] px-5 py-4 text-sm text-[#6f6254] sm:px-7">
          Showing{" "}
          <span className="font-black text-black">
            {employees.length}
          </span>{" "}
          employee
          {employees.length === 1 ? "" : "s"}.
        </div>
      </section>

      <footer className="mt-8 text-center text-xs text-[#7c6a56]">
        © 2026 LIC Printing Corporation.
        Production Management System.
      </footer>
    </AppShell>
  );
}

function EmployeeStat({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: number;
  subtitle: string;
}) {
  return (
    <article className="rounded-2xl border border-[#e3d8c7] bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8b5e34]">
        {title}
      </p>

      <p className="mt-3 text-3xl font-black text-black">
        {value}
      </p>

      <p className="mt-2 text-sm text-[#6f6254]">
        {subtitle}
      </p>
    </article>
  );
}