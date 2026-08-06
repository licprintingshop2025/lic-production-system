"use client";

import AppShell from "@/app/components/AppShell";
import PageHeader from "@/app/components/PageHeader";
import ProductionSyncRunner from "@/app/components/ProductionSyncRunner";
import {
  generateSmartAssignments,
  type Assignment,
  type AttendanceStatus,
  type Employee,
} from "@/lib/assignmentEngine";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Status = AttendanceStatus;

type DailyOpsData = {
  stations: {
    name: string;
    jobs: number;
  }[];
  rushOrders: {
    station: string;
    name: string;
  }[];
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
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function stationMatches(
  trelloName: string,
  displayName: string,
) {
  const trello = normalize(trelloName);
  const display = normalize(displayName);

  return (
    trello.includes(display) ||
    display.includes(trello)
  );
}

function shortStation(station: string) {
  return station
    .replace(
      "Station 1 & 2 (Layouting & Encoding)",
      "Station 1 & 2",
    )
    .replace(
      "Admin Head - (For Approval to Printing)",
      "Admin Head",
    )
    .replace(
      "Receiving & Pre-Print Formatting",
      "Pre-Print",
    )
    .replace(
      "Packaging & Labelling",
      "Packaging",
    );
}

function assignmentSignature(
  assignments: Assignment[],
) {
  return JSON.stringify(
    assignments.map((item) => ({
      station: item.station,
      jobs: item.jobs,
      primary: item.primary,
      support: item.support,
      status: item.status,
    })),
  );
}

export default function DailyOperationsPage() {
  const [employees, setEmployees] =
    useState<Employee[]>([]);

  const [attendance, setAttendance] =
    useState<Record<string, Status>>({});

  const [assignments, setAssignments] =
    useState<Assignment[]>([]);

  const [generatedAt, setGeneratedAt] =
    useState("");

  const [generating, setGenerating] =
    useState(false);

  const [dailyData, setDailyData] =
    useState<DailyOpsData>({
      stations: [],
      rushOrders: [],
    });

  const lastSavedSignatureRef =
    useRef("");

  const activeEmployees = useMemo(
    () =>
      employees.filter(
        (employee) =>
          employee.status
            ?.toString()
            .trim()
            .toLowerCase() ===
          "active",
      ),
    [employees],
  );

  const loadEmployees =
    useCallback(async () => {
      try {
        const response = await fetch(
          "/api/employees",
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          console.error(
            "Employee fetch failed:",
            response.status,
          );
          return;
        }

        const data =
          await response.json();

        const loadedEmployees =
          (data.employees ||
            []) as Employee[];

        setEmployees(loadedEmployees);

        const loadedActiveEmployees =
          loadedEmployees.filter(
            (employee) =>
              employee.status
                ?.toString()
                .trim()
                .toLowerCase() ===
              "active",
          );

        setAttendance(
          (currentAttendance) =>
            Object.fromEntries(
              loadedActiveEmployees.map(
                (employee) => [
                  employee.name,
                  currentAttendance[
                    employee.name
                  ] ??
                    (employee.employmentType
                      ?.toLowerCase() ===
                    "ojt"
                      ? "None"
                      : "Present"),
                ],
              ),
            ) as Record<
              string,
              Status
            >,
        );
      } catch (error) {
        console.error(
          "Employee fetch failed:",
          error,
        );
      }
    }, []);

  const loadDailyData =
    useCallback(async () => {
      try {
        const response = await fetch(
          "/api/daily-operations",
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          console.error(
            "Daily operations fetch failed:",
            response.status,
          );
          return;
        }

        const data =
          await response.json();

        setDailyData(data);
      } catch (error) {
        console.error(
          "Daily operations fetch failed:",
          error,
        );
      }
    }, []);

  const loadTodayAssignments =
    useCallback(async () => {
      try {
        const response = await fetch(
          "/api/daily-assignments",
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          console.error(
            "Daily assignments fetch failed:",
            response.status,
          );
          return;
        }

        const data =
          await response.json();

        if (
          data.assignments?.length >
          0
        ) {
          setAssignments(
            data.assignments,
          );

          setGeneratedAt(
            data.generatedAt || "",
          );

          lastSavedSignatureRef.current =
            assignmentSignature(
              data.assignments,
            );
        }
      } catch (error) {
        console.error(
          "Daily assignments fetch failed:",
          error,
        );
      }
    }, []);

  const loadAll =
    useCallback(async () => {
      await Promise.all([
        loadEmployees(),
        loadDailyData(),
        loadTodayAssignments(),
      ]);
    }, [
      loadEmployees,
      loadDailyData,
      loadTodayAssignments,
    ]);

  useEffect(() => {
    void loadAll();

    const interval =
      window.setInterval(() => {
        void loadDailyData();
      }, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadAll, loadDailyData]);

  function getStationJobsFromData(
    data: DailyOpsData,
    stationName: string,
  ) {
    return (
      data.stations.find(
        (station) =>
          stationMatches(
            station.name,
            stationName,
          ),
      )?.jobs || 0
    );
  }

  function getStationJobs(
    stationName: string,
  ) {
    return getStationJobsFromData(
      dailyData,
      stationName,
    );
  }

  function getStationLoads(
    data: DailyOpsData,
  ) {
    return DISPLAY_STATIONS.map(
      (station) => ({
        name: station,
        jobs: getStationJobsFromData(
          data,
          station,
        ),
      }),
    );
  }

  async function saveAssignments(
    nextAssignments: Assignment[],
  ) {
    const signature =
      assignmentSignature(
        nextAssignments,
      );

    if (
      signature ===
      lastSavedSignatureRef.current
    ) {
      return;
    }

    lastSavedSignatureRef.current =
      signature;

    const now =
      new Date().toLocaleString();

    setAssignments(nextAssignments);
    setGeneratedAt(now);

    try {
      const response = await fetch(
        "/api/daily-assignments",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            assignments:
              nextAssignments,
          }),
        },
      );

      if (!response.ok) {
        console.error(
          "Saving daily assignments failed:",
          response.status,
        );

        lastSavedSignatureRef.current =
          "";
      }
    } catch (error) {
      console.error(
        "Saving daily assignments failed:",
        error,
      );

      lastSavedSignatureRef.current =
        "";
    }
  }

  async function handleGenerateAssignments() {
    if (generating) {
      return;
    }

    try {
      setGenerating(true);

      const response = await fetch(
        "/api/daily-operations",
        {
          cache: "no-store",
        },
      );

      if (!response.ok) {
        console.error(
          "Daily operations refresh failed:",
          response.status,
        );
        return;
      }

      const latestData =
        (await response.json()) as DailyOpsData;

      setDailyData(latestData);

      const result =
        generateSmartAssignments({
          employees: activeEmployees,
          stations:
            getStationLoads(
              latestData,
            ),
          attendance,
        });

      await saveAssignments(
        result.assignments,
      );
    } catch (error) {
      console.error(
        "Assignment generation failed:",
        error,
      );
    } finally {
      setGenerating(false);
    }
  }

  function updateStatus(
    workerName: string,
    status: Status,
  ) {
    setAttendance((current) => ({
      ...current,
      [workerName]: status,
    }));
  }

  function resetDay() {
    const defaultAttendance =
      Object.fromEntries(
        activeEmployees.map(
          (employee) => [
            employee.name,
            employee.employmentType
              ?.toLowerCase() ===
            "ojt"
              ? "None"
              : "Present",
          ],
        ),
      ) as Record<string, Status>;

    setAttendance(
      defaultAttendance,
    );

    setAssignments([]);
    setGeneratedAt("");

    lastSavedSignatureRef.current =
      "";
  }

  const attendanceSummary =
    useMemo(() => {
      const values =
        Object.values(attendance);

      const present =
        values.filter(
          (value) =>
            value === "Present",
        ).length;

      const halfDay =
        values.filter(
          (value) =>
            value ===
              "Half-day AM" ||
            value ===
              "Half-day PM",
        ).length;

      const absent =
        values.filter(
          (value) =>
            value === "Absent",
        ).length;

      const none =
        values.filter(
          (value) =>
            value === "None",
        ).length;

      const available =
        present + halfDay;

      const total = Math.max(
        activeEmployees.length -
          none,
        0,
      );

      const coverage =
        total === 0
          ? 0
          : Math.round(
              (available / total) *
                100,
            );

      return {
        present,
        halfDay,
        absent,
        none,
        available,
        coverage,
      };
    }, [
      attendance,
      activeEmployees,
    ]);

  return (
    <AppShell
      activePage="daily-operations"
      contentWidth="wide"
    >
      <ProductionSyncRunner />

      <PageHeader
        eyebrow="Production"
        title="Daily Operations"
        description="Manage daily attendance, station workload, and smart manpower assignment based on employee skills."
      />

      {generatedAt && (
        <div
          role="status"
          className="mt-7 rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-sm font-bold text-green-800 shadow-sm"
        >
          Assignments saved for today.
          Last updated: {generatedAt}
        </div>
      )}

      <section className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="overflow-hidden rounded-2xl border border-[#e3d8c7] bg-white shadow-sm xl:col-span-2">
          <SectionHeader
            number="1"
            title="Attendance Management"
            description="Active employees are loaded from the Employee Database."
          >
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={resetDay}
                disabled={generating}
                className="inline-flex h-11 items-center justify-center rounded-lg border border-[#cfc1ae] bg-white px-5 text-sm font-black text-black transition hover:bg-[#f8f2e8] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reset Day
              </button>

              <button
                type="button"
                onClick={
                  handleGenerateAssignments
                }
                disabled={generating}
                className="inline-flex h-11 min-w-52 items-center justify-center rounded-lg bg-black px-5 text-sm font-black text-white transition hover:bg-[#6b421f] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generating
                  ? "Generating..."
                  : assignments.length
                    ? "Regenerate Assignments"
                    : "Generate Assignments"}
              </button>
            </div>
          </SectionHeader>

          <div className="p-5 sm:p-7">
            <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <MiniStat
                title="Present"
                value={
                  attendanceSummary.present
                }
              />

              <MiniStat
                title="Half-Day"
                value={
                  attendanceSummary.halfDay
                }
              />

              <MiniStat
                title="Absent"
                value={
                  attendanceSummary.absent
                }
              />

              <MiniStat
                title="Coverage"
                value={`${attendanceSummary.coverage}%`}
              />
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#eee5d8]">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-[#fbf7ef] text-[#5f5448]">
                  <tr>
                    <TableHeader>
                      Worker
                    </TableHeader>

                    <TableHeader>
                      Position
                    </TableHeader>

                    <TableHeader>
                      Employment Type
                    </TableHeader>

                    <TableHeader center>
                      Max Stations
                    </TableHeader>

                    <TableHeader>
                      Skills
                    </TableHeader>

                    <TableHeader>
                      Status
                    </TableHeader>
                  </tr>
                </thead>

                <tbody>
                  {activeEmployees.length ===
                  0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="border-t border-[#eee5d8] p-8 text-center text-[#6f6254]"
                      >
                        No active employees
                        found.
                      </td>
                    </tr>
                  ) : (
                    activeEmployees.map(
                      (employee) => (
                        <tr
                          key={
                            employee.employeeId
                          }
                          className="border-t border-[#eee5d8] transition hover:bg-[#fbf7ef]"
                        >
                          <td className="p-4 font-black text-black">
                            {employee.name}
                          </td>

                          <td className="p-4 text-[#5f5448]">
                            {employee.position}
                          </td>

                          <td className="p-4 text-[#5f5448]">
                            {employee.employmentType ||
                              "Full-time"}
                          </td>

                          <td className="p-4 text-center font-black text-black">
                            {employee.maxStations ||
                              1}
                          </td>

                          <td className="p-4">
                            <span className="inline-flex rounded-md border border-[#e3d8c7] bg-[#fbf7ef] px-3 py-1 text-xs font-bold text-[#5f5448]">
                              {(employee.skills ||
                                [])
                                .length}{" "}
                              skill(s)
                            </span>
                          </td>

                          <td className="p-4">
                            <select
                              value={
                                attendance[
                                  employee.name
                                ] ||
                                "Present"
                              }
                              onChange={(
                                event,
                              ) =>
                                updateStatus(
                                  employee.name,
                                  event
                                    .target
                                    .value as Status,
                                )
                              }
                              className="h-10 rounded-lg border border-[#d8cbb9] bg-white px-3 text-sm font-bold text-black outline-none transition focus:border-[#8b5e34] focus:ring-2 focus:ring-[#8b5e34]/10"
                            >
                              <option value="Present">
                                Present
                              </option>

                              <option value="Half-day AM">
                                Half-day AM
                              </option>

                              <option value="Half-day PM">
                                Half-day PM
                              </option>

                              <option value="Absent">
                                Absent
                              </option>

                              <option value="None">
                                None
                              </option>
                            </select>
                          </td>
                        </tr>
                      ),
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#e3d8c7] bg-white shadow-sm">
          <SectionHeader
            number="2"
            title="Production Load"
            description="Active Trello jobs per production station."
          />

          <div className="max-h-[760px] space-y-3 overflow-y-auto p-5 sm:p-7">
            {DISPLAY_STATIONS.map(
              (station) => {
                const jobs =
                  getStationJobs(
                    station,
                  );

                return (
                  <div
                    key={station}
                    className="flex items-center justify-between rounded-xl border border-[#e3d8c7] bg-[#fffdf9] px-4 py-3 transition hover:bg-[#fbf7ef]"
                  >
                    <span className="pr-4 text-sm font-black text-black">
                      {shortStation(
                        station,
                      )}
                    </span>

                    <span
                      className={`inline-flex min-w-9 items-center justify-center rounded-md px-3 py-1 text-xs font-black ${
                        jobs > 0
                          ? "bg-green-100 text-green-700"
                          : "bg-[#eee8df] text-[#74695d]"
                      }`}
                    >
                      {jobs}
                    </span>
                  </div>
                );
              },
            )}
          </div>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-[#e3d8c7] bg-white shadow-sm">
        <SectionHeader
          number="3"
          title="Station Assignments"
          description="Assignment is generated by the smart workforce engine using skills, attendance, employment type, and maximum station capacity."
        >
          {assignments.length > 0 && (
            <span className="inline-flex h-10 items-center rounded-lg border border-[#cfc1ae] bg-white px-4 text-sm font-black text-[#6b421f]">
              {assignments.length}{" "}
              station
              {assignments.length === 1
                ? ""
                : "s"}
            </span>
          )}
        </SectionHeader>

        <div className="p-5 sm:p-7">
          {assignments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#d8cbb9] bg-[#fbf7ef] p-6 text-center">
              <p className="text-sm font-black text-black">
                No assignments generated
                yet.
              </p>

              <p className="mt-2 text-sm text-[#6f6254]">
                Click Generate Assignments
                to compute today&apos;s
                station coverage.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#eee5d8]">
              <table className="w-full min-w-[1200px] text-left text-sm">
                <thead className="bg-[#fbf7ef] text-[#5f5448]">
                  <tr>
                    <TableHeader>
                      Station
                    </TableHeader>

                    <TableHeader center>
                      Jobs
                    </TableHeader>

                    <TableHeader>
                      Primary Worker
                    </TableHeader>

                    <TableHeader>
                      Support Worker
                    </TableHeader>

                    <TableHeader>
                      Coverage
                    </TableHeader>

                    <TableHeader>
                      Notes
                    </TableHeader>
                  </tr>
                </thead>

                <tbody>
                  {assignments.map(
                    (assignment) => (
                      <tr
                        key={
                          assignment.station
                        }
                        className="border-t border-[#eee5d8] transition hover:bg-[#fbf7ef]"
                      >
                        <td className="p-4 font-black text-black">
                          {shortStation(
                            assignment.station,
                          )}
                        </td>

                        <td className="p-4 text-center font-black text-black">
                          {assignment.jobs}
                        </td>

                        <td className="p-4 font-bold text-[#3f352a]">
                          {assignment.primary ||
                            "-"}
                        </td>

                        <td className="p-4 text-[#3f352a]">
                          {assignment.support ||
                            "-"}
                        </td>

                        <td className="p-4">
                          <CoverageBadge
                            status={
                              assignment.status
                            }
                          />
                        </td>

                        <td className="max-w-[360px] p-4 text-[#6f6254]">
                          {assignment.notes ||
                            "-"}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <footer className="mt-8 text-center text-xs text-[#7c6a56]">
        © 2026 LIC Printing Corporation.
        Production Management System.
      </footer>
    </AppShell>
  );
}

function SectionHeader({
  number,
  title,
  description,
  children,
}: {
  number: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 border-b border-[#eee5d8] bg-[#fbf7ef] px-5 py-4 sm:px-7 lg:flex-row lg:items-center">
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

      {children && (
        <div className="shrink-0">
          {children}
        </div>
      )}
    </div>
  );
}

function MiniStat({
  title,
  value,
}: {
  title: string;
  value: number | string;
}) {
  return (
    <article className="rounded-xl border border-[#e3d8c7] bg-[#fbf7ef] p-4">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6b421f]">
        {title}
      </p>

      <p className="mt-2 text-2xl font-black text-black">
        {value}
      </p>
    </article>
  );
}

function TableHeader({
  children,
  center = false,
}: {
  children: ReactNode;
  center?: boolean;
}) {
  return (
    <th
      className={`p-4 text-xs font-black uppercase tracking-wide ${
        center ? "text-center" : ""
      }`}
    >
      {children}
    </th>
  );
}

function CoverageBadge({
  status,
}: {
  status: string;
}) {
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
              ? "bg-[#f3eadc] text-[#6b421f]"
              : "bg-red-100 text-red-700";

  return (
    <span
      className={`inline-flex rounded-md px-3 py-1 text-xs font-black ${style}`}
    >
      {status}
    </span>
  );
}