import AppShell from "../components/AppShell";
import PageHeader from "../components/PageHeader";

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

async function getEmployees() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/employees`, {
    cache: "no-store",
  });

  if (!res.ok) return [];

  const data = await res.json();
  return data.employees as Employee[];
}

export default async function EmployeesPage() {
  const employees = await getEmployees();

  const activeCount = employees.filter(
    (employee) => employee.status?.toString().trim().toLowerCase() === "active",
  ).length;

  const inactiveCount = employees.length - activeCount;

  const skilledCount = employees.filter(
    (employee) => employee.skills && employee.skills.length > 0,
  ).length;

  return (
    <AppShell activePage="employees" contentWidth="wide">
      <PageHeader
        title="Employee Management"
        description="Manage employee information, production skills, active status, station capacity, and shift schedule."
      />

      <section className="mt-5 rounded-xl border border-[#e6ddd1] bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-xl font-bold text-black">
              Employee Management
            </h2>
            <p className="mt-1 text-sm text-[#5f5448]">
              Source: Google Sheets → Employee Database tab
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="https://docs.google.com/spreadsheets"
              target="_blank"
              className="rounded-lg border border-[#e6ddd1] bg-white px-5 py-2 text-sm font-bold text-black hover:bg-[#fbf7ef]"
            >
              Open Google Sheets
            </a>

            <a
              href="/employees/new"
              className="rounded-lg bg-[#e1bb5f] px-5 py-2 text-sm font-black text-black hover:bg-[#edca73]"
            >
              + New Employee
            </a>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-[#eee4d6]">
          <table className="w-full min-w-[1250px] text-left text-sm">
            <thead className="bg-[#fbf7ef] text-[#5f5448]">
              <tr>
                <th className="p-4">Employee ID</th>
                <th className="p-4">Full Name</th>
                <th className="p-4">Position</th>
                <th className="p-4">Skills</th>
                <th className="p-4">Status</th>
                <th className="p-4">Employment Type</th>
                <th className="p-4 text-center">Max Stations</th>
                <th className="p-4">Shift</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-[#6f6254]">
                    No employees found.
                  </td>
                </tr>
              ) : (
                employees.map((employee) => {
                  const isActive =
                    employee.status?.toString().trim().toLowerCase() ===
                    "active";

                  return (
                    <tr
                      key={employee.employeeId}
                      className="border-t border-[#eee4d6] transition hover:bg-[#fbf7ef]"
                    >
                      <td className="p-4 font-mono text-xs font-bold text-[#9b6a22]">
                        {employee.employeeId}
                      </td>

                      <td className="p-4 font-bold text-black">
                        {employee.name}
                      </td>

                      <td className="p-4 text-[#5f5448]">
                        {employee.position}
                      </td>

                      <td className="p-4">
                        {employee.skills && employee.skills.length > 0 ? (
                          <div className="flex max-w-[420px] flex-wrap gap-2">
                            {employee.skills.map((skill) => (
                              <span
                                key={`${employee.employeeId}-${skill}`}
                                className="rounded-md border border-[#e6ddd1] bg-[#fbf7ef] px-3 py-1 text-xs font-semibold text-[#5f5448]"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-[#9b8c7c]">—</span>
                        )}
                      </td>

                      <td className="p-4">
                        <span
                          className={`rounded-md px-3 py-1 text-xs font-bold ${
                            isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {employee.status || "Inactive"}
                        </span>
                      </td>

                      <td className="p-4">
                        <span className="rounded-md border border-[#e6ddd1] bg-white px-3 py-1 text-xs font-semibold text-[#5f5448]">
                          {employee.employmentType || "Full-time"}
                        </span>
                      </td>

                      <td className="p-4 text-center font-bold text-black">
                        {employee.maxStations}
                      </td>

                      <td className="p-4">
                        <span className="rounded-md border border-[#e6ddd1] bg-white px-3 py-1 text-xs font-semibold text-[#5f5448]">
                          {employee.shift || "—"}
                        </span>
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <a
                            href={`/employees/${employee.employeeId}`}
                            className="rounded-lg border border-[#e6ddd1] bg-white px-4 py-2 text-sm font-bold text-black hover:bg-[#fbf7ef]"
                          >
                            View
                          </a>

                          <a
                            href={`/employees/${employee.employeeId}`}
                            className="rounded-lg bg-[#e1bb5f] px-4 py-2 text-sm font-bold text-black hover:bg-[#edca73]"
                          >
                            Edit
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="mt-8 text-center text-xs text-[#7c6a56]">
        © 2026 LIC Printing Shop. Production Management System.
      </footer>
    </AppShell>
  );
}
