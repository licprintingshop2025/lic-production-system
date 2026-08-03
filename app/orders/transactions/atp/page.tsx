"use client";

import AppShell from "@/app/components/AppShell";
import PageHeader from "@/app/components/PageHeader";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type TransactionStatus =
  | "Pending"
  | "In Progress"
  | "Waiting for Client"
  | "Completed"
  | "Cancelled";

type TransactionDocument = {
  documentType: string;
  taxType: string;
  quantity: number;
};

type TransactionRecord = {
  rowNumber: number;
  dateReceived: string;
  applicationMethod: string;
  formUsed: string[];
  taxpayerName: string;
  businessName: string;
  branch: string;
  form1905: string[];
  computePenalty: string[];
  documents: TransactionDocument[];
  mobileNumber: string;
  email: string;
  assistedBy: string;
  books: string[];
  transactionNo: string;
  status: TransactionStatus;
  createdAt: string;
  updatedAt: string;
  trelloCardId: string;
  trelloCardUrl: string;
};

type TransactionsResponse = {
  success: boolean;
  transactions?: TransactionRecord[];
  data?: TransactionRecord[];
  total?: number;
  error?: string;
  details?: string;
};

const STATUS_OPTIONS: Array<{
  value: "ALL" | TransactionStatus;
  label: string;
}> = [
  {
    value: "ALL",
    label: "All Statuses",
  },
  {
    value: "Pending",
    label: "Pending",
  },
  {
    value: "In Progress",
    label: "In Progress",
  },
  {
    value: "Waiting for Client",
    label: "Waiting for Client",
  },
  {
    value: "Completed",
    label: "Completed",
  },
  {
    value: "Cancelled",
    label: "Cancelled",
  },
];

function normalizeSearchValue(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function formatDate(value: string): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function formatDateTime(value: string): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getDocumentSummary(
  documents: TransactionDocument[],
): string {
  if (!documents.length) {
    return "-";
  }

  return documents
    .map((document) => document.documentType)
    .filter(Boolean)
    .join(" | ");
}

function getTotalQuantity(
  documents: TransactionDocument[],
): number {
  return documents.reduce(
    (total, document) =>
      total +
      (Number.isFinite(document.quantity)
        ? document.quantity
        : 0),
    0,
  );
}

function statusBadgeClassName(
  status: TransactionStatus,
): string {
  switch (status) {
    case "Completed":
      return "border-green-200 bg-green-50 text-green-800";

    case "In Progress":
      return "border-blue-200 bg-blue-50 text-blue-800";

    case "Waiting for Client":
      return "border-amber-200 bg-amber-50 text-amber-800";

    case "Cancelled":
      return "border-red-200 bg-red-50 text-red-800";

    case "Pending":
    default:
      return "border-[#e6d3ae] bg-[#fff7e8] text-[#7a5421]";
  }
}

export default function AtpProcessingPage() {
  const [transactions, setTransactions] = useState<
    TransactionRecord[]
  >([]);

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | TransactionStatus
  >("ALL");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] =
    useState(false);

  const [error, setError] = useState("");

  const loadTransactions = useCallback(
    async (refresh = false) => {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setError("");

      try {
        const response = await fetch(
          "/api/transactions",
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const result =
          (await response.json()) as TransactionsResponse;

        if (!response.ok || !result.success) {
          throw new Error(
            result.error ||
              result.details ||
              "Failed to load ATP transactions.",
          );
        }

        const records =
          result.transactions || result.data || [];

        setTransactions(records);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load ATP transactions.",
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const summary = useMemo(() => {
    return {
      total: transactions.length,

      pending: transactions.filter(
        (transaction) =>
          transaction.status === "Pending",
      ).length,

      inProgress: transactions.filter(
        (transaction) =>
          transaction.status === "In Progress",
      ).length,

      waiting: transactions.filter(
        (transaction) =>
          transaction.status ===
          "Waiting for Client",
      ).length,

      completed: transactions.filter(
        (transaction) =>
          transaction.status === "Completed",
      ).length,
    };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const normalizedSearch =
      normalizeSearchValue(searchText);

    return transactions.filter((transaction) => {
      if (
        statusFilter !== "ALL" &&
        transaction.status !== statusFilter
      ) {
        return false;
      }

      if (dateFrom) {
        const transactionDate =
          transaction.dateReceived;

        if (
          transactionDate &&
          transactionDate < dateFrom
        ) {
          return false;
        }
      }

      if (dateTo) {
        const transactionDate =
          transaction.dateReceived;

        if (
          transactionDate &&
          transactionDate > dateTo
        ) {
          return false;
        }
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchableValues = [
        transaction.transactionNo,
        transaction.taxpayerName,
        transaction.businessName,
        transaction.branch,
        transaction.applicationMethod,
        transaction.assistedBy,
        transaction.mobileNumber,
        transaction.email,
        transaction.formUsed.join(" "),
        transaction.form1905.join(" "),
        transaction.computePenalty.join(" "),
        getDocumentSummary(transaction.documents),
      ];

      return searchableValues.some((value) =>
        normalizeSearchValue(value).includes(
          normalizedSearch,
        ),
      );
    });
  }, [
    transactions,
    searchText,
    statusFilter,
    dateFrom,
    dateTo,
  ]);

  function clearFilters() {
    setSearchText("");
    setStatusFilter("ALL");
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
          eyebrow="Orders / Transactions"
          title="ATP Processing"
          description="Monitor ATP applications, open Trello records, and manage transaction progress."
        />

        <div className="flex shrink-0 flex-wrap gap-3">
          <button
            type="button"
            disabled={isRefreshing}
            onClick={() =>
              void loadTransactions(true)
            }
            className="inline-flex h-11 items-center justify-center rounded-lg border border-[#d5c6b2] bg-white px-5 text-sm font-black text-black transition hover:bg-[#f8f2e8] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRefreshing
              ? "Refreshing..."
              : "Refresh"}
          </button>

          <Link
            href="/orders/transactions/atp/new"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-black px-5 text-sm font-black text-white transition hover:bg-[#6b421f]"
          >
            + New ATP Application
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

      <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          label="Total Applications"
          value={summary.total}
          description="All ATP records"
        />

        <SummaryCard
          label="Pending"
          value={summary.pending}
          description="Not yet started"
        />

        <SummaryCard
          label="In Progress"
          value={summary.inProgress}
          description="Currently processing"
        />

        <SummaryCard
          label="Waiting for Client"
          value={summary.waiting}
          description="Client action needed"
        />

        <SummaryCard
          label="Completed"
          value={summary.completed}
          description="Finished transactions"
        />
      </section>

      <section className="mt-6 rounded-2xl border border-[#e3d8c7] bg-white shadow-sm">
        <div className="border-b border-[#eee5d8] bg-[#fbf7ef] px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
            <div className="min-w-0 flex-1">
              <label className="mb-2 block text-sm font-black text-black">
                Search
              </label>

              <input
                type="search"
                value={searchText}
                onChange={(event) =>
                  setSearchText(event.target.value)
                }
                placeholder="Transaction no., taxpayer, business, form, or document..."
                className={filterInputClassName}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="mb-2 block text-sm font-black text-black">
                  Status
                </label>

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value as
                        | "ALL"
                        | TransactionStatus,
                    )
                  }
                  className={filterInputClassName}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-black text-black">
                  Date From
                </label>

                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) =>
                    setDateFrom(event.target.value)
                  }
                  className={filterInputClassName}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-black text-black">
                  Date To
                </label>

                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) =>
                    setDateTo(event.target.value)
                  }
                  className={filterInputClassName}
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={clearFilters}
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
              ATP Applications
            </h2>

            <p className="mt-1 text-sm text-[#6f6254]">
              Showing {filteredTransactions.length} of{" "}
              {transactions.length} transaction
              {transactions.length === 1 ? "" : "s"}.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-bold text-[#6f6254]">
              Loading ATP transactions...
            </p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-base font-black text-black">
              No ATP applications found
            </p>

            <p className="mt-2 text-sm text-[#6f6254]">
              Adjust the filters or create a new ATP
              application.
            </p>

            <Link
              href="/orders/transactions/atp/new"
              className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-black px-5 text-sm font-black text-white transition hover:bg-[#6b421f]"
            >
              + New ATP Application
            </Link>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto xl:block">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b border-[#eee5d8] bg-[#fffdf9] text-left">
                    <TableHeader>
                      Transaction
                    </TableHeader>

                    <TableHeader>
                      Date Received
                    </TableHeader>

                    <TableHeader>
                      Client
                    </TableHeader>

                    <TableHeader>
                      Form Used
                    </TableHeader>

                    <TableHeader>
                      Documents
                    </TableHeader>

                    <TableHeader>
                      Qty
                    </TableHeader>

                    <TableHeader>
                      Assisted By
                    </TableHeader>

                    <TableHeader>
                      Status
                    </TableHeader>

                    <TableHeader>
                      Updated
                    </TableHeader>

                    <TableHeader align="right">
                      Actions
                    </TableHeader>
                  </tr>
                </thead>

                <tbody>
                  {filteredTransactions.map(
                    (transaction) => (
                      <tr
                        key={`${transaction.transactionNo}-${transaction.rowNumber}`}
                        className="border-b border-[#f0e8dc] align-top transition last:border-b-0 hover:bg-[#fffaf2]"
                      >
                        <TableCell>
                          <p className="font-mono text-xs font-black text-black">
                            {transaction.transactionNo ||
                              "-"}
                          </p>

                          <p className="mt-2 text-xs font-bold uppercase tracking-[0.08em] text-[#8b5e34]">
                            {transaction.applicationMethod ||
                              "-"}
                          </p>
                        </TableCell>

                        <TableCell>
                          {formatDate(
                            transaction.dateReceived,
                          )}
                        </TableCell>

                        <TableCell>
                          <p className="font-black text-black">
                            {transaction.businessName ||
                              transaction.taxpayerName ||
                              "-"}
                          </p>

                          {transaction.businessName &&
                            transaction.taxpayerName && (
                              <p className="mt-1 text-xs text-[#6f6254]">
                                {
                                  transaction.taxpayerName
                                }
                              </p>
                            )}

                          {transaction.branch && (
                            <p className="mt-1 text-xs text-[#8b7b68]">
                              {transaction.branch}
                            </p>
                          )}
                        </TableCell>

                        <TableCell>
                          <ValueList
                            values={
                              transaction.formUsed
                            }
                          />
                        </TableCell>

                        <TableCell>
                          <p className="max-w-72 text-sm leading-6 text-black">
                            {getDocumentSummary(
                              transaction.documents,
                            )}
                          </p>
                        </TableCell>

                        <TableCell>
                          <span className="font-black text-black">
                            {getTotalQuantity(
                              transaction.documents,
                            )}
                          </span>
                        </TableCell>

                        <TableCell>
                          {transaction.assistedBy ||
                            "-"}
                        </TableCell>

                        <TableCell>
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusBadgeClassName(
                              transaction.status,
                            )}`}
                          >
                            {transaction.status}
                          </span>
                        </TableCell>

                        <TableCell>
                          <p className="text-sm text-black">
                            {formatDateTime(
                              transaction.updatedAt,
                            )}
                          </p>
                        </TableCell>

                        <TableCell align="right">
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/orders/transactions/atp/${encodeURIComponent(
                                transaction.transactionNo,
                              )}`}
                              className="inline-flex h-9 items-center justify-center rounded-lg border border-[#d5c6b2] bg-white px-3 text-xs font-black text-black transition hover:bg-[#f8f2e8]"
                            >
                              Edit
                            </Link>

                            {transaction.trelloCardUrl && (
                              <a
                                href={
                                  transaction.trelloCardUrl
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-9 items-center justify-center rounded-lg bg-black px-3 text-xs font-black text-white transition hover:bg-[#6b421f]"
                              >
                                Trello
                              </a>
                            )}
                          </div>
                        </TableCell>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-[#eee5d8] xl:hidden">
              {filteredTransactions.map(
                (transaction) => (
                  <article
                    key={`${transaction.transactionNo}-${transaction.rowNumber}`}
                    className="p-5 sm:p-6"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-mono text-sm font-black text-black">
                          {transaction.transactionNo ||
                            "-"}
                        </p>

                        <p className="mt-2 text-lg font-black text-black">
                          {transaction.businessName ||
                            transaction.taxpayerName ||
                            "-"}
                        </p>

                        {transaction.businessName &&
                          transaction.taxpayerName && (
                            <p className="mt-1 text-sm text-[#6f6254]">
                              {
                                transaction.taxpayerName
                              }
                            </p>
                          )}
                      </div>

                      <span
                        className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-black ${statusBadgeClassName(
                          transaction.status,
                        )}`}
                      >
                        {transaction.status}
                      </span>
                    </div>

                    <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                      <MobileDetail
                        label="Date Received"
                        value={formatDate(
                          transaction.dateReceived,
                        )}
                      />

                      <MobileDetail
                        label="Method"
                        value={
                          transaction.applicationMethod ||
                          "-"
                        }
                      />

                      <MobileDetail
                        label="Form Used"
                        value={
                          transaction.formUsed.join(
                            " | ",
                          ) || "-"
                        }
                      />

                      <MobileDetail
                        label="Documents"
                        value={getDocumentSummary(
                          transaction.documents,
                        )}
                      />

                      <MobileDetail
                        label="Total Quantity"
                        value={String(
                          getTotalQuantity(
                            transaction.documents,
                          ),
                        )}
                      />

                      <MobileDetail
                        label="Assisted By"
                        value={
                          transaction.assistedBy ||
                          "-"
                        }
                      />
                    </dl>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link
                        href={`/orders/transactions/atp/${encodeURIComponent(
                          transaction.transactionNo,
                        )}`}
                        className="inline-flex h-10 items-center justify-center rounded-lg border border-[#d5c6b2] bg-white px-4 text-xs font-black text-black transition hover:bg-[#f8f2e8]"
                      >
                        Edit Application
                      </Link>

                      {transaction.trelloCardUrl && (
                        <a
                          href={
                            transaction.trelloCardUrl
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-10 items-center justify-center rounded-lg bg-black px-4 text-xs font-black text-white transition hover:bg-[#6b421f]"
                        >
                          Open Trello
                        </a>
                      )}
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
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8b5e34]">
        {label}
      </p>

      <p className="mt-3 text-3xl font-black text-black">
        {value}
      </p>

      <p className="mt-2 text-sm text-[#6f6254]">
        {description}
      </p>
    </article>
  );
}

function TableHeader({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`whitespace-nowrap px-4 py-4 text-xs font-black uppercase tracking-[0.1em] text-[#6b5a47] ${
        align === "right"
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
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td
      className={`px-4 py-5 text-sm text-[#3d3329] ${
        align === "right"
          ? "text-right"
          : "text-left"
      }`}
    >
      {children}
    </td>
  );
}

function ValueList({
  values,
}: {
  values: string[];
}) {
  if (!values.length) {
    return <span>-</span>;
  }

  return (
    <div className="flex max-w-64 flex-wrap gap-1.5">
      {values.map((value) => (
        <span
          key={value}
          className="rounded-md bg-[#f3eadc] px-2 py-1 text-xs font-black text-[#6b421f]"
        >
          {value}
        </span>
      ))}
    </div>
  );
}

function MobileDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-xs font-black uppercase tracking-[0.1em] text-[#8b5e34]">
        {label}
      </dt>

      <dd className="mt-1 text-sm leading-6 text-black">
        {value}
      </dd>
    </div>
  );
}

const filterInputClassName =
  "h-11 w-full rounded-lg border border-[#d8cbb9] bg-white px-4 text-sm text-black outline-none transition placeholder:text-[#9a8d7d] focus:border-[#8b5e34] focus:ring-2 focus:ring-[#8b5e34]/10";