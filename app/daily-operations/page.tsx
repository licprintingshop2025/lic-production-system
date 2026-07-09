"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AppShell from "../components/AppShell";
import PageHeader from "../components/PageHeader";
import ProductionSyncRunner from "../components/ProductionSyncRunner";
import {
  generateSmartAssignments,
  type Assignment,
  type AttendanceStatus,
  type Employee,
} from "@/lib/assignmentEngine";

type Status = AttendanceStatus;

type DailyOpsData = {
  stations: { name: string; jobs: number }[];
  rushOrders: { station: string; name: string }[];
};

const DISPLAY_STATIONS = [
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

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function stationMatches(trelloName: string, displayName: string) {
  const trello = normalize(trelloName);
  const display = normalize(displayName);

  return trello.includes(display) || display.includes(trello);
}

function shortStation(station: string) {
  return station
    .replace("Station 1 & 2 (Layouting & Encoding)", "Station 1 & 2")
    .replace("Admin Head - (For Approval to Printing)", "Admin Head")
    .replace("Receiving & Pre-Print Formatting", "Pre-Print")
    .replace("Packaging & Labelling", "Packaging");
}

function assignmentSignature(assignments: Assignment[]) {
  return JSON.stringify(
    assignments.map((item) => ({
      station: item.station,
      jobs: item.jobs,
      primary: item.primary,
      support: item.support,
      status: item.status,
    }))
  );
}

export default function DailyOperationsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Record<string, Status>>({});
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [generatedAt, setGeneratedAt] = useState("");
  const [hasGenerated, setHasGenerated] = useState(false);
  const [dailyData, setDailyData] = useState<DailyOpsData>({
    stations: [],
    rushOrders: [],
  });

  const lastSavedSignatureRef = useRef("");

  const activeEmployees = useMemo(
    () =>
      employees.filter(
        (employee) =>
          employee.status?.toString().trim().toLowerCase() === "active"
      ),
    [employees]
  );

  useEffect(() => {
    loadAll();

    const interval = setInterval(() => {
      loadDailyData();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!activeEmployees.length) return;

    const defaultAttendance = Object.fromEntries(
      activeEmployees.map((employee) => [
        employee.name,
        employee.employmentType?.toLowerCase() === "ojt" ? "None" : "Present",
      ])
    ) as Record<string, Status>;

    setAttendance(defaultAttendance);
  }, [activeEmployees]);


  async function loadAll() {
    await Promise.all([loadEmployees(), loadDailyData(), loadTodayAssignments()]);
  }

  async function loadEmployees() {
    const res = await fetch("/api/employees", { cache: "no-store" });
    if (!res.ok) return;

    const data = await res.json();
    setEmployees(data.employees || []);
  }

  async function loadDailyData() {
    try {
      const res = await fetch("/api/daily-operations", { cache: "no-store" });
      if (!res.ok) return;

      const data = await res.json();
      setDailyData(data);
    } catch (error) {
      console.error("Daily operations fetch failed:", error);
    }
  }

  async function loadTodayAssignments() {
    const res = await fetch("/api/daily-assignments", {
      cache: "no-store",
    });

    if (!res.ok) return;

    const data = await res.json();

    if (data.assignments?.length > 0) {
      setAssignments(data.assignments);
      setGeneratedAt(data.generatedAt || "");
      setHasGenerated(true);
      lastSavedSignatureRef.current = assignmentSignature(data.assignments);
    }
  }

  function getStationJobsFromData(data: DailyOpsData, stationName: string) {
    return (
      data.stations.find((station) => stationMatches(station.name, stationName))
        ?.jobs || 0
    );
  }

  function getStationJobs(stationName: string) {
    return getStationJobsFromData(dailyData, stationName);
  }

  function getStationLoads(data: DailyOpsData) {
    return DISPLAY_STATIONS.map((station) => ({
      name: station,
      jobs: getStationJobsFromData(data, station),
    }));
  }

  async function saveAssignments(
    nextAssignments: Assignment[],
    sourceAttendance: Record<string, Status>
  ) {
    const signature = assignmentSignature(nextAssignments);

    if (signature === lastSavedSignatureRef.current) return;

    lastSavedSignatureRef.current = signature;

    const now = new Date().toLocaleString();

    setAssignments(nextAssignments);
    setGeneratedAt(now);

    await fetch("/api/daily-assignments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        assignments: nextAssignments,
      }),
    });
  }


  async function handleGenerateAssignments() {
    const res = await fetch("/api/daily-operations", { cache: "no-store" });
    if (!res.ok) return;

    const latestData = await res.json();
    setDailyData(latestData);
    setHasGenerated(true);

    const result = generateSmartAssignments({
      employees: activeEmployees,
      stations: getStationLoads(latestData),
      attendance,
    });

    await saveAssignments(result.assignments, attendance);
  }

  function updateStatus(workerName: string, status: Status) {
    setAttendance((current) => ({
      ...current,
      [workerName]: status,
    }));
  }

  function resetDay() {
    const defaultAttendance = Object.fromEntries(
      activeEmployees.map((employee) => [
        employee.name,
        employee.employmentType?.toLowerCase() === "ojt" ? "None" : "Present",
      ])
    ) as Record<string, Status>;

    setAttendance(defaultAttendance);
    setAssignments([]);
    setGeneratedAt("");
    setHasGenerated(false);
    lastSavedSignatureRef.current = "";
  }

  const attendanceSummary = useMemo(() => {
    const values = Object.values(attendance);

    const present = values.filter((value) => value === "Present").length;
    const halfDay = values.filter(
      (value) => value === "Half-day AM" || value === "Half-day PM"
    ).length;
    const absent = values.filter((value) => value === "Absent").length;
    const none = values.filter((value) => value === "None").length;

    const available = present + halfDay;
    const total = Math.max(activeEmployees.length - none, 0);
    const coverage = total === 0 ? 0 : Math.round((available / total) * 100);

    return { present, halfDay, absent, none, available, coverage };
  }, [attendance, activeEmployees]);

  return (
    <AppShell activePage="daily-operations">
      <ProductionSyncRunner />
      <div className="mx-auto max-w-[1500px]">
        <PageHeader
          title="Daily Operations"
          description="Manage daily attendance, station workload, and smart manpower assignment based on employee skills."
        />

        {generatedAt && (
          <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-700">
            Assignments saved for today. Last updated: {generatedAt}
          </div>
        )}

        <section className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="rounded-xl border border-[#e6ddd1] bg-white p-6 shadow-sm xl:col-span-2">
            <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h2 className="text-xl font-bold text-black">
                  Attendance Management
                </h2>
                <p className="mt-1 text-sm text-[#5f5448]">
                  Active employees are loaded from the Employee Database.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={resetDay}
                  className="rounded-lg border border-[#e6ddd1] bg-white px-5 py-2 text-sm font-bold text-black hover:bg-[#fbf7ef]"
                >
                  Reset Day
                </button>

                <button
                  onClick={handleGenerateAssignments}
                  className="rounded-lg bg-[#e1bb5f] px-5 py-2 text-sm font-black text-black hover:bg-[#edca73]"
                >
                  {assignments.length
                    ? "Regenerate Assignments"
                    : "Generate Assignments"}
                </button>
              </div>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <MiniStat title="Present" value={attendanceSummary.present} />
              <MiniStat title="Half-Day" value={attendanceSummary.halfDay} />
              <MiniStat title="Absent" value={attendanceSummary.absent} />
              <MiniStat
                title="Coverage"
                value={`${attendanceSummary.coverage}%`}
              />
            </div>

            <div className="overflow-x-auto rounded-lg border border-[#eee4d6]">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-[#fbf7ef] text-[#5f5448]">
                  <tr>
                    <th className="p-4">Worker</th>
                    <th className="p-4">Position</th>
                    <th className="p-4">Employment Type</th>
                    <th className="p-4 text-center">Max Stations</th>
                    <th className="p-4">Skills</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {activeEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-[#6f6254]">
                        No active employees found.
                      </td>
                    </tr>
                  ) : (
                    activeEmployees.map((employee) => (
                      <tr
                        key={employee.employeeId}
                        className="border-t border-[#eee4d6]"
                      >
                        <td className="p-4 font-bold text-black">
                          {employee.name}
                        </td>

                        <td className="p-4 text-[#5f5448]">
                          {employee.position}
                        </td>

                        <td className="p-4 text-[#5f5448]">
                          {employee.employmentType || "Full-time"}
                        </td>

                        <td className="p-4 text-center font-bold">
                          {employee.maxStations || 1}
                        </td>

                        <td className="p-4">
                          <span className="text-sm text-[#5f5448]">
                            {(employee.skills || []).length} skill(s)
                          </span>
                        </td>

                        <td className="p-4">
                          <select
                            value={attendance[employee.name] || "Present"}
                            onChange={(e) =>
                              updateStatus(
                                employee.name,
                                e.target.value as Status
                              )
                            }
                            className="rounded-lg border border-[#e6ddd1] bg-white p-2 text-black outline-none focus:border-[#c89132]"
                          >
                            <option>Present</option>
                            <option>Half-day AM</option>
                            <option>Half-day PM</option>
                            <option>Absent</option>
                            <option>None</option>
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-[#e6ddd1] bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-black">Production Load</h2>
            <p className="mt-1 text-sm text-[#5f5448]">
              Active Trello jobs per station.
            </p>

            <div className="mt-5 space-y-3">
              {DISPLAY_STATIONS.map((station) => {
                const jobs = getStationJobs(station);

                return (
                  <div
                    key={station}
                    className="flex items-center justify-between rounded-lg border border-[#eee4d6] bg-[#fbf7ef] p-4"
                  >
                    <span className="text-sm font-semibold text-black">
                      {shortStation(station)}
                    </span>

                    <span className="rounded-md bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                      {jobs}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-xl border border-[#e6ddd1] bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <h2 className="text-xl font-bold text-black">
                Station Assignments
              </h2>
              <p className="mt-1 text-sm text-[#5f5448]">
                Assignment is generated by the smart workforce engine using
                skills, attendance, employment type, and max station capacity.
              </p>
            </div>

            {assignments.length > 0 && (
              <span className="rounded-lg border border-[#e6ddd1] bg-white px-4 py-2 text-sm font-bold text-[#8b5e24]">
                {assignments.length} station(s)
              </span>
            )}
          </div>

          {assignments.length === 0 ? (
            <p className="rounded-lg border border-[#eee4d6] bg-[#fbf7ef] p-5 text-sm text-[#6f6254]">
              Click Generate Assignments to compute today&apos;s station
              coverage.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[#eee4d6]">
              <table className="w-full min-w-[1200px] text-left text-sm">
                <thead className="bg-[#fbf7ef] text-[#5f5448]">
                  <tr>
                    <th className="p-4">Station</th>
                    <th className="p-4 text-center">Jobs</th>
                    <th className="p-4">Primary Worker</th>
                    <th className="p-4">Support Worker</th>
                    <th className="p-4">Coverage</th>
                    <th className="p-4">Notes</th>
                  </tr>
                </thead>

                <tbody>
                  {assignments.map((assignment) => (
                    <tr
                      key={assignment.station}
                      className="border-t border-[#eee4d6]"
                    >
                      <td className="p-4 font-bold text-black">
                        {shortStation(assignment.station)}
                      </td>

                      <td className="p-4 text-center font-bold">
                        {assignment.jobs}
                      </td>

                      <td className="p-4 text-[#3f352a]">
                        {assignment.primary}
                      </td>

                      <td className="p-4 text-[#3f352a]">
                        {assignment.support}
                      </td>

                      <td className="p-4">
                        <CoverageBadge status={assignment.status} />
                      </td>

                      <td className="p-4 text-[#6f6254]">
                        {assignment.notes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="mt-8 text-center text-xs text-[#7c6a56]">
          © 2026 LIC Printing Shop. Production Management System.
        </footer>
      </div>
    </AppShell>
  );
}

function MiniStat({ title, value }: { title: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-[#eee4d6] bg-[#fbf7ef] p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-[#6f6254]">
        {title}
      </p>
      <p className="mt-2 text-2xl font-black text-black">{value}</p>
    </div>
  );
}

function CoverageBadge({ status }: { status: string }) {
  const style =
    status === "Covered"
      ? "bg-green-100 text-green-700"
      : status === "Needs Support"
      ? "bg-amber-100 text-amber-700"
      : status === "Unavailable"
      ? "bg-orange-100 text-orange-700"
      : status === "Admin Only"
      ? "bg-blue-100 text-blue-700"
      : status === "No Active Job"
      ? "bg-[#f8ead3] text-[#8b5e24]"
      : "bg-red-100 text-red-700";

  return (
    <span className={`rounded-md px-3 py-1 text-xs font-bold ${style}`}>
      {status}
    </span>
  );
}