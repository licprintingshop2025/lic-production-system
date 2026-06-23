
type TrelloCard = {
  id: string;
  name: string;
  desc: string;
  url: string;
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
  if (count === 0) {
    return {
      label: "No Active Job",
      color: "bg-zinc-600",
      text: "text-zinc-400",
    };
  }

  if (count <= 5) {
    return {
      label: "Low",
      color: "bg-green-500",
      text: "text-green-400",
    };
  }

  if (count <= 10) {
    return {
      label: "Moderate",
      color: "bg-yellow-400",
      text: "text-yellow-400",
    };
  }

  if (count <= 20) {
    return {
      label: "Heavy",
      color: "bg-orange-500",
      text: "text-orange-400",
    };
  }

  return {
    label: "Critical",
    color: "bg-red-500",
    text: "text-red-400",
  };
}

const COMPLETED_LISTS = ["DELIVERED", "PICKED UP"];

export default async function Home() {
  const lists = await getLists();
  const trackerRows = await getTrackerRows();

  const atpIntake =
    lists.find((list) => list.name.toUpperCase().includes("ATP INTAKE"))?.cards
      .length || 0;

  const readyForRelease =
    lists.find((list) =>
      list.name.toUpperCase().includes("READY FOR RELEASE")
    )?.cards.length || 0;

  const completedJobs = lists
    .filter((list) =>
      COMPLETED_LISTS.some((item) =>
        list.name.toUpperCase().includes(item)
      )
    )
    .reduce((sum, list) => sum + list.cards.length, 0);

  const inProduction = trackerRows.length;

  const rushOrders = trackerRows.filter(
    (row) => row.orderPriority?.toLowerCase() === "rush"
  );

  const dueToday = trackerRows.filter((row) => row.daysRemaining === 0);
  const dueSoon = trackerRows.filter(
    (row) => row.daysRemaining > 0 && row.daysRemaining <= 3
  );
  const overdue = trackerRows.filter((row) => row.daysRemaining < 0);

  const stationLoads = trackerRows.reduce((acc, row) => {
    acc[row.currentStation] = (acc[row.currentStation] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const bottlenecks = Object.entries(stationLoads)
    .filter(([, count]) => count >= 10)
    .sort((a, b) => b[1] - a[1]);

  const urgentOrders = [...overdue, ...dueToday, ...dueSoon, ...rushOrders]
    .filter((row, index, arr) => arr.findIndex((item) => item.id === row.id) === index)
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
    .slice(0, 8);

  return (
    <main className="min-h-screen bg-[#070A0F] text-white">
      <div className="flex">
        <aside className="hidden min-h-screen w-64 border-r border-zinc-800 bg-[#0D1118] p-6 lg:block">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-yellow-400 px-3 py-2 text-xl font-black text-yellow-400">
              LIC
            </div>

            <div>
              <h2 className="font-bold text-yellow-400">LIC Production</h2>
              <p className="text-xs text-zinc-400">Management System</p>
            </div>
          </div>

          <nav className="mt-10 space-y-2 text-sm">
            <NavItem active label="Dashboard" href="/" />
            <NavItem label="Received ATP" href="/received-atp" />
            <NavItem label="Production Queue" href="/production" />
            <NavItem label="Production Tracker" href="/production-tracker" />
            <NavItem label="Production Board" href="/production-board" />
            <NavItem label="Daily Operations" href="/daily-operations" />
          </nav>

          <div className="mt-20 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <p className="text-xs text-zinc-500">System Status</p>
            <p className="mt-2 font-semibold text-green-400">● Connected</p>
            <p className="mt-1 text-xs text-zinc-500">Trello API Active</p>
          </div>
        </aside>

        <section className="flex-1 p-6 lg:p-8">
          <header className="flex flex-col justify-between gap-4 border-b border-zinc-800 pb-6 md:flex-row md:items-center">
            <div>
              <h1 className="text-3xl font-bold text-yellow-400">
                LIC Production System
              </h1>
              <p className="text-sm text-zinc-400">
                PSMA-DSS Management Dashboard
              </p>
            </div>

            <div className="flex flex-col items-end gap-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-400">
                Last Updated: {new Date().toLocaleString()}
              </div>

            </div>
          </header>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-4">
            <SummaryCard title="In Production" value={inProduction} color="text-blue-400" />
            <SummaryCard title="ATP Intake" value={atpIntake} color="text-yellow-400" />
            <SummaryCard title="Rush Orders" value={rushOrders.length} color="text-red-400" />
            <SummaryCard title="Ready For Release" value={readyForRelease} color="text-green-400" />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
            <SummaryCard title="Completed Jobs" value={completedJobs} color="text-green-400" />
            <SummaryCard title="Due Today" value={dueToday.length} color="text-orange-400" />
            <SummaryCard title="Due Soon" value={dueSoon.length} color="text-yellow-400" />
            <SummaryCard title="Overdue" value={overdue.length} color="text-red-500" />
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
            <section className="rounded-2xl border border-zinc-800 bg-[#0D1118] p-6 xl:col-span-2">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-bold">Production Station Load</h2>
                <p className="text-sm text-zinc-500">
                  Total In Production: {inProduction}
                </p>
              </div>

              <div className="overflow-hidden rounded-xl border border-zinc-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-900 text-zinc-400">
                    <tr>
                      <th className="p-4">Station</th>
                      <th className="p-4 text-center">Jobs</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {Object.keys(stationLoads).length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-4 text-zinc-400">
                          No active production jobs.
                        </td>
                      </tr>
                    ) : (
                      Object.entries(stationLoads).map(([station, count]) => {
                        const status = getStatus(count);

                        return (
                          <tr key={station} className="border-t border-zinc-800">
                            <td className="p-4 font-medium">{station}</td>

                            <td className="p-4 text-center">
                              <span
                                className={`rounded-md px-3 py-1 font-bold text-black ${status.color}`}
                              >
                                {count}
                              </span>
                            </td>

                            <td className="p-4">
                              <span className="flex items-center gap-2">
                                <span
                                  className={`h-2 w-2 rounded-full ${status.color}`}
                                />
                                <span className={status.text}>
                                  {status.label}
                                </span>
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-[#0D1118] p-6">
              <h2 className="mb-4 text-lg font-bold">Bottleneck Detection</h2>

              <div className="space-y-3">
                {bottlenecks.length === 0 ? (
                  <p className="rounded-xl bg-zinc-950 p-4 text-sm text-zinc-400">
                    No bottleneck detected.
                  </p>
                ) : (
                  bottlenecks.slice(0, 6).map(([station, count]) => (
                    <div
                      key={station}
                      className="rounded-xl border border-orange-500/40 bg-zinc-950 p-4"
                    >
                      <div className="flex justify-between gap-3">
                        <p className="text-sm font-semibold">{station}</p>
                        <span className="rounded-md bg-orange-500 px-3 py-1 text-xs font-bold text-black">
                          {count}
                        </span>
                      </div>

                      <p className="mt-2 text-xs text-zinc-500">
                        High queue volume. Check manpower assignment.
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <section className="mt-8 rounded-2xl border border-zinc-800 bg-[#0D1118] p-6">
            <h2 className="mb-4 text-xl font-bold">Urgent Orders</h2>

            <div className="overflow-hidden rounded-xl border border-zinc-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-900 text-zinc-400">
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
                      <td className="p-4 text-zinc-400" colSpan={6}>
                        No urgent orders.
                      </td>
                    </tr>
                  ) : (
                    urgentOrders.map((row) => (
                      <tr key={row.id} className="border-t border-zinc-800">
                        <td className="p-4 font-bold">
                          <a
                            href={`/production/${row.id}`}
                            className="text-yellow-400 hover:underline"
                          >
                            {row.trackingNo || "-"}
                          </a>
                        </td>

                        <td className="p-4">{row.businessName}</td>

                        <td className="p-4">
                          <span
                            className={`rounded-md px-2 py-1 text-xs font-bold ${
                              row.orderPriority === "Rush"
                                ? "bg-red-500 text-white"
                                : "bg-green-500 text-black"
                            }`}
                          >
                            {row.orderPriority}
                          </span>
                        </td>

                        <td className="p-4">{row.currentStation}</td>
                        <td className="p-4">{row.dueDate}</td>

                        <td className="p-4 font-bold">
                          {row.daysRemaining < 0 ? (
                            <span className="text-red-500">Overdue</span>
                          ) : row.daysRemaining === 0 ? (
                            <span className="text-orange-400">Today</span>
                          ) : (
                            <span className="text-yellow-400">
                              {row.daysRemaining}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </section>
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
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#0D1118] p-5">
      <p className="text-sm text-zinc-400">{title}</p>
      <h2 className={`mt-2 text-4xl font-bold ${color}`}>{value}</h2>
    </div>
  );
}

function NavItem({
  label,
  href,
  active = false,
}: {
  label: string;
  href: string;
  active?: boolean;
}) {
  return (
    <a
      href={href}
      className={`block rounded-lg px-4 py-3 ${
        active
          ? "bg-yellow-400 text-black"
          : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
      }`}
    >
      {label}
    </a>
  );
}