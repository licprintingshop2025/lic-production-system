"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import AppShell from "@/app/components/AppShell";
import PageHeader from "@/app/components/PageHeader";

export type PrintingOrderRecord = {
  rowNumber: number;
  trackingNumber: string;
  submittedAt: string;
  businessName: string;
  orderSummary: string;
  quantitySummary: string;
  salesAssigned: string;
  trelloCardId: string;
  trelloCardUrl: string;
  currentStage: string;
  currentListId: string;
  status:
    | "Intake"
    | "In Production"
    | "Ready for Release"
    | "Completed"
    | "Unknown";
};

type PrintingOrdersResponse = {
  success: boolean;
  orders?: PrintingOrderRecord[];
  warning?: string;
  error?: string;
  details?: string;
};

type Props = {
  kind: "BIR" | "NON-BIR";
  title: string;
  description: string;
  endpoint: string;
  newOrderHref: string;
  newOrderLabel: string;
};

const STATUS_OPTIONS = [
  "ALL",
  "Intake",
  "In Production",
  "Ready for Release",
  "Completed",
  "Unknown",
] as const;

type StatusFilter =
  (typeof STATUS_OPTIONS)[number];

function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function getDateKey(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    const match = value.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})/,
    );

    if (!match) {
      return "";
    }

    const [, month, day, year] =
      match;

    return `${year}-${month.padStart(
      2,
      "0",
    )}-${day.padStart(2, "0")}`;
  }

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1,
    ).padStart(2, "0");

  const day =
    String(
      date.getDate(),
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      year: "numeric",
      month: "short",
      day: "2-digit",
    },
  ).format(date);
}

function statusClassName(
  status: PrintingOrderRecord["status"],
) {
  switch (status) {
    case "Completed":
      return "border-green-200 bg-green-50 text-green-800";

    case "Ready for Release":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";

    case "In Production":
      return "border-blue-200 bg-blue-50 text-blue-800";

    case "Intake":
      return "border-[#e6d3ae] bg-[#fff7e8] text-[#7a5421]";

    default:
      return "border-gray-200 bg-gray-50 text-gray-700";
  }
}

function canEditProduction(
  order: PrintingOrderRecord,
) {
  if (!order.trelloCardId) {
    return false;
  }

  return (
    order.status ===
      "In Production" ||
    order.status ===
      "Ready for Release"
  );
}

export default function PrintingOrdersDashboard({
  kind,
  title,
  description,
  endpoint,
  newOrderHref,
  newOrderLabel,
}: Props) {
  const [
    orders,
    setOrders,
  ] =
    useState<
      PrintingOrderRecord[]
    >([]);

  const [
    searchText,
    setSearchText,
  ] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState<StatusFilter>(
      "ALL",
    );

  const [
    dateFrom,
    setDateFrom,
  ] =
    useState("");

  const [
    dateTo,
    setDateTo,
  ] =
    useState("");

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(true);

  const [
    isRefreshing,
    setIsRefreshing,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    warning,
    setWarning,
  ] =
    useState("");

  const loadOrders =
    useCallback(
      async (
        refresh = false,
      ) => {
        if (refresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        setError("");
        setWarning("");

        try {
          const response =
            await fetch(
              endpoint,
              {
                method: "GET",
                cache: "no-store",
              },
            );

          const result =
            (await response.json()) as PrintingOrdersResponse;

          if (
            !response.ok ||
            !result.success
          ) {
            throw new Error(
              result.error ||
                result.details ||
                `Failed to load ${kind} printing orders.`,
            );
          }

          setOrders(
            Array.isArray(
              result.orders,
            )
              ? result.orders
              : [],
          );

          if (result.warning) {
            setWarning(
              result.warning,
            );
          }
        } catch (loadError) {
          setError(
            loadError instanceof
              Error
              ? loadError.message
              : `Failed to load ${kind} printing orders.`,
          );
        } finally {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      },
      [
        endpoint,
        kind,
      ],
    );

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const summary =
    useMemo(
      () => ({
        total:
          orders.length,

        intake:
          orders.filter(
            (order) =>
              order.status ===
              "Intake",
          ).length,

        inProduction:
          orders.filter(
            (order) =>
              order.status ===
              "In Production",
          ).length,

        ready:
          orders.filter(
            (order) =>
              order.status ===
              "Ready for Release",
          ).length,

        completed:
          orders.filter(
            (order) =>
              order.status ===
              "Completed",
          ).length,
      }),
      [orders],
    );

  const filteredOrders =
    useMemo(() => {
      const query =
        normalize(
          searchText,
        );

      return orders.filter(
        (order) => {
          if (
            statusFilter !==
              "ALL" &&
            order.status !==
              statusFilter
          ) {
            return false;
          }

          const orderDate =
            getDateKey(
              order.submittedAt,
            );

          if (
            dateFrom &&
            orderDate &&
            orderDate <
              dateFrom
          ) {
            return false;
          }

          if (
            dateTo &&
            orderDate &&
            orderDate >
              dateTo
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          return [
            order.trackingNumber,
            order.businessName,
            order.orderSummary,
            order.quantitySummary,
            order.salesAssigned,
            order.currentStage,
            order.status,
          ].some(
            (value) =>
              normalize(
                value,
              ).includes(
                query,
              ),
          );
        },
      );
    }, [
      orders,
      searchText,
      statusFilter,
      dateFrom,
      dateTo,
    ]);

  function clearFilters() {
    setSearchText("");
    setStatusFilter(
      "ALL",
    );
    setDateFrom("");
    setDateTo("");
  }

  return (
    <AppShell
      activePage="orders"
      contentWidth="wide"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <PageHeader
          eyebrow="Orders / Printing"
          title={title}
          description={
            description
          }
        />

        <div className="flex shrink-0 flex-wrap gap-3">
          <button
            type="button"
            disabled={
              isRefreshing
            }
            onClick={() =>
              void loadOrders(
                true,
              )
            }
            className="inline-flex h-11 items-center justify-center rounded-lg border border-[#d5c6b2] bg-white px-5 text-sm font-black text-black transition hover:bg-[#f8f2e8] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRefreshing
              ? "Refreshing..."
              : "Refresh"}
          </button>

          <Link
            href={
              newOrderHref
            }
            className="inline-flex h-11 items-center justify-center rounded-lg bg-black px-5 text-sm font-black text-white transition hover:bg-[#6b421f]"
          >
            +{" "}
            {
              newOrderLabel
            }
          </Link>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-7 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700"
        >
          {error}
        </div>
      )}

      {warning &&
        !error && (
          <div
            role="status"
            className="mt-7 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4"
          >
            <p className="text-sm font-black text-amber-900">
              Trello workflow status is temporarily unavailable.
            </p>

            <p className="mt-1 text-sm text-amber-800">
              {
                warning
              }
            </p>
          </div>
        )}

      <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          label="Total Orders"
          value={
            summary.total
          }
          description={`All ${kind} records`}
        />

        <SummaryCard
          label="Intake"
          value={
            summary.intake
          }
          description="Waiting to enter production"
        />

        <SummaryCard
          label="In Production"
          value={
            summary.inProduction
          }
          description="Active production jobs"
        />

        <SummaryCard
          label="Ready for Release"
          value={
            summary.ready
          }
          description="Completed and waiting release"
        />

        <SummaryCard
          label="Completed"
          value={
            summary.completed
          }
          description="Delivered or picked up"
        />
      </section>

      <section className="mt-6 overflow-visible rounded-2xl border border-[#e3d8c7] bg-white shadow-sm">
        <div className="border-b border-[#eee5d8] bg-[#fbf7ef] px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
            <div className="min-w-0 flex-1">
              <label className="mb-2 block text-sm font-black text-black">
                Search
              </label>

              <input
                type="search"
                value={
                  searchText
                }
                onChange={(
                  event,
                ) =>
                  setSearchText(
                    event
                      .target
                      .value,
                  )
                }
                placeholder="Tracking number, business, document, staff, or stage..."
                className={
                  filterInputClassName
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="mb-2 block text-sm font-black text-black">
                  Status
                </label>

                <select
                  value={
                    statusFilter
                  }
                  onChange={(
                    event,
                  ) =>
                    setStatusFilter(
                      event
                        .target
                        .value as StatusFilter,
                    )
                  }
                  className={
                    filterInputClassName
                  }
                >
                  {STATUS_OPTIONS.map(
                    (
                      status,
                    ) => (
                      <option
                        key={
                          status
                        }
                        value={
                          status
                        }
                      >
                        {status ===
                        "ALL"
                          ? "All Statuses"
                          : status}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-black text-black">
                  Date From
                </label>

                <input
                  type="date"
                  value={
                    dateFrom
                  }
                  onChange={(
                    event,
                  ) =>
                    setDateFrom(
                      event
                        .target
                        .value,
                    )
                  }
                  className={
                    filterInputClassName
                  }
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-black text-black">
                  Date To
                </label>

                <input
                  type="date"
                  value={
                    dateTo
                  }
                  onChange={(
                    event,
                  ) =>
                    setDateTo(
                      event
                        .target
                        .value,
                    )
                  }
                  className={
                    filterInputClassName
                  }
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={
                    clearFilters
                  }
                  className="h-11 w-full rounded-lg border border-[#d5c6b2] bg-white px-4 text-sm font-black text-black transition hover:bg-[#f8f2e8]"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-b border-[#eee5d8] px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-black text-black">
              {title}
            </h2>

            <p className="mt-1 text-sm text-[#6f6254]">
              Showing{" "}
              {
                filteredOrders.length
              }{" "}
              of{" "}
              {
                orders.length
              }{" "}
              order
              {orders.length ===
              1
                ? ""
                : "s"}
              .
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="px-6 py-16 text-center text-sm font-bold text-[#6f6254]">
            Loading printing orders...
          </div>
        ) : filteredOrders.length ===
          0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-base font-black text-black">
              No printing orders found
            </p>

            <p className="mt-2 text-sm text-[#6f6254]">
              Adjust the filters or create a new order.
            </p>

            <Link
              href={
                newOrderHref
              }
              className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-black px-5 text-sm font-black text-white transition hover:bg-[#6b421f]"
            >
              +{" "}
              {
                newOrderLabel
              }
            </Link>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto xl:block">
              <table className="w-full min-w-[1180px] border-collapse">
                <thead>
                  <tr className="border-b border-[#eee5d8] bg-[#fffdf9] text-left">
                    <TableHeader>
                      Tracking
                    </TableHeader>

                    <TableHeader>
                      {kind ===
                      "BIR"
                        ? "Submitted"
                        : "Date Received"}
                    </TableHeader>

                    <TableHeader>
                      Business / Trade Name
                    </TableHeader>

                    <TableHeader>
                      Order
                    </TableHeader>

                    <TableHeader>
                      Quantity
                    </TableHeader>

                    <TableHeader>
                      Staff
                    </TableHeader>

                    <TableHeader>
                      Status
                    </TableHeader>

                    <TableHeader align="right">
                      Actions
                    </TableHeader>
                  </tr>
                </thead>

                <tbody>
                  {filteredOrders.map(
                    (
                      order,
                    ) => (
                      <tr
                        key={`${order.trackingNumber}-${order.rowNumber}`}
                        className="border-b border-[#f0e8dc] align-top transition last:border-b-0 hover:bg-[#fffaf2]"
                      >
                        <TableCell>
                          <p className="font-mono text-xs font-black text-black">
                            {order.trackingNumber ||
                              "-"}
                          </p>
                        </TableCell>

                        <TableCell>
                          {formatDate(
                            order.submittedAt,
                          )}
                        </TableCell>

                        <TableCell>
                          <p className="max-w-72 font-black text-black">
                            {order.businessName ||
                              "-"}
                          </p>
                        </TableCell>

                        <TableCell>
                          <p className="max-w-80 text-sm font-bold text-black">
                            {order.orderSummary ||
                              "-"}
                          </p>
                        </TableCell>

                        <TableCell>
                          {order.quantitySummary ||
                            "-"}
                        </TableCell>

                        <TableCell>
                          {order.salesAssigned ||
                            "-"}
                        </TableCell>

                        <TableCell>
                          <span
                            className={`inline-flex rounded-md border px-3 py-1 text-xs font-black ${statusClassName(
                              order.status,
                            )}`}
                          >
                            {
                              order.status
                            }
                          </span>

                          <p className="mt-2 max-w-64 text-xs text-[#6f6254]">
                            {order.currentStage ||
                              "Stage unavailable"}
                          </p>
                        </TableCell>

                        <TableCell align="right">
                          <OrderActions
                            order={
                              order
                            }
                            kind={
                              kind
                            }
                          />
                        </TableCell>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-[#eee5d8] xl:hidden">
              {filteredOrders.map(
                (
                  order,
                ) => (
                  <article
                    key={`${order.trackingNumber}-${order.rowNumber}`}
                    className="p-5 sm:p-6"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-mono text-xs font-black text-[#8b5e34]">
                          {order.trackingNumber ||
                            "-"}
                        </p>

                        <h3 className="mt-2 text-lg font-black text-black">
                          {order.businessName ||
                            "-"}
                        </h3>

                        <p className="mt-1 text-sm text-[#6f6254]">
                          {formatDate(
                            order.submittedAt,
                          )}
                        </p>
                      </div>

                      <span
                        className={`inline-flex w-fit rounded-md border px-3 py-1 text-xs font-black ${statusClassName(
                          order.status,
                        )}`}
                      >
                        {
                          order.status
                        }
                      </span>
                    </div>

                    <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                      <MobileField
                        label="Order"
                        value={
                          order.orderSummary ||
                          "-"
                        }
                      />

                      <MobileField
                        label="Quantity"
                        value={
                          order.quantitySummary ||
                          "-"
                        }
                      />

                      <MobileField
                        label="Staff"
                        value={
                          order.salesAssigned ||
                          "-"
                        }
                      />

                      <MobileField
                        label="Current Stage"
                        value={
                          order.currentStage ||
                          "Stage unavailable"
                        }
                      />
                    </dl>

                    <div className="mt-5">
                      <OrderActions
                        order={
                          order
                        }
                        kind={
                          kind
                        }
                        mobile
                      />
                    </div>
                  </article>
                ),
              )}
            </div>
          </>
        )}
      </section>
    </AppShell>
  );
}

function OrderActions({
  order,
  kind,
  mobile = false,
}: {
  order: PrintingOrderRecord;
  kind:
    | "BIR"
    | "NON-BIR";
  mobile?: boolean;
}) {
  const orderEditHref = `${
    kind === "BIR"
      ? "/orders/printing/bir"
      : "/orders/printing/non-bir"
  }/${encodeURIComponent(
    order.trackingNumber,
  )}/edit`;

  const viewHref =
    order.trelloCardId
      ? `/orders/printing/queue/${encodeURIComponent(
          order.trelloCardId,
        )}`
      : "";

  const productionEditHref =
    order.trelloCardId
      ? `/orders/printing/queue/${encodeURIComponent(
          order.trelloCardId,
        )}/edit?mode=edit`
      : "";

  return (
    <div
      className={`flex items-center gap-2 ${
        mobile
          ? "flex-wrap justify-start"
          : "flex-nowrap justify-end"
      }`}
    >
      {viewHref && (
        <Link
          href={viewHref}
          className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-lg border border-[#d5c6b2] bg-white px-3 text-xs font-black text-black transition hover:bg-[#f8f2e8]"
        >
          View
        </Link>
      )}

      {canEditProduction(
        order,
      ) && (
        <Link
          href={
            productionEditHref
          }
          className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-black text-black transition hover:bg-blue-100"
        >
          Edit Production
        </Link>
      )}

      <details className="group relative shrink-0">
        <summary
          className={`flex h-9 cursor-pointer list-none items-center justify-center rounded-lg border border-[#d5c6b2] bg-white text-xs font-black text-black transition hover:bg-[#f8f2e8] [&::-webkit-details-marker]:hidden ${
            mobile
              ? "px-4"
              : "w-9"
          }`}
        >
          {mobile
            ? "More"
            : "•••"}
        </summary>

        <div
          className={`absolute top-11 z-50 min-w-48 overflow-hidden rounded-xl border border-[#e3d8c7] bg-white p-1 text-left shadow-xl ${
            mobile
              ? "left-0"
              : "right-0"
          }`}
        >
          <Link
            href={
              orderEditHref
            }
            className="block rounded-lg px-4 py-3 text-xs font-black text-black transition hover:bg-[#fbf7ef]"
          >
            Edit Order
          </Link>

          {order.trelloCardUrl && (
            <a
              href={
                order.trelloCardUrl
              }
              target="_blank"
              rel="noreferrer"
              className="block rounded-lg px-4 py-3 text-xs font-black text-black transition hover:bg-[#fbf7ef]"
            >
              Open in Trello
            </a>
          )}
        </div>
      </details>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <article className="rounded-2xl border border-[#e3d8c7] bg-white p-5 shadow-sm">
      <p className="text-sm font-black text-black">
        {label}
      </p>

      <p className="mt-3 text-4xl font-black leading-none text-black">
        {value}
      </p>

      <p className="mt-3 text-sm text-[#6f6254]">
        {
          description
        }
      </p>
    </article>
  );
}

function TableHeader({
  children,
  align = "left",
}: {
  children:
    React.ReactNode;
  align?:
    | "left"
    | "right";
}) {
  return (
    <th
      className={`whitespace-nowrap p-4 text-xs font-black uppercase tracking-[0.1em] text-[#5f5448] ${
        align ===
        "right"
          ? "text-right"
          : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function TableCell({
  children,
  align = "left",
}: {
  children:
    React.ReactNode;
  align?:
    | "left"
    | "right";
}) {
  return (
    <td
      className={`p-4 text-sm text-[#5f5448] ${
        align ===
        "right"
          ? "text-right"
          : "text-left"
      }`}
    >
      {children}
    </td>
  );
}

function MobileField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-xs font-black uppercase tracking-[0.08em] text-[#8b7b68]">
        {label}
      </dt>

      <dd className="mt-1 text-sm font-bold text-black">
        {value}
      </dd>
    </div>
  );
}

const filterInputClassName =
  "h-11 w-full rounded-lg border border-[#d5c6b2] bg-white px-3 text-sm font-semibold text-black outline-none transition focus:border-[#8b5e34] focus:ring-2 focus:ring-[#8b5e34]/10";