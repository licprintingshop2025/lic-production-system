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
  dueDate: string;
  daysRemaining: number;
  url: string;
};

async function getTrackerRows() {
  const res = await fetch("http://localhost:3000/api/production-tracker", {
    cache: "no-store",
  });

  if (!res.ok) return [];

  const data = await res.json();
  return data.rows as TrackerRow[];
}

export default async function ProductionTrackerPage() {
  const rows = await getTrackerRows();

  return (
    <main className="min-h-screen bg-[#070A0F] p-8 text-white">
      <div className="mx-auto max-w-7xl">
        <h1 className="text-3xl font-bold text-yellow-400">
          Production Tracker
        </h1>

        <p className="mt-2 text-sm text-zinc-400">
          Auto-generated tracker based on Trello production records.
        </p>

        <section className="mt-8 overflow-hidden rounded-2xl border border-zinc-800 bg-[#0D1118]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1500px] text-left text-sm">
              <thead className="bg-black text-yellow-400">
                <tr>
                  <th className="p-3">Tracking No.</th>
                  <th className="p-3">ATP ID</th>
                  <th className="p-3">Business Name</th>
                  <th className="p-3">Qty</th>
                  <th className="p-3">Serial</th>
                  <th className="p-3">Receipt Type</th>
                  <th className="p-3">Paper</th>
                  <th className="p-3">Ply</th>
                  <th className="p-3">Size</th>
                  <th className="p-3">Priority</th>
                  <th className="p-3">Station</th>
                  <th className="p-3">Arrival</th>
                  <th className="p-3">Proc. Hrs</th>
                  <th className="p-3">Due Date</th>
                  <th className="p-3">Days Left</th>
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="p-5 text-center text-zinc-400">
                      No production records found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      className={`border-t border-zinc-800 ${
                        row.orderPriority === "Rush"
                          ? "bg-red-950/40 text-red-100"
                          : "bg-zinc-950"
                      }`}
                    >
                      <td className="p-3 font-bold">
                        <a
                          href={`/production/${row.id}`}
                          className="text-yellow-400 hover:underline"
                        >
                          {row.trackingNo || "-"}
                        </a>
                      </td>
                      <td className="p-3">{row.atpId}</td>
                      <td className="p-3">{row.businessName}</td>
                      <td className="p-3">{row.orderQuantity}</td>
                      <td className="p-3">{row.serial}</td>
                      <td className="p-3">{row.receiptType}</td>
                      <td className="p-3">{row.paperType}</td>
                      <td className="p-3">{row.ply}</td>
                      <td className="p-3">{row.size}</td>
                      <td className="p-3">
                        <span
                          className={`rounded-md px-2 py-1 text-xs font-bold ${
                            row.orderPriority === "Rush"
                              ? "bg-red-500 text-white"
                              : "bg-zinc-700 text-zinc-200"
                          }`}
                        >
                          {row.orderPriority}
                        </span>
                      </td>
                      <td className="p-3">{row.currentStation}</td>
                      <td className="p-3">{row.arrivalDate}</td>
                      <td className="p-3">{row.processingHours}</td>
                      <td className="p-3">{row.dueDate}</td>
                      <td className="p-3 font-bold">
                        {row.daysRemaining < 0 ? (
                          <span className="text-red-500">Overdue</span>
                        ) : row.daysRemaining === 0 ? (
                          <span className="text-orange-400">Today</span>
                        ) : row.daysRemaining <= 3 ? (
                          <span className="text-red-400">
                            {row.daysRemaining}
                          </span>
                        ) : (
                          row.daysRemaining
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}