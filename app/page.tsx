import AppShell from "./components/AppShell";
import PageHeader from "./components/PageHeader";
import ProductionSyncRunner from "./components/ProductionSyncRunner";

type TrelloCard = {
  id: string;
  name: string;
  desc: string;
  url: string;
  dateLastActivity?: string;
};

type TrelloList = {
  id: string;
  name: string;
  cards: TrelloCard[];
};

type TrackerRow = {
  id: string;
  trackingNo: string;
  atpId: string;
  businessName: string;
  orderPriority: string;
  currentStation: string;
  dueDate: string;
  daysRemaining: number;
  url: string;
};

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const COMPLETED_LISTS = ["DELIVERED BY LIC", "PICKED UP BY CLIENT"];

async function getLists() {
  const res = await fetch(`${BASE_URL}/api/trello/lists`, {
    cache: "no-store",
  });

  if (!res.ok) return [];

  const data = await res.json();
  return data.lists as TrelloList[];
}

async function getTrackerRows() {
  const res = await fetch(`${BASE_URL}/api/production-tracker`, {
    cache: "no-store",
  });

  if (!res.ok) return [];

  const data = await res.json();
  return data.rows as TrackerRow[];
}

function getStatus(count: number) {
  if (count <= 5) return { label: "Low", color: "bg-green-100 text-green-700" };
  if (count <= 10)
    return { label: "Medium", color: "bg-amber-100 text-amber-700" };

  return { label: "High", color: "bg-red-100 text-red-700" };
}

function isSameList(listName: string, target: string) {
  return listName.trim().toUpperCase() === target.trim().toUpperCase();
}

function getListCount(lists: TrelloList[], target: string) {
  return lists.find((list) => isSameList(list.name, target))?.cards.length || 0;
}

function isWithinLast7Days(dateString?: string) {
  if (!dateString) return false;

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return false;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return date >= sevenDaysAgo;
}

export default async function Home() {
  const lists = await getLists();
  const trackerRows = await getTrackerRows();

  const atpWaiting = getListCount(lists, "ATP Intake");
  const nonBirWaiting = getListCount(lists, "Non-BIR Intake");

  const readyForRelease = getListCount(lists, "Ready for Release");

  const weeklyReleased = lists
    .filter((list) =>
      COMPLETED_LISTS.some((item) => list.name.toUpperCase().includes(item)),
    )
    .reduce((sum, list) => {
      const releasedThisWeek = list.cards.filter((card) =>
        isWithinLast7Days(card.dateLastActivity),
      ).length;

      return sum + releasedThisWeek;
    }, 0);

  const activeJobs = trackerRows.filter(
    (row) =>
      !row.currentStation.toUpperCase().includes("READY FOR RELEASE") &&
      !row.currentStation.toUpperCase().includes("DELIVERED") &&
      !row.currentStation.toUpperCase().includes("PICKED UP"),
  ).length;

  const rushJobs = trackerRows.filter(
    (row) => row.orderPriority?.toLowerCase() === "rush",
  );

  const dueToday = trackerRows.filter((row) => row.daysRemaining === 0);
  const overdue = trackerRows.filter((row) => row.daysRemaining < 0);

  const stationLoads = trackerRows
    .filter(
      (row) =>
        !row.currentStation.toUpperCase().includes("READY FOR RELEASE") &&
        !row.currentStation.toUpperCase().includes("DELIVERED") &&
        !row.currentStation.toUpperCase().includes("PICKED UP"),
    )
    .reduce(
      (acc, row) => {
        acc[row.currentStation] = (acc[row.currentStation] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

  const topBusyStations = Object.entries(stationLoads)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const urgentOrders = [...overdue, ...dueToday, ...rushJobs]
    .filter(
      (row, index, arr) =>
        arr.findIndex((item) => item.id === row.id) === index,
    )
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
    .slice(0, 8);

  return (
    <AppShell activePage="dashboard" contentWidth="wide">
      <ProductionSyncRunner />
      <PageHeader
        title="Production Management Dashboard"
        description="Monitor production movement, due dates, manpower assignment, station workload, and release readiness."
      />

      <section className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-4">
        <KpiCard
          title="Active Jobs"
          value={activeJobs}
          subtitle="In production"
        />
        <KpiCard
          title="Weekly Released"
          value={weeklyReleased}
          subtitle="Released this week"
        />
        <KpiCard
          title="Due Today"
          value={dueToday.length}
          subtitle="Needs attention"
        />
        <KpiCard
          title="Overdue"
          value={overdue.length}
          subtitle="Past due date"
        />
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
        <KpiCard
          title="ATP Waiting"
          value={atpWaiting}
          subtitle="Waiting for production details"
        />
        <KpiCard
          title="Non-BIR Waiting"
          value={nonBirWaiting}
          subtitle="Waiting for production details"
        />
        <KpiCard
          title="Ready for Release"
          value={readyForRelease}
          subtitle="For final release"
        />
        <KpiCard
          title="Rush Jobs"
          value={rushJobs.length}
          subtitle="High priority"
        />
      </section>

      <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="rounded-xl border border-[#e6ddd1] bg-white p-6 shadow-sm xl:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-bold">Production Station Load</h2>

            <span className="rounded-lg border border-[#e6ddd1] px-4 py-2 text-sm text-[#6f6254]">
              Total in Production: {activeJobs}
            </span>
          </div>

          <div className="overflow-hidden rounded-lg border border-[#eee4d6]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#fbf7ef] text-[#5f5448]">
                <tr>
                  <th className="p-4">Station</th>
                  <th className="p-4 text-center">Jobs</th>
                  <th className="p-4">Load</th>
                </tr>
              </thead>

              <tbody>
                {Object.keys(stationLoads).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-4 text-[#6f6254]">
                      No active production jobs.
                    </td>
                  </tr>
                ) : (
                  Object.entries(stationLoads).map(([station, count]) => {
                    const status = getStatus(count);

                    return (
                      <tr key={station} className="border-t border-[#eee4d6]">
                        <td className="p-4 font-semibold">{station}</td>
                        <td className="p-4 text-center font-bold">{count}</td>
                        <td className="p-4">
                          <span
                            className={`rounded-md px-3 py-1 text-xs font-bold ${status.color}`}
                          >
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-[#e6ddd1] bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-bold">Top Busy Stations</h2>

          <div className="space-y-3">
            {topBusyStations.length === 0 ? (
              <p className="rounded-lg bg-[#fbf7ef] p-4 text-sm text-[#6f6254]">
                No busy stations yet.
              </p>
            ) : (
              topBusyStations.map(([station, count]) => {
                const status = getStatus(count);

                return (
                  <div
                    key={station}
                    className="flex items-center justify-between rounded-lg border border-[#eee4d6] p-4"
                  >
                    <div>
                      <p className="font-bold">{station}</p>
                      <p className="text-sm">{count} jobs</p>
                    </div>

                    <span
                      className={`rounded-md px-3 py-1 text-xs font-bold ${status.color}`}
                    >
                      {status.label}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-xl border border-[#e6ddd1] bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-bold">Urgent Orders</h2>

        <div className="overflow-hidden rounded-lg border border-[#eee4d6]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#fbf7ef] text-[#5f5448]">
              <tr>
                <th className="p-4">Tracking No.</th>
                <th className="p-4">Business Name</th>
                <th className="p-4">Priority</th>
                <th className="p-4">Station</th>
                <th className="p-4">Due Date</th>
                <th className="p-4">Days Left</th>
              </tr>
            </thead>

            <tbody>
              {urgentOrders.length === 0 ? (
                <tr>
                  <td className="p-4 text-[#6f6254]" colSpan={6}>
                    No urgent orders.
                  </td>
                </tr>
              ) : (
                urgentOrders.map((row) => (
                  <tr key={row.id} className="border-t border-[#eee4d6]">
                    <td className="p-4 font-bold">
                      <a
                        href={`/production/${row.id}`}
                        className="text-[#9b6a22] hover:underline"
                      >
                        {row.trackingNo || "-"}
                      </a>
                    </td>

                    <td className="p-4">{row.businessName}</td>

                    <td className="p-4">
                      <span
                        className={`rounded-md px-3 py-1 text-xs font-bold ${
                          row.orderPriority === "Rush"
                            ? "bg-red-100 text-red-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {row.orderPriority}
                      </span>
                    </td>

                    <td className="p-4">{row.currentStation}</td>
                    <td className="p-4">{row.dueDate || "-"}</td>

                    <td className="p-4 font-bold">
                      {row.daysRemaining < 0 ? (
                        <span className="text-red-600">Overdue</span>
                      ) : row.daysRemaining === 0 ? (
                        <span className="text-orange-600">Today</span>
                      ) : (
                        <span>{row.daysRemaining} day(s)</span>
                      )}
                    </td>
                  </tr>
                ))
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

function KpiCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: number;
  subtitle: string;
}) {
  return (
    <div className="rounded-lg border border-[#e6ddd1] bg-white p-6 shadow-sm">
      <p className="text-sm font-bold text-black">{title}</p>
      <p className="mt-3 text-4xl font-black leading-none text-black">
        {value}
      </p>
      <p className="mt-3 text-sm text-[#6f6254]">{subtitle}</p>
    </div>
  );
}
