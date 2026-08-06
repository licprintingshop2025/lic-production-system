import AppShell from "./components/AppShell";
import PageHeader from "./components/PageHeader";
import ProductionSyncRunner from "./components/ProductionSyncRunner";
import {
  formatProductionVolume,
  getDashboardProductionVolume,
} from "@/lib/dashboardAnalytics";
import { requireSiteAuth } from "@/lib/siteAuth";
import Link from "next/link";
import type { ReactNode } from "react";

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
  orderQuantity: number;
  orderPriority: string;
  currentStation: string;
  currentDueDate?: string;
  dueDate: string;
  daysRemaining: number;
  url: string;
};

type TransactionStatus =
  | "Pending"
  | "In Progress"
  | "On Hold"
  | "Completed";

type TransactionRecord = {
  rowNumber: number;
  transactionNo: string;
  taxpayerName: string;
  businessName: string;
  status: TransactionStatus;
  currentStage: string;
  trelloCardUrl: string;
};

type TransactionsResponse = {
  success?: boolean;
  transactions?: TransactionRecord[];
  data?: TransactionRecord[];
};

type PriorityItem =
  | {
      id: string;
      type: "production";
      reference: string;
      businessName: string;
      stage: string;
      reason:
        | "Overdue"
        | "Due Today"
        | "Rush"
        | "Ready for Release";
      daysRemaining: number;
      href: string;
    }
  | {
      id: string;
      type: "transaction";
      reference: string;
      businessName: string;
      stage: string;
      reason: "On Hold ATP";
      daysRemaining: number;
      href: string;
    };

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

const COMPLETED_LISTS = [
  "DELIVERED BY LIC",
  "PICKED UP BY CLIENT",
];

const PRODUCTION_FLOW = [
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

async function getLists(): Promise<TrelloList[]> {
  const response = await fetch(
    `${BASE_URL}/api/trello/lists`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as {
    lists?: TrelloList[];
  };

  return Array.isArray(data.lists)
    ? data.lists
    : [];
}

async function getTrackerRows(): Promise<TrackerRow[]> {
  const response = await fetch(
    `${BASE_URL}/api/production-tracker`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as {
    rows?: TrackerRow[];
  };

  return Array.isArray(data.rows)
    ? data.rows
    : [];
}

async function getTransactions(): Promise<
  TransactionRecord[]
> {
  const response = await fetch(
    `${BASE_URL}/api/transactions`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return [];
  }

  const data =
    (await response.json()) as TransactionsResponse;

  const transactions =
    data.transactions || data.data || [];

  return Array.isArray(transactions)
    ? transactions
    : [];
}

function normalize(value: string) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/&/g, "AND")
    .replace(/[^A-Z0-9]/g, "");
}

function stationMatches(
  currentStation: string,
  targetStation: string,
) {
  const current = normalize(currentStation);
  const target = normalize(targetStation);

  return (
    current.includes(target) ||
    target.includes(current)
  );
}

function shortStation(station: string) {
  const normalized = normalize(station);

  if (normalized.includes("STATION12")) {
    return "Station 1 & 2";
  }

  if (normalized.includes("ADMINHEAD")) {
    return "Admin Head";
  }

  if (normalized.includes("QUALITYCHECK")) {
    return "Quality Checking";
  }

  if (
    normalized.includes(
      "RECEIVINGPREPRINTFORMATTING",
    )
  ) {
    return "Pre-Print";
  }

  if (normalized.includes("STAPLING")) {
    return "Stapling / Padding";
  }

  if (normalized.includes("CUTTING")) {
    return "Cutting & Trimming";
  }

  if (normalized.includes("PACKAGING")) {
    return "Packaging";
  }

  if (normalized.includes("READYFORRELEASE")) {
    return "Ready for Release";
  }

  return station;
}

function isSameList(
  listName: string,
  target: string,
) {
  return normalize(listName) === normalize(target);
}

function getListCount(
  lists: TrelloList[],
  target: string,
) {
  return (
    lists.find((list) =>
      isSameList(list.name, target),
    )?.cards.length || 0
  );
}

function isWithinLast7Days(
  dateString?: string,
) {
  if (!dateString) {
    return false;
  }

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const sevenDaysAgo = new Date();

  sevenDaysAgo.setDate(
    sevenDaysAgo.getDate() - 7,
  );

  return date >= sevenDaysAgo;
}

function isReadyForRelease(
  station: string,
) {
  return normalize(station).includes(
    "READYFORRELEASE",
  );
}

function isReleasedStation(
  station: string,
) {
  const normalized = normalize(station);

  return (
    normalized.includes("DELIVERED") ||
    normalized.includes("PICKEDUP")
  );
}

function isActiveProductionRow(
  row: TrackerRow,
) {
  return (
    !isReadyForRelease(
      row.currentStation,
    ) &&
    !isReleasedStation(
      row.currentStation,
    )
  );
}

function getLoadStatus(count: number) {
  if (count <= 4) {
    return {
      label: "Normal",
      className:
        "bg-green-100 text-green-700",
    };
  }

  if (count <= 9) {
    return {
      label: "Busy",
      className:
        "bg-amber-100 text-amber-700",
    };
  }

  return {
    label: "Overloaded",
    className: "bg-red-100 text-red-700",
  };
}

function getDaysBadge(days: number) {
  if (days < 0) {
    return {
      label: `${Math.abs(days)} day(s) overdue`,
      className:
        "bg-red-100 text-red-700",
    };
  }

  if (days === 0) {
    return {
      label: "Due today",
      className:
        "bg-orange-100 text-orange-700",
    };
  }

  if (days <= 3) {
    return {
      label: `${days} day(s) left`,
      className:
        "bg-amber-100 text-amber-700",
    };
  }

  return {
    label: `${days} day(s) left`,
    className:
      "bg-green-100 text-green-700",
  };
}

function getPriorityReason(
  row: TrackerRow,
):
  | "Overdue"
  | "Due Today"
  | "Rush"
  | "Ready for Release"
  | null {
  if (row.daysRemaining < 0) {
    return "Overdue";
  }

  if (row.daysRemaining === 0) {
    return "Due Today";
  }

  if (
    row.orderPriority
      ?.trim()
      .toLowerCase() === "rush"
  ) {
    return "Rush";
  }

  if (
    isReadyForRelease(
      row.currentStation,
    )
  ) {
    return "Ready for Release";
  }

  return null;
}

function getReasonWeight(
  reason: PriorityItem["reason"],
) {
  switch (reason) {
    case "Overdue":
      return 1;

    case "Due Today":
      return 2;

    case "Rush":
      return 3;

    case "On Hold ATP":
      return 4;

    case "Ready for Release":
      return 5;

    default:
      return 99;
  }
}

function priorityBadgeClassName(
  reason: PriorityItem["reason"],
) {
  switch (reason) {
    case "Overdue":
      return "bg-red-100 text-red-700";

    case "Due Today":
      return "bg-orange-100 text-orange-700";

    case "Rush":
      return "bg-amber-100 text-amber-700";

    case "On Hold ATP":
      return "bg-purple-100 text-purple-700";

    case "Ready for Release":
      return "bg-green-100 text-green-700";

    default:
      return "bg-[#f3eadc] text-[#6b421f]";
  }
}

function transactionStatusClassName(
  status: TransactionStatus,
) {
  switch (status) {
    case "Completed":
      return "bg-green-100 text-green-700";

    case "In Progress":
      return "bg-blue-100 text-blue-700";

    case "On Hold":
      return "bg-amber-100 text-amber-700";

    case "Pending":
    default:
      return "bg-[#f3eadc] text-[#6b421f]";
  }
}

export default async function Home() {
  await requireSiteAuth();

  const [
    lists,
    trackerRows,
    transactions,
  ] = await Promise.all([
    getLists(),
    getTrackerRows(),
    getTransactions(),
  ]);

  const productionVolume =
    await getDashboardProductionVolume(
      trackerRows,
    );

  const atpQueueCount = getListCount(
    lists,
    "ATP Intake",
  );

  const nonBirQueueCount =
    getListCount(
      lists,
      "Non-BIR Intake",
    );

  const productionQueueCount =
    atpQueueCount +
    nonBirQueueCount;

  const atpApplicationsCount =
    transactions.length;

  const readyForRelease =
    getListCount(
      lists,
      "Ready for Release",
    );

  const weeklyReleased = lists
    .filter((list) =>
      COMPLETED_LISTS.some(
        (completedName) =>
          list.name
            .toUpperCase()
            .includes(completedName),
      ),
    )
    .reduce((total, list) => {
      return (
        total +
        list.cards.filter((card) =>
          isWithinLast7Days(
            card.dateLastActivity,
          ),
        ).length
      );
    }, 0);

  const activeRows =
    trackerRows.filter(
      isActiveProductionRow,
    );

  const activeJobs =
    activeRows.length;

  const rushJobs = activeRows.filter(
    (row) =>
      row.orderPriority
        ?.trim()
        .toLowerCase() === "rush",
  );

  const dueToday = activeRows.filter(
    (row) => row.daysRemaining === 0,
  );

  const overdue = activeRows.filter(
    (row) => row.daysRemaining < 0,
  );

  const stationLoads =
    PRODUCTION_FLOW.map((station) => {
      const stationRows =
        trackerRows.filter((row) =>
          stationMatches(
            row.currentStation,
            station,
          ),
        );

      return {
        station,
        jobs: stationRows.length,
        rush: stationRows.filter(
          (row) =>
            row.orderPriority
              ?.trim()
              .toLowerCase() ===
            "rush",
        ).length,
        dueToday: stationRows.filter(
          (row) =>
            row.daysRemaining === 0,
        ).length,
      };
    });

  const productionPriorities: PriorityItem[] =
    trackerRows
      .map((row) => {
        const reason =
          getPriorityReason(row);

        if (!reason) {
          return null;
        }

        return {
          id: row.id,
          type: "production" as const,
          reference:
            row.trackingNo || row.id,
          businessName:
            row.businessName || "-",
          stage: shortStation(
            row.currentStation,
          ),
          reason,
          daysRemaining:
            row.daysRemaining,
          href: `/orders/printing/queue/${encodeURIComponent(
            row.id,
          )}`,
        };
      })
      .filter(
        (
          item,
        ): item is Extract<
          PriorityItem,
          { type: "production" }
        > => Boolean(item),
      );

  const onHoldPriorities: PriorityItem[] =
    transactions
      .filter(
        (transaction) =>
          transaction.status ===
          "On Hold",
      )
      .map((transaction) => ({
        id: `transaction-${transaction.rowNumber}`,
        type: "transaction" as const,
        reference:
          transaction.transactionNo ||
          "-",
        businessName:
          transaction.businessName ||
          transaction.taxpayerName ||
          "-",
        stage:
          transaction.currentStage ||
          "With Problems & Concerns",
        reason:
          "On Hold ATP" as const,
        daysRemaining: 0,
        href: `/orders/transactions/atp/${encodeURIComponent(
          transaction.transactionNo,
        )}`,
      }));

  const priorities = [
    ...productionPriorities,
    ...onHoldPriorities,
  ]
    .sort((first, second) => {
      const reasonDifference =
        getReasonWeight(
          first.reason,
        ) -
        getReasonWeight(
          second.reason,
        );

      if (reasonDifference !== 0) {
        return reasonDifference;
      }

      return (
        first.daysRemaining -
        second.daysRemaining
      );
    })
    .slice(0, 8);

  const liveProductionRows = [
    ...activeRows,
  ]
    .sort((first, second) => {
      const firstRush =
        first.orderPriority
          ?.toLowerCase() === "rush";

      const secondRush =
        second.orderPriority
          ?.toLowerCase() === "rush";

      if (
        firstRush &&
        !secondRush
      ) {
        return -1;
      }

      if (
        !firstRush &&
        secondRush
      ) {
        return 1;
      }

      return (
        first.daysRemaining -
        second.daysRemaining
      );
    })
    .slice(0, 10);

  const transactionSummary = {
    pending: transactions.filter(
      (transaction) =>
        transaction.status ===
        "Pending",
    ).length,

    inProgress:
      transactions.filter(
        (transaction) =>
          transaction.status ===
          "In Progress",
      ).length,

    onHold: transactions.filter(
      (transaction) =>
        transaction.status ===
        "On Hold",
    ).length,

    completed: transactions.filter(
      (transaction) =>
        transaction.status ===
        "Completed",
    ).length,
  };

  return (
    <AppShell
      activePage="dashboard"
      contentWidth="wide"
    >
      <ProductionSyncRunner />

      <PageHeader
        eyebrow="Operations Center"
        title="Production Management Dashboard"
        description="Monitor production movement, queue activity, transaction progress, station workload, due dates, and release readiness."
      />

      <section className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Active Jobs"
          value={activeJobs}
          subtitle="Currently in production"
          href="/production/tracker"
        />

        <KpiCard
          title="Weekly Released"
          value={weeklyReleased}
          subtitle="Successfully released this week"
        />

        <KpiCard
          title="Due Today"
          value={dueToday.length}
          subtitle="Orders requiring completion today"
          href="/production/tracker"
        />

        <KpiCard
          title="Overdue"
          value={overdue.length}
          subtitle="Production behind schedule"
          href="/production/tracker"
          attention={overdue.length > 0}
        />

        <KpiCard
          title="Production Queue"
          value={productionQueueCount}
          subtitle="Awaiting production details"
          href="/orders/printing/queue"
        />

        <KpiCard
          title="ATP Applications"
          value={atpApplicationsCount}
          subtitle="Registration transactions"
          href="/orders/transactions/atp"
        />

        <KpiCard
          title="Ready for Release"
          value={readyForRelease}
          subtitle="Ready for customer pickup"
          href="/production/tracker"
        />

        <KpiCard
          title="Rush Jobs"
          value={rushJobs.length}
          subtitle="High priority production"
          href="/production/tracker"
          attention={rushJobs.length > 0}
        />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <DashboardSection
          title="Production Station Load"
          description="Active jobs, rush orders, and due-today workload per production station."
          className="xl:col-span-2"
          action={
            <span className="inline-flex h-10 items-center rounded-lg border border-[#d8cbb9] bg-white px-4 text-sm font-black text-[#6b421f]">
              Total in Production:{" "}
              {activeJobs}
            </span>
          }
        >
          <div className="max-h-[660px] overflow-auto rounded-xl border border-[#eee5d8]">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-[#fbf7ef] text-[#5f5448] shadow-sm">
                <tr>
                  <TableHeader>
                    Station
                  </TableHeader>

                  <TableHeader center>
                    Jobs
                  </TableHeader>

                  <TableHeader center>
                    Rush
                  </TableHeader>

                  <TableHeader center>
                    Due Today
                  </TableHeader>

                  <TableHeader>
                    Load
                  </TableHeader>
                </tr>
              </thead>

              <tbody>
                {stationLoads.map(
                  (station) => {
                    const loadStatus =
                      getLoadStatus(
                        station.jobs,
                      );

                    return (
                      <tr
                        key={
                          station.station
                        }
                        className="border-t border-[#eee5d8] transition hover:bg-[#fbf7ef]"
                      >
                        <td className="p-4 font-black text-black">
                          {shortStation(
                            station.station,
                          )}
                        </td>

                        <td className="p-4 text-center font-black text-black">
                          {station.jobs}
                        </td>

                        <td className="p-4 text-center">
                          <CountBadge
                            value={
                              station.rush
                            }
                            variant="rush"
                          />
                        </td>

                        <td className="p-4 text-center">
                          <CountBadge
                            value={
                              station.dueToday
                            }
                            variant="due"
                          />
                        </td>

                        <td className="p-4">
                          <span
                            className={`inline-flex rounded-md px-3 py-1 text-xs font-black ${loadStatus.className}`}
                          >
                            {
                              loadStatus.label
                            }
                          </span>
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        </DashboardSection>

        <DashboardSection
          title="Production Volume"
          description="Incoming, active, and completed booklets."
        >
          <div className="space-y-1">
            <ProductionVolumeRow
              label="Today Entered"
              value={
                productionVolume.enteredToday
              }
            />

            <ProductionVolumeRow
              label="This Week Entered"
              value={
                productionVolume.enteredThisWeek
              }
            />

            <ProductionVolumeRow
              label="This Month Entered"
              value={
                productionVolume.enteredThisMonth
              }
            />

            <div className="my-3 border-t border-[#eee4d6]" />

            <ProductionVolumeRow
              label="Currently in Production"
              value={
                productionVolume.currentlyInProduction
              }
            />

            <ProductionVolumeRow
              label="Completed This Month"
              value={
                productionVolume.completedThisMonth
              }
            />
          </div>
        </DashboardSection>
      </section>

      <DashboardSection
        title="Today's Priorities"
        description="The most urgent production orders and blocked ATP applications requiring attention."
        className="mt-6"
        action={
          <span className="inline-flex h-10 items-center rounded-lg border border-[#d8cbb9] bg-white px-4 text-sm font-black text-[#6b421f]">
            Showing {priorities.length}
          </span>
        }
      >
        {priorities.length === 0 ? (
          <EmptyState
            title="No urgent priorities"
            description="There are no overdue, due-today, rush, on-hold, or ready-for-release records requiring attention."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#eee5d8]">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="bg-[#fbf7ef] text-[#5f5448]">
                <tr>
                  <TableHeader>
                    Reference
                  </TableHeader>

                  <TableHeader>
                    Client
                  </TableHeader>

                  <TableHeader>
                    Current Stage
                  </TableHeader>

                  <TableHeader>
                    Reason
                  </TableHeader>

                  <TableHeader right>
                    Action
                  </TableHeader>
                </tr>
              </thead>

              <tbody>
                {priorities.map(
                  (item) => (
                    <tr
                      key={`${item.type}-${item.id}`}
                      className="border-t border-[#eee5d8] transition hover:bg-[#fbf7ef]"
                    >
                      <td className="p-4 font-mono text-xs font-black text-black">
                        {item.reference}
                      </td>

                      <td className="p-4 font-black text-black">
                        {
                          item.businessName
                        }
                      </td>

                      <td className="p-4 text-[#5f5448]">
                        {item.stage}
                      </td>

                      <td className="p-4">
                        <span
                          className={`inline-flex rounded-md px-3 py-1 text-xs font-black ${priorityBadgeClassName(
                            item.reason,
                          )}`}
                        >
                          {item.reason}
                        </span>
                      </td>

                      <td className="p-4 text-right">
                        <Link
                          href={item.href}
                          className="inline-flex h-9 items-center justify-center rounded-lg bg-black px-4 text-xs font-black text-white transition hover:bg-[#6b421f]"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </DashboardSection>

      <DashboardSection
        title="Live Production Board"
        description="A live snapshot of active production jobs, current stations, priorities, and due schedules."
        className="mt-6"
        action={
          <Link
            href="/production/tracker"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[#cfc1ae] bg-white px-4 text-sm font-black text-black transition hover:bg-[#f8f2e8]"
          >
            View Production Tracker
          </Link>
        }
      >
        {liveProductionRows.length ===
        0 ? (
          <EmptyState
            title="No active production jobs"
            description="Active orders will appear here once they enter the production workflow."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#eee5d8]">
            <table className="w-full min-w-[1150px] text-left text-sm">
              <thead className="bg-[#fbf7ef] text-[#5f5448]">
                <tr>
                  <TableHeader>
                    Tracking
                  </TableHeader>

                  <TableHeader>
                    Business / Trade Name
                  </TableHeader>

                  <TableHeader>
                    Current Station
                  </TableHeader>

                  <TableHeader>
                    Due Date
                  </TableHeader>

                  <TableHeader>
                    Days Left
                  </TableHeader>

                  <TableHeader>
                    Priority
                  </TableHeader>

                  <TableHeader right>
                    Action
                  </TableHeader>
                </tr>
              </thead>

              <tbody>
                {liveProductionRows.map(
                  (row) => {
                    const daysBadge =
                      getDaysBadge(
                        row.daysRemaining,
                      );

                    const isRush =
                      row.orderPriority
                        ?.toLowerCase() ===
                      "rush";

                    return (
                      <tr
                        key={row.id}
                        className="border-t border-[#eee5d8] transition hover:bg-[#fbf7ef]"
                      >
                        <td className="p-4 font-mono text-xs font-black text-black">
                          {row.trackingNo ||
                            "-"}
                        </td>

                        <td className="max-w-[300px] p-4 font-black text-black">
                          {row.businessName ||
                            "-"}
                        </td>

                        <td className="p-4">
                          <span className="inline-flex rounded-md border border-[#e3d8c7] bg-white px-3 py-1 text-xs font-black text-[#5f5448]">
                            {shortStation(
                              row.currentStation,
                            )}
                          </span>
                        </td>

                        <td className="p-4 font-semibold text-black">
                          {row.currentDueDate ||
                            row.dueDate ||
                            "-"}
                        </td>

                        <td className="p-4">
                          <span
                            className={`inline-flex rounded-md px-3 py-1 text-xs font-black ${daysBadge.className}`}
                          >
                            {
                              daysBadge.label
                            }
                          </span>
                        </td>

                        <td className="p-4">
                          <span
                            className={`inline-flex rounded-md px-3 py-1 text-xs font-black ${
                              isRush
                                ? "bg-red-100 text-red-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {row.orderPriority ||
                              "Normal"}
                          </span>
                        </td>

                        <td className="p-4 text-right">
                          <Link
                            href={`/orders/printing/queue/${encodeURIComponent(
                              row.id,
                            )}`}
                            className="inline-flex h-9 items-center justify-center rounded-lg bg-black px-4 text-xs font-black text-white transition hover:bg-[#6b421f]"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        )}
      </DashboardSection>

      <DashboardSection
        title="ATP Transaction Summary"
        description="Live registration-transaction status from the separate Transactions Trello board."
        className="mt-6"
        action={
          <Link
            href="/orders/transactions/atp"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[#cfc1ae] bg-white px-4 text-sm font-black text-black transition hover:bg-[#f8f2e8]"
          >
            Open ATP Processing
          </Link>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <TransactionSummaryCard
            title="Pending"
            value={
              transactionSummary.pending
            }
            subtitle="Awaiting processing"
          />

          <TransactionSummaryCard
            title="In Progress"
            value={
              transactionSummary.inProgress
            }
            subtitle="Currently processing"
          />

          <TransactionSummaryCard
            title="On Hold"
            value={
              transactionSummary.onHold
            }
            subtitle="Problems or concerns"
          />

          <TransactionSummaryCard
            title="Completed"
            value={
              transactionSummary.completed
            }
            subtitle="Done securing"
          />
        </div>

        {transactions.length > 0 && (
          <div className="mt-5 overflow-x-auto rounded-xl border border-[#eee5d8]">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="bg-[#fbf7ef] text-[#5f5448]">
                <tr>
                  <TableHeader>
                    Transaction
                  </TableHeader>

                  <TableHeader>
                    Client
                  </TableHeader>

                  <TableHeader>
                    Status
                  </TableHeader>

                  <TableHeader>
                    Current Stage
                  </TableHeader>

                  <TableHeader right>
                    Action
                  </TableHeader>
                </tr>
              </thead>

              <tbody>
                {transactions
                  .filter(
                    (transaction) =>
                      transaction.status !==
                      "Completed",
                  )
                  .slice(0, 5)
                  .map(
                    (transaction) => (
                      <tr
                        key={`${transaction.transactionNo}-${transaction.rowNumber}`}
                        className="border-t border-[#eee5d8] transition hover:bg-[#fbf7ef]"
                      >
                        <td className="p-4 font-mono text-xs font-black text-black">
                          {transaction.transactionNo ||
                            "-"}
                        </td>

                        <td className="p-4 font-black text-black">
                          {transaction.businessName ||
                            transaction.taxpayerName ||
                            "-"}
                        </td>

                        <td className="p-4">
                          <span
                            className={`inline-flex rounded-md px-3 py-1 text-xs font-black ${transactionStatusClassName(
                              transaction.status,
                            )}`}
                          >
                            {
                              transaction.status
                            }
                          </span>
                        </td>

                        <td className="p-4 text-[#5f5448]">
                          {transaction.currentStage ||
                            "Stage unavailable"}
                        </td>

                        <td className="p-4 text-right">
                          <Link
                            href={`/orders/transactions/atp/${encodeURIComponent(
                              transaction.transactionNo,
                            )}`}
                            className="inline-flex h-9 items-center justify-center rounded-lg border border-[#cfc1ae] bg-white px-4 text-xs font-black text-black transition hover:bg-[#f8f2e8]"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ),
                  )}
              </tbody>
            </table>
          </div>
        )}
      </DashboardSection>

      <footer className="mt-8 text-center text-xs text-[#7c6a56]">
        © 2026 LIC Printing Corporation.
        Production Management System.
      </footer>
    </AppShell>
  );
}

function DashboardSection({
  title,
  description,
  action,
  className = "",
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-[#e3d8c7] bg-white shadow-sm ${className}`}
    >
      <div className="flex flex-col justify-between gap-4 border-b border-[#eee5d8] bg-[#fbf7ef] px-5 py-5 sm:px-7 lg:flex-row lg:items-center">
        <div>
          <h2 className="text-xl font-black text-black">
            {title}
          </h2>

          <p className="mt-1 text-sm leading-6 text-[#6f6254]">
            {description}
          </p>
        </div>

        {action && (
          <div className="shrink-0">
            {action}
          </div>
        )}
      </div>

      <div className="p-5 sm:p-7">
        {children}
      </div>
    </section>
  );
}

function ProductionVolumeRow({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg px-1 py-3">
      <span className="text-sm font-semibold text-[#5f5448]">
        {label}
      </span>

      <div className="text-right">
        <span className="text-xl font-black text-black">
          {formatProductionVolume(
            value,
          )}
        </span>

        <span className="ml-1 text-xs text-[#7c6a56]">
          Booklets
        </span>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  href,
  attention = false,
}: {
  title: string;
  value: number;
  subtitle: string;
  href?: string;
  attention?: boolean;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-black text-black">
          {title}
        </p>

        {href && (
          <span className="text-lg font-black text-[#6b421f]">
            →
          </span>
        )}
      </div>

      <p
        className={`mt-3 text-4xl font-black leading-none ${
          attention
            ? "text-red-700"
            : "text-black"
        }`}
      >
        {value}
      </p>

      <p className="mt-3 text-sm leading-5 text-[#6f6254]">
        {subtitle}
      </p>
    </>
  );

  const className =
    "block rounded-2xl border border-[#e3d8c7] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md";

  if (!href) {
    return (
      <article className={className}>
        {content}
      </article>
    );
  }

  return (
    <Link
      href={href}
      className={className}
    >
      {content}
    </Link>
  );
}

function TransactionSummaryCard({
  title,
  value,
  subtitle,
}: {
  title: TransactionStatus;
  value: number;
  subtitle: string;
}) {
  return (
    <article className="rounded-xl border border-[#e3d8c7] bg-[#fffdf9] p-5">
      <span
        className={`inline-flex rounded-md px-3 py-1 text-xs font-black ${transactionStatusClassName(
          title,
        )}`}
      >
        {title}
      </span>

      <p className="mt-4 text-3xl font-black text-black">
        {value}
      </p>

      <p className="mt-2 text-sm text-[#6f6254]">
        {subtitle}
      </p>
    </article>
  );
}

function CountBadge({
  value,
  variant,
}: {
  value: number;
  variant: "rush" | "due";
}) {
  if (value === 0) {
    return (
      <span className="text-sm font-bold text-[#9a8d7d]">
        0
      </span>
    );
  }

  return (
    <span
      className={`inline-flex min-w-8 items-center justify-center rounded-md px-2 py-1 text-xs font-black ${
        variant === "rush"
          ? "bg-red-100 text-red-700"
          : "bg-orange-100 text-orange-700"
      }`}
    >
      {value}
    </span>
  );
}

function TableHeader({
  children,
  center = false,
  right = false,
}: {
  children: ReactNode;
  center?: boolean;
  right?: boolean;
}) {
  return (
    <th
      className={`whitespace-nowrap p-4 text-xs font-black uppercase tracking-[0.1em] ${
        center
          ? "text-center"
          : right
            ? "text-right"
            : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[#d8cbb9] bg-[#fbf7ef] p-8 text-center">
      <p className="text-sm font-black text-black">
        {title}
      </p>

      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#6f6254]">
        {description}
      </p>
    </div>
  );
}