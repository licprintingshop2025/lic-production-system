import AppShell from "../components/AppShell";
import PageHeader from "../components/PageHeader";
import ProductionSyncRunner from "../components/ProductionSyncRunner";

type TrackerRow = {
  id: string;
  trackingNo: string;
  atpId: string;
  businessName: string;
  orderQuantity: number;
  serial: string;
  receiptType: string;
  paperType: string;
  ply: string;
  size: string;
  orderPriority: string;
  currentStation: string;
  arrivalDate: string;
  processingHours: number;
  deliveryStrategy: string;
  initialReleaseQty: number;
  initialDueDate: string;
  finalDueDate: string;
  initialCommitmentStatus: string;
  currentDueDate: string;
  daysRemaining: number;
  url: string;
};

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

async function getTrackerRows() {
  const res = await fetch(`${BASE_URL}/api/production-tracker`, {
    cache: "no-store",
  });

  if (!res.ok) return [];

  const data = await res.json();
  return data.rows as TrackerRow[];
}

function shortStation(station: string) {
  const value = station.toUpperCase();

  if (value.includes("STATION 1")) return "Station 1 & 2";
  if (value.includes("ADMIN HEAD")) return "Admin Head";
  if (value.includes("QUALITY")) return "Quality Check";
  if (value.includes("RECEIVING")) return "Pre-Print";
  if (value.includes("RUNNING")) return "Running";
  if (value.includes("NUMBERING")) return "Numbering";
  if (value.includes("COLLATING")) return "Collating";
  if (value.includes("STAPLING")) return "Stapling";
  if (value.includes("CUTTING")) return "Cutting";
  if (value.includes("BROWNING")) return "Browning";
  if (value.includes("STAMPING")) return "Stamping";
  if (value.includes("PACKAGING")) return "Packaging";
  if (value.includes("FINISH")) return "Finish Receipt";
  if (value.includes("READY")) return "Ready Release";

  return station;
}

function getDaysBadge(days: number) {
  if (days < 0) {
    return {
      text: "Overdue",
      className: "bg-red-100 text-red-700",
    };
  }

  if (days === 0) {
    return {
      text: "Today",
      className: "bg-orange-100 text-orange-700",
    };
  }

  if (days <= 3) {
    return {
      text: `${days} day(s)`,
      className: "bg-yellow-100 text-yellow-700",
    };
  }

  return {
    text: `${days} day(s)`,
    className: "bg-green-100 text-green-700",
  };
}

export default async function ProductionTrackerPage() {
  const rows = await getTrackerRows();

  const rushCount = rows.filter(
    (row) => row.orderPriority?.toLowerCase() === "rush"
  ).length;

  const readyCount = rows.filter((row) =>
    row.currentStation?.toUpperCase().includes("READY FOR RELEASE")
  ).length;

  const overdueCount = rows.filter((row) => row.daysRemaining < 0).length;
  const dueTodayCount = rows.filter((row) => row.daysRemaining === 0).length;

  return (
    <AppShell activePage="production-tracker">
      <ProductionSyncRunner />
      <div className="mx-auto max-w-[1500px]">
        <PageHeader
          title="Production Tracker"
          description="Monitor every production job with tracking number, business details, priority, current station, due date, and remaining processing time."
        />

        <section className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-4">
          <TrackerStat
            title="Total Jobs"
            value={rows.length}
            subtitle="Active records"
          />
          <TrackerStat
            title="Rush Jobs"
            value={rushCount}
            subtitle="High priority"
          />
          <TrackerStat
            title="Due Today"
            value={dueTodayCount}
            subtitle="Needs attention"
          />
          <TrackerStat
            title="Overdue"
            value={overdueCount}
            subtitle="Past due date"
          />
        </section>

        <section className="mt-5 overflow-hidden rounded-xl border border-[#e6ddd1] bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-[#eee4d6] p-6 md:flex-row md:items-center">
            <div>
              <h2 className="text-xl font-bold text-black">
                Live Production Records
              </h2>
              <p className="mt-1 text-sm text-[#5f5448]">
                Source: Trello production board
              </p>
            </div>

            <span className="rounded-lg border border-[#e6ddd1] bg-white px-4 py-2 text-sm font-bold text-[#8b5e24]">
              Ready for Release: {readyCount}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1450px] text-left text-sm">
              <thead className="bg-[#fbf7ef] text-[#5f5448]">
                <tr>
                  <th className="p-4">Tracking No.</th>
                  <th className="p-4">ATP / OCN</th>
                  <th className="p-4">Business Name</th>
                  <th className="p-4 text-center">Qty</th>
                  <th className="p-4">Serial</th>
                  <th className="p-4">Receipt Type</th>
                  <th className="p-4">Paper</th>
                  <th className="p-4">Ply</th>
                  <th className="p-4">Size</th>
                  <th className="p-4">Priority</th>
                  <th className="p-4">Delivery</th>
                  <th className="p-4">Station</th>
                  <th className="p-4">Arrival</th>
                  <th className="p-4">Proc. Hrs</th>
                  <th className="p-4">Due Date</th>
                  <th className="p-4">Days Left</th>
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="p-8 text-center text-[#6f6254]">
                      No production records found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const daysBadge = getDaysBadge(row.daysRemaining);
                    const isRush =
                      row.orderPriority?.toLowerCase() === "rush";

                    return (
                      <tr
                        key={row.id}
                        className="border-t border-[#eee4d6] transition hover:bg-[#fbf7ef]"
                      >
                        <td className="p-4 font-bold">
                          <a
                            href={`/production/${row.id}`}
                            className="text-[#9b6a22] hover:underline"
                          >
                            {row.trackingNo || "-"}
                          </a>
                        </td>

                        <td className="p-4 text-[#6f6254]">
                          {row.atpId || "-"}
                        </td>

                        <td className="max-w-[260px] p-4 font-bold text-black">
                          <span className="line-clamp-2">
                            {row.businessName || "-"}
                          </span>
                        </td>

                        <td className="p-4 text-center">
                          {row.orderQuantity || "-"}
                        </td>

                        <td className="p-4 text-[#6f6254]">
                          {row.serial || "-"}
                        </td>

                        <td className="p-4 text-[#6f6254]">
                          {row.receiptType || "-"}
                        </td>

                        <td className="p-4">{row.paperType || "-"}</td>
                        <td className="p-4">{row.ply || "-"}</td>
                        <td className="p-4">{row.size || "-"}</td>

                        <td className="p-4">
                          <span
                            className={`rounded-md px-3 py-1 text-xs font-bold ${
                              isRush
                                ? "bg-red-100 text-red-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {row.orderPriority || "Normal"}
                          </span>
                        </td>

                        <td className="p-4">
                          {row.deliveryStrategy === "Partial Release" ? (
                            <div>
                              <span className="rounded-md bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-700">
                                Partial
                              </span>
                              <p className="mt-1 text-xs text-[#6f6254]">
                                {row.initialReleaseQty || 0} first
                              </p>
                            </div>
                          ) : (
                            <span className="rounded-md bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                              Complete
                            </span>
                          )}
                        </td>

                        <td className="p-4">
                          <span className="rounded-md border border-[#e6ddd1] bg-white px-3 py-1 text-xs font-semibold text-[#5f5448]">
                            {shortStation(row.currentStation)}
                          </span>
                        </td>

                        <td className="p-4 text-[#6f6254]">
                          {row.arrivalDate || "-"}
                        </td>

                        <td className="p-4 text-[#6f6254]">
                          {row.processingHours}
                        </td>

                        <td className="p-4 font-semibold">
                          {row.deliveryStrategy === "Partial Release" ? (
                            <div className="space-y-1">
                              <p>
                                <span className="text-xs text-[#6f6254]">Initial:</span>{" "}
                                {row.initialDueDate || "-"}
                              </p>
                              <p>
                                <span className="text-xs text-[#6f6254]">Final:</span>{" "}
                                {row.finalDueDate || "-"}
                              </p>
                            </div>
                          ) : (
                            row.finalDueDate || row.currentDueDate || "-"
                          )}
                        </td>

                        <td className="p-4">
                          <div className="space-y-1">
                            <span
                              className={`inline-block rounded-md px-3 py-1 text-xs font-bold ${daysBadge.className}`}
                            >
                              {daysBadge.text}
                            </span>

                            {row.deliveryStrategy === "Partial Release" && (
                              <div className="text-[10px] font-semibold text-[#6f6254]">
                                {row.initialCommitmentStatus === "Completed"
                                  ? "Final commitment"
                                  : "Initial commitment"}
                              </div>
                            )}
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
      </div>
    </AppShell>
  );
}

function TrackerStat({
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