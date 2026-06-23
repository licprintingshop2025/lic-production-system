"use client";

import { useEffect, useMemo, useState } from "react";
import {
  workers,
  primaryAssignments,
  workerSkills,
  productionStations,
} from "@/lib/workers";

type Status = "Present" | "Half-day AM" | "Half-day PM" | "Absent" | "None";

type Assignment = {
  station: string;
  primary: string;
  support: string;
  status: string;
  notes: string;
  jobs: number;
};

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

const WIP_LIMIT = 20;

function getTodayKey() {
  return new Date().toISOString().split("T")[0];
}

function getStorageKey() {
  return `daily-operations-${getTodayKey()}`;
}

function getStationSnapshot(stations: DailyOpsData["stations"]) {
  return JSON.stringify(
    stations.map((station) => ({
      name: station.name,
      jobs: station.jobs,
    }))
  );
}

export default function DailyOperationsPage() {
  const [attendance, setAttendance] = useState<Record<string, Status>>(
    Object.fromEntries(
      workers.map((worker) => [
        worker.name,
        worker.name === "OJT" ? "None" : "Present",
      ])
    )
  );

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [generatedAt, setGeneratedAt] = useState("");
  const [dailyData, setDailyData] = useState<DailyOpsData>({
    stations: [],
    rushOrders: [],
  });
  const [loadedSavedData, setLoadedSavedData] = useState(false);

  useEffect(() => {
    loadDailyData();

    const interval = setInterval(() => {
      loadDailyData();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(getStorageKey());

    if (saved) {
      const parsed = JSON.parse(saved);
      setAttendance(parsed.attendance || attendance);
      setAssignments(parsed.assignments || []);
      setGeneratedAt(parsed.generatedAt || "");
    }

    setLoadedSavedData(true);
  }, []);

  useEffect(() => {
    if (!loadedSavedData) return;
    if (!dailyData.stations.length) return;

    const saved = localStorage.getItem(getStorageKey());
    if (!saved) return;

    const parsed = JSON.parse(saved);
    const oldSnapshot = parsed.stationSnapshot || "";
    const newSnapshot = getStationSnapshot(dailyData.stations);

    if (oldSnapshot && oldSnapshot !== newSnapshot) {
      generateAssignments(true);
    }
  }, [dailyData, loadedSavedData]);

  async function loadDailyData() {
    const res = await fetch("/api/daily-operations", {
      cache: "no-store",
    });

    if (!res.ok) return;

    const data = await res.json();
    setDailyData(data);
  }

  const attendanceSummary = useMemo(() => {
    const values = Object.values(attendance);

    const present = values.filter((v) => v === "Present").length;
    const halfDay = values.filter(
      (v) => v === "Half-day AM" || v === "Half-day PM"
    ).length;
    const absent = values.filter((v) => v === "Absent").length;
    const none = values.filter((v) => v === "None").length;

    const activeWorkers = present + halfDay;
    const totalWorkers = workers.length - none;

    const coverage =
      totalWorkers === 0 ? 0 : Math.round((activeWorkers / totalWorkers) * 100);

    return {
      present,
      halfDay,
      absent,
      none,
      coverage,
      activeWorkers,
    };
  }, [attendance]);

  const workerUtilization = useMemo(() => {
    const load: Record<string, number> = {};

    assignments.forEach((assignment) => {
      if (assignment.primary !== "—") {
        load[assignment.primary] = (load[assignment.primary] || 0) + 1;
      }

      if (assignment.support !== "—") {
        load[assignment.support] = (load[assignment.support] || 0) + 1;
      }
    });

    return Object.entries(load).sort((a, b) => b[1] - a[1]);
  }, [assignments]);

  const capacityStatus =
    attendanceSummary.activeWorkers >= 7
      ? "High"
      : attendanceSummary.activeWorkers >= 5
      ? "Moderate"
      : "Low";

  function saveTodayAssignment(
    newAttendance: Record<string, Status>,
    newAssignments: Assignment[]
  ) {
    const now = new Date().toLocaleString();

    localStorage.setItem(
      getStorageKey(),
      JSON.stringify({
        date: getTodayKey(),
        attendance: newAttendance,
        assignments: newAssignments,
        generatedAt: now,
        stationSnapshot: getStationSnapshot(dailyData.stations),
      })
    );

    setGeneratedAt(now);
  }

  function updateStatus(workerName: string, status: Status) {
    const updated = {
      ...attendance,
      [workerName]: status,
    };

    setAttendance(updated);
  }

  function getStationJobs(stationName: string) {
    return (
      dailyData.stations.find((station) =>
        station.name.toUpperCase().includes(stationName.toUpperCase())
      )?.jobs || 0
    );
  }

  function isAvailable(workerName: string) {
    const status = attendance[workerName];

    return (
      status === "Present" ||
      status === "Half-day AM" ||
      status === "Half-day PM"
    );
  }

  function generateAssignments(isAutoRegenerate = false) {
    const workerLoad: Record<string, number> = {};

    const result = productionStations.map((station) => {
      const primary = primaryAssignments[station];
      const primaryStatus = attendance[primary];
      const jobs = getStationJobs(station);

      if (jobs === 0) {
        return {
          station,
          primary: "—",
          support: "—",
          jobs,
          status: "No Active Job",
          notes: "No active job in this station today.",
        };
      }

      if (primary && isAvailable(primary)) {
        workerLoad[primary] = (workerLoad[primary] || 0) + 1;

        if (primaryStatus === "Half-day AM" || primaryStatus === "Half-day PM") {
          const support = findSupportWorker(station, primary, workerLoad);

          if (support) {
            workerLoad[support] = (workerLoad[support] || 0) + 1;

            return {
              station,
              primary,
              support,
              jobs,
              status: "✅ Covered",
              notes: `${primary} is ${primaryStatus}; ${support} assigned as support.`,
            };
          }

          return {
            station,
            primary,
            support: "—",
            jobs,
            status: "⚠️ Partial Coverage",
            notes: `${primary} is ${primaryStatus}. No support available.`,
          };
        }

        return {
          station,
          primary,
          support: "—",
          jobs,
          status: "✅ Covered",
          notes: `${primary} assigned as primary worker.${
            isAutoRegenerate ? " Auto-updated due to production load change." : ""
          }`,
        };
      }

      const support = findSupportWorker(station, primary, workerLoad);

      if (support) {
        workerLoad[support] = (workerLoad[support] || 0) + 1;

        return {
          station,
          primary: "—",
          support,
          jobs,
          status: "⚠️ Support Assigned",
          notes: `${primary} unavailable. ${support} assigned as substitute.`,
        };
      }

      return {
        station,
        primary: "—",
        support: "—",
        jobs,
        status: "⛔ No Coverage",
        notes: `${primary} unavailable. No qualified worker found.`,
      };
    });

    setAssignments(result);
    saveTodayAssignment(attendance, result);
  }

  function findSupportWorker(
    station: string,
    excludeWorker: string,
    workerLoad: Record<string, number>
  ) {
    const availableWorkers = workers
      .filter((worker) => worker.name !== excludeWorker)
      .filter((worker) => isAvailable(worker.name))
      .filter((worker) => {
        const skills = workerSkills[worker.name] || [];
        return skills.includes(station);
      })
      .sort((a, b) => (workerLoad[a.name] || 0) - (workerLoad[b.name] || 0));

    return availableWorkers[0]?.name || "";
  }

  function resetAttendance() {
    const defaultAttendance = Object.fromEntries(
      workers.map((worker) => [
        worker.name,
        worker.name === "OJT" ? "None" : "Present",
      ])
    ) as Record<string, Status>;

    setAttendance(defaultAttendance);
    setAssignments([]);
    setGeneratedAt("");
    localStorage.removeItem(getStorageKey());
  }

  return (
    <main className="min-h-screen bg-[#070A0F] p-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-zinc-800 pb-6">
          <h1 className="text-3xl font-bold text-yellow-400">
            Daily Operations
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Attendance, production load, WIP monitoring, station coverage, and
            worker utilization.
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Date Today: {new Date().toLocaleDateString()}
          </p>
        </header>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-5">
          <SummaryCard
            title="Present"
            value={attendanceSummary.present}
            color="text-green-400"
          />
          <SummaryCard
            title="Half-Day"
            value={attendanceSummary.halfDay}
            color="text-yellow-400"
          />
          <SummaryCard
            title="Absent"
            value={attendanceSummary.absent}
            color="text-red-400"
          />
          <SummaryCard
            title="Coverage"
            value={`${attendanceSummary.coverage}%`}
            color="text-blue-400"
          />
          <SummaryCard
            title="Capacity"
            value={capacityStatus}
            color="text-yellow-400"
          />
        </div>

        {generatedAt && (
          <div className="mt-5 rounded-xl border border-green-800 bg-green-950/30 p-4 text-sm text-green-300">
            Assignments saved for today. Last updated: {generatedAt}
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <section className="rounded-2xl border border-zinc-800 bg-[#0D1118] p-6 xl:col-span-2">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold">Attendance</h2>

              <div className="flex gap-3">
                <button
                  onClick={resetAttendance}
                  className="rounded-xl border border-zinc-700 px-5 py-2 text-sm font-bold text-zinc-300 hover:bg-zinc-900"
                >
                  Reset Day
                </button>

                <button
                  onClick={() => generateAssignments(false)}
                  className="rounded-xl bg-yellow-400 px-5 py-2 text-sm font-bold text-black hover:bg-yellow-300"
                >
                  {assignments.length > 0
                    ? "Regenerate Assignments"
                    : "Generate Assignments"}
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-zinc-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-black text-yellow-400">
                  <tr>
                    <th className="p-4">Worker</th>
                    <th className="p-4">Position</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {workers.map((worker) => (
                    <tr key={worker.name} className="border-t border-zinc-800">
                      <td className="p-4 font-bold">{worker.name}</td>
                      <td className="p-4 text-zinc-300">{worker.position}</td>
                      <td className="p-4">
                        <select
                          value={attendance[worker.name]}
                          onChange={(e) =>
                            updateStatus(worker.name, e.target.value as Status)
                          }
                          className="rounded-lg border border-zinc-700 bg-zinc-900 p-2 outline-none focus:border-yellow-400"
                        >
                          <option>Present</option>
                          <option>Half-day AM</option>
                          <option>Half-day PM</option>
                          <option>Absent</option>
                          <option>None</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-[#0D1118] p-6">
            <h2 className="mb-4 text-lg font-bold">Production Load</h2>

            <div className="space-y-3">
              {productionStations.map((station) => {
                const jobs = getStationJobs(station);

                return (
                  <div
                    key={station}
                    className="flex items-center justify-between rounded-xl bg-zinc-950 p-4"
                  >
                    <span className="text-sm">{station}</span>
                    <span
                      className={`rounded-md px-3 py-1 text-xs font-bold text-black ${
                        jobs === 0
                          ? "bg-zinc-500"
                          : jobs <= 5
                          ? "bg-green-500"
                          : jobs <= 10
                          ? "bg-yellow-400"
                          : "bg-red-500"
                      }`}
                    >
                      {jobs}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-[#0D1118] p-6">
          <h2 className="mb-4 text-lg font-bold">WIP Monitor</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {productionStations.map((station) => {
              const jobs = getStationJobs(station);
              const percent = (jobs / WIP_LIMIT) * 100;

              return (
                <div key={station} className="rounded-xl bg-zinc-950 p-4">
                  <div className="mb-2 flex justify-between gap-3">
                    <span className="text-sm font-medium">{station}</span>
                    <span className="text-xs text-zinc-400">
                      {jobs}/{WIP_LIMIT}
                    </span>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className={`h-full rounded-full ${
                        percent >= 100
                          ? "bg-red-500"
                          : percent >= 80
                          ? "bg-yellow-400"
                          : "bg-green-500"
                      }`}
                      style={{
                        width: `${Math.min(percent, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-[#0D1118] p-6">
          <h2 className="mb-5 text-xl font-bold">Station Assignments</h2>

          {assignments.length === 0 ? (
            <p className="rounded-xl bg-zinc-950 p-5 text-zinc-400">
              Click Generate Assignments to compute and save today's station
              coverage.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-black text-yellow-400">
                  <tr>
                    <th className="p-4">Station</th>
                    <th className="p-4">Jobs</th>
                    <th className="p-4">Primary Worker</th>
                    <th className="p-4">Support Worker</th>
                    <th className="p-4">Coverage Status</th>
                    <th className="p-4">Notes</th>
                  </tr>
                </thead>

                <tbody>
                  {assignments.map((assignment) => (
                    <tr
                      key={assignment.station}
                      className="border-t border-zinc-800"
                    >
                      <td className="p-4 font-bold">{assignment.station}</td>
                      <td className="p-4">{assignment.jobs}</td>
                      <td className="p-4">{assignment.primary}</td>
                      <td className="p-4">{assignment.support}</td>
                      <td className="p-4 font-bold">{assignment.status}</td>
                      <td className="p-4 text-zinc-300">{assignment.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border border-zinc-800 bg-[#0D1118] p-6">
            <h2 className="mb-4 text-lg font-bold">Worker Utilization</h2>

            {workerUtilization.length === 0 ? (
              <p className="rounded-xl bg-zinc-950 p-5 text-zinc-400">
                Generate assignments to view worker utilization.
              </p>
            ) : (
              <div className="space-y-3">
                {workerUtilization.map(([worker, count]) => (
                  <div
                    key={worker}
                    className="flex items-center justify-between rounded-xl bg-zinc-950 p-4"
                  >
                    <span>{worker}</span>
                    <span className="rounded-md bg-green-500 px-3 py-1 text-xs font-bold text-black">
                      {count} station(s)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-[#0D1118] p-6">
            <h2 className="mb-4 text-lg font-bold">Rush Orders</h2>

            {dailyData.rushOrders.length === 0 ? (
              <p className="rounded-xl bg-zinc-950 p-5 text-zinc-400">
                No rush orders detected.
              </p>
            ) : (
              <div className="space-y-3">
                {dailyData.rushOrders.map((order, index) => (
                  <div
                    key={`${order.name}-${index}`}
                    className="rounded-xl border border-red-500/40 bg-red-950/30 p-4"
                  >
                    <p className="font-bold text-red-300">{order.name}</p>
                    <p className="mt-1 text-xs text-zinc-400">
                      Current Station: {order.station}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function SummaryCard({
  title,
  value,
  color,
}: {
  title: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#0D1118] p-5">
      <p className="text-sm text-zinc-400">{title}</p>
      <h2 className={`mt-2 text-3xl font-bold ${color}`}>{value}</h2>
    </div>
  );
}