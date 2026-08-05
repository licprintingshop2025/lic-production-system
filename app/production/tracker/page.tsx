import AppShell from "@/app/components/AppShell";
import PageHeader from "@/app/components/PageHeader";
import ProductionSyncRunner from "@/app/components/ProductionSyncRunner";

type TrackerDocument = {
  id: string;
  documentType: string;
  quantity: number;
  quantityText: string;
  serialRange: string;
  paperType: string;
  ply: string;
  size: string;
  specialInstruction: string;
};

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

  documentCount: number;
  documents: TrackerDocument[];

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

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

async function getTrackerRows() {
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

function shortStation(station: string) {
  const value = station.toUpperCase();

  if (value.includes("STATION 1")) {
    return "Station 1 & 2";
  }

  if (value.includes("ADMIN HEAD")) {
    return "Admin Head";
  }

  if (value.includes("QUALITY")) {
    return "Quality Check";
  }

  if (value.includes("RECEIVING")) {
    return "Pre-Print";
  }

  if (value.includes("RUNNING")) {
    return "Running";
  }

  if (value.includes("NUMBERING")) {
    return "Numbering";
  }

  if (value.includes("COLLATING")) {
    return "Collating";
  }

  if (value.includes("STAPLING")) {
    return "Stapling";
  }

  if (value.includes("CUTTING")) {
    return "Cutting";
  }

  if (value.includes("BROWNING")) {
    return "Browning";
  }

  if (value.includes("STAMPING")) {
    return "Stamping";
  }

  if (value.includes("PACKAGING")) {
    return "Packaging";
  }

  if (value.includes("FINISH")) {
    return "Finish Receipt";
  }

  if (value.includes("READY")) {
    return "Ready Release";
  }

  return station;
}

function getDaysBadge(days: number) {
  if (days < 0) {
    return {
      text: `${Math.abs(days)} day(s) overdue`,
      className: "bg-red-100 text-red-700",
    };
  }

  if (days === 0) {
    return {
      text: "Today",
      className:
        "bg-orange-100 text-orange-700",
    };
  }

  if (days <= 3) {
    return {
      text: `${days} day(s)`,
      className:
        "bg-yellow-100 text-yellow-700",
    };
  }

  return {
    text: `${days} day(s)`,
    className:
      "bg-green-100 text-green-700",
  };
}

function formatProcessingHours(hours: number) {
  if (!Number.isFinite(hours)) {
    return "0";
  }

  return Number.isInteger(hours)
    ? String(hours)
    : hours.toFixed(2);
}

function SummaryValue({
  value,
  mixedLabel,
}: {
  value: string;
  mixedLabel?: string;
}) {
  const isMixed =
    value.toLowerCase() === "mixed";

  if (isMixed) {
    return (
      <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">
        {mixedLabel || "Mixed"}
      </span>
    );
  }

  return <>{value || "-"}</>;
}

function DocumentDetails({
  documents,
}: {
  documents: TrackerDocument[];
}) {
  if (documents.length === 0) {
    return <span>-</span>;
  }

  if (documents.length === 1) {
    return (
      <div>
        <p className="font-semibold text-[#3f352a]">
          {documents[0].documentType}
        </p>

        <p className="mt-1 text-xs text-[#8a7b6b]">
          {documents[0].quantity || "-"} booklet(s)
        </p>
      </div>
    );
  }

  return (
    <details className="group">
      <summary className="cursor-pointer list-none">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[#3f352a]">
            {documents.length} Documents
          </span>

          <span className="text-xs text-[#9b6a22] group-open:hidden">
            View
          </span>

          <span className="hidden text-xs text-[#9b6a22] group-open:inline">
            Hide
          </span>
        </div>
      </summary>

      <div className="mt-3 min-w-[260px] space-y-3 rounded-xl border border-[#e6ddd1] bg-[#fffaf2] p-3 shadow-sm">
        {documents.map((document, index) => (
          <div
            key={`${document.id}-${index}`}
            className="border-b border-[#eadfcf] pb-3 last:border-b-0 last:pb-0"
          >
            <p className="text-xs font-black text-black">
              {index + 1}. {document.documentType}
            </p>

            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-[#6f6254]">
              <p>
                <span className="font-bold">
                  Qty:
                </span>{" "}
                {document.quantityText || "-"}
              </p>

              <p>
                <span className="font-bold">
                  Serial:
                </span>{" "}
                {document.serialRange || "-"}
              </p>

              <p>
                <span className="font-bold">
                  Paper:
                </span>{" "}
                {document.paperType || "-"}
              </p>

              <p>
                <span className="font-bold">
                  Ply:
                </span>{" "}
                {document.ply || "-"}
              </p>

              <p>
                <span className="font-bold">
                  Size:
                </span>{" "}
                {document.size || "-"}
              </p>
            </div>

            {document.specialInstruction &&
              document.specialInstruction !== "-" && (
                <p className="mt-2 text-[11px] text-[#6f6254]">
                  <span className="font-bold">
                    Special:
                  </span>{" "}
                  {document.specialInstruction}
                </p>
              )}
          </div>
        ))}
      </div>
    </details>
  );
}

export default async function ProductionTrackerPage() {
  const rows = await getTrackerRows();

  const rushCount = rows.filter(
    (row) =>
      row.orderPriority?.toLowerCase() ===
      "rush",
  ).length;

  const readyCount = rows.filter((row) =>
    row.currentStation
      ?.toUpperCase()
      .includes("READY FOR RELEASE"),
  ).length;

  const overdueCount = rows.filter(
    (row) => row.daysRemaining < 0,
  ).length;

  const dueTodayCount = rows.filter(
    (row) => row.daysRemaining === 0,
  ).length;

  return (
    <AppShell
      activePage="production-tracker"
      contentWidth="wide"
    >
      <ProductionSyncRunner />

      <PageHeader
        title="Production Tracker"
        description="Monitor every production job with document specifications, priority, current station, due dates, and estimated processing time."
      />

      <section className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-4">
        <TrackerStat
          title="Total Jobs"
          value={rows.length}
          subtitle="Active production orders"
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

        <div className="max-h-[calc(100vh-390px)] min-h-[360px] overflow-auto">
          <table className="w-full min-w-[1450px] text-left text-sm">
            <thead className="sticky top-0 z-20 bg-[#fbf7ef] text-[#5f5448] shadow-sm">
              <tr>
                <th className="p-4">
                  Tracking No.
                </th>

                <th className="p-4">
                  Business Name
                </th>

                <th className="p-4 text-center">
                  Total Qty
                </th>

                <th className="p-4">
                  Documents
                </th>

                <th className="p-4">
                  Paper
                </th>

                <th className="w-[80px] min-w-[80px] p-4">
                  Ply
                </th>

                <th className="p-4">
                  Size
                </th>

                <th className="p-4">
                  Priority
                </th>

                <th className="p-4">
                  Delivery
                </th>

                <th className="w-[120px] min-w-[120px] p-4">
                  Station
                </th>

                <th className="p-4">
                  Arrival
                </th>

                <th className="p-4">
                  Proc. Hrs
                </th>

                <th className="w-[155px] min-w-[155px] p-4">
                  Due Date
                </th>

                <th className="w-[130px] min-w-[130px] p-4">
                  Days Left
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={14}
                    className="p-8 text-center text-[#6f6254]"
                  >
                    No production records found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const daysBadge =
                    getDaysBadge(
                      row.daysRemaining,
                    );

                  const isRush =
                    row.orderPriority
                      ?.toLowerCase() ===
                    "rush";

                  const isPartial =
                    row.deliveryStrategy ===
                    "Partial Release";

                  const initialCompleted =
                    row.initialCommitmentStatus ===
                    "Completed";

                  return (
                    <tr
                      key={row.id}
                      className="border-t border-[#eee4d6] align-top transition hover:bg-[#fbf7ef]"
                    >
                      <td className="p-4 font-bold">
                        <a
                          href={`/orders/printing/queue/${row.id}`}
                          className="text-[#9b6a22] hover:underline"
                        >
                          {row.trackingNo || "-"}
                        </a>
                      </td>

                      <td className="w-[260px] p-4 font-bold text-black">
                        <div
                          className="line-clamp-2 leading-5"
                          title={
                            row.businessName || "-"
                          }
                        >
                          {row.businessName || "-"}
                        </div>
                      </td>

                      <td className="p-4 text-center font-bold text-black">
                        {row.orderQuantity || "-"}
                      </td>

                      <td className="max-w-[320px] p-4 text-[#6f6254]">
                        <DocumentDetails
                          documents={
                            row.documents || []
                          }
                        />
                      </td>

                      <td className="p-4">
                        <SummaryValue
                          value={row.paperType || "-"}
                          mixedLabel="Mixed Paper"
                        />
                      </td>

                      <td className="w-[80px] min-w-[80px] whitespace-nowrap p-4">
                        <SummaryValue
                          value={row.ply || "-"}
                          mixedLabel="Mixed Ply"
                        />
                      </td>

                      <td className="p-4">
                        <SummaryValue
                          value={row.size || "-"}
                          mixedLabel="Mixed Size"
                        />
                      </td>

                      <td className="p-4">
                        <span
                          className={`rounded-md px-3 py-1 text-xs font-bold ${
                            isRush
                              ? "bg-red-100 text-red-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {row.orderPriority ||
                            "Normal"}
                        </span>
                      </td>

                      <td className="p-4">
                        {isPartial ? (
                          <div>
                            <span className="rounded-md bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-700">
                              Partial
                            </span>

                            <p className="mt-1 text-xs text-[#6f6254]">
                              {row.initialReleaseQty ||
                                0}{" "}
                              first
                            </p>
                          </div>
                        ) : (
                          <span className="rounded-md bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                            Complete
                          </span>
                        )}
                      </td>

                      <td className="w-[120px] min-w-[120px] p-4">
                        <span className="inline-block whitespace-nowrap rounded-md border border-[#e6ddd1] bg-white px-3 py-1 text-xs font-semibold text-[#5f5448]">
                          {shortStation(
                            row.currentStation,
                          )}
                        </span>
                      </td>

                      <td className="p-4 text-[#6f6254]">
                        {row.arrivalDate || "-"}
                      </td>

                      <td className="p-4 font-semibold text-[#6f6254]">
                        {formatProcessingHours(
                          row.processingHours,
                        )}
                      </td>

                      <td className="w-[155px] min-w-[155px] p-4 font-semibold">
                        {isPartial ? (
                          <div className="space-y-1.5">
                            <div className="grid grid-cols-[42px_1fr] items-center gap-2">
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#8a7b6b]">
                                Initial
                              </span>

                              <span
                                className={`whitespace-nowrap text-xs font-bold ${
                                  initialCompleted
                                    ? "text-green-700 line-through opacity-70"
                                    : "text-black"
                                }`}
                              >
                                {row.initialDueDate ||
                                  "-"}
                              </span>
                            </div>

                            <div className="grid grid-cols-[42px_1fr] items-center gap-2">
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#8a7b6b]">
                                Final
                              </span>

                              <span className="whitespace-nowrap text-xs font-bold text-black">
                                {row.finalDueDate ||
                                  "-"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="whitespace-nowrap">
                            {row.finalDueDate ||
                              row.currentDueDate ||
                              "-"}
                          </span>
                        )}
                      </td>

                      <td className="w-[130px] min-w-[130px] p-4">
                        <div className="space-y-1">
                          <span
                            className={`inline-block rounded-md px-3 py-1 text-xs font-bold ${daysBadge.className}`}
                          >
                            {daysBadge.text}
                          </span>

                          {isPartial && (
                            <div className="whitespace-nowrap text-[10px] font-semibold text-[#6f6254]">
                              {initialCompleted
                                ? "Until final due"
                                : "Until initial due"}
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
        © 2026 LIC Printing Shop. Production
        Management System.
      </footer>
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
      <p className="text-sm font-bold text-black">
        {title}
      </p>

      <p className="mt-3 text-4xl font-black leading-none text-black">
        {value}
      </p>

      <p className="mt-3 text-sm text-[#6f6254]">
        {subtitle}
      </p>
    </div>
  );
}