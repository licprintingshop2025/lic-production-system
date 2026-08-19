import AppShell from "@/app/components/AppShell";
import PageHeader from "@/app/components/PageHeader";
import Link from "next/link";

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

type QueueCard = TrelloCard & {
  type: "ATP" | "Non-BIR";
};

type SearchParams = {
  q?: string;
  type?: string;
};

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

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

function getQueueType(
  listName: string,
): "ATP" | "Non-BIR" | null {
  const name = listName
    .toUpperCase()
    .trim();

  if (name === "ATP INTAKE") {
    return "ATP";
  }

  if (
    name === "NON-BIR INTAKE" ||
    name === "NON BIR INTAKE"
  ) {
    return "Non-BIR";
  }

  return null;
}

function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function matchesSearch(
  card: QueueCard,
  searchQuery: string,
) {
  if (!searchQuery) {
    return true;
  }

  const query = normalize(searchQuery);

  const searchableText = [
    card.id,
    card.name,
    card.desc,
    card.type,
  ]
    .map(normalize)
    .join(" ");

  return searchableText.includes(query);
}

function matchesType(
  card: QueueCard,
  typeFilter: string,
) {
  if (
    !typeFilter ||
    typeFilter === "all"
  ) {
    return true;
  }

  if (typeFilter === "atp") {
    return card.type === "ATP";
  }

  if (
    typeFilter === "non-bir"
  ) {
    return card.type === "Non-BIR";
  }

  return true;
}

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const searchQuery =
    String(params.q || "").trim();

  const typeFilter =
    String(params.type || "all")
      .trim()
      .toLowerCase();

  const lists = await getLists();

  const cards: QueueCard[] =
    lists.flatMap((list) => {
      const type = getQueueType(
        list.name,
      );

      if (!type) {
        return [];
      }

      return (list.cards || []).map(
        (card) => ({
          ...card,
          type,
        }),
      );
    });

  const atpCount = cards.filter(
    (card) => card.type === "ATP",
  ).length;

  const nonBirCount = cards.filter(
    (card) =>
      card.type === "Non-BIR",
  ).length;

  const filteredCards = cards.filter(
    (card) => {
      return (
        matchesSearch(
          card,
          searchQuery,
        ) &&
        matchesType(
          card,
          typeFilter,
        )
      );
    },
  );

  const filtersActive =
    Boolean(searchQuery) ||
    typeFilter !== "all";

  return (
    <AppShell
      activePage="production"
      contentWidth="standard"
    >
      <PageHeader
        eyebrow="Orders / Printing"
        title="Production Details Queue"
        description="ATP and Non-BIR intake cards waiting for production details before moving to Station 4."
      />

      <section className="mt-7 overflow-hidden rounded-2xl border border-[#e3d8c7] bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-5 border-b border-[#eee5d8] bg-[#fbf7ef] px-5 py-5 sm:px-7 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-xl font-black text-black">
              Intake Cards
            </h2>

            <p className="mt-1 text-sm leading-6 text-[#6f6254]">
              {cards.length} card
              {cards.length === 1
                ? ""
                : "s"}{" "}
              waiting for production
              details.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">

            <Link
              href={`/orders/printing/queue?${new URLSearchParams({
                ...(searchQuery
                  ? { q: searchQuery }
                  : {}),
                ...(typeFilter !== "all"
                  ? { type: typeFilter }
                  : {}),
              }).toString()
                }`}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-[#d8cbb9] bg-white px-4 text-sm font-black text-black transition hover:bg-[#f8f2e8]"
            >
              Refresh
            </Link>

            <QueueBadge
              label="ATP"
              value={atpCount}
            />

            <QueueBadge
              label="Non-BIR"
              value={nonBirCount}
            />

            <QueueBadge
              label="Queue"
              value={cards.length}
              emphasized
            />
          </div>
        </div>

        {/* Search and Filters */}
        <form
          method="GET"
          className="border-b border-[#eee5d8] bg-white px-5 py-5 sm:px-7"
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_190px_auto_auto] lg:items-end">
            <div>
              <label
                htmlFor="queue-search"
                className="mb-2 block text-sm font-black text-black"
              >
                Search
              </label>

              <input
                id="queue-search"
                name="q"
                type="search"
                defaultValue={
                  searchQuery
                }
                placeholder="Tracking number, business name, document, card ID..."
                className="h-11 w-full rounded-lg border border-[#d8cbb9] bg-white px-4 text-sm text-black outline-none transition placeholder:text-[#a59787] focus:border-[#6b421f]"
              />
            </div>

            <div>
              <label
                htmlFor="queue-type"
                className="mb-2 block text-sm font-black text-black"
              >
                Type
              </label>

              <select
                id="queue-type"
                name="type"
                defaultValue={
                  typeFilter
                }
                className="h-11 w-full rounded-lg border border-[#d8cbb9] bg-white px-4 text-sm font-semibold text-black outline-none transition focus:border-[#6b421f]"
              >
                <option value="all">
                  All Types
                </option>

                <option value="atp">
                  ATP
                </option>

                <option value="non-bir">
                  Non-BIR
                </option>
              </select>
            </div>

            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-black px-6 text-sm font-black text-white transition hover:bg-[#6b421f]"
            >
              Search
            </button>

            <Link
              href="/orders/printing/queue"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-[#cfc1ae] bg-white px-6 text-sm font-black text-black transition hover:bg-[#f8f2e8]"
            >
              Clear Filters
            </Link>
          </div>
        </form>

        {cards.length === 0 ? (
          <div className="p-5 sm:p-7">
            <div className="rounded-xl border border-dashed border-[#d8cbb9] bg-[#fbf7ef] p-8 text-center">
              <p className="text-sm font-black text-black">
                No cards waiting for
                production details.
              </p>

              <p className="mt-2 text-sm text-[#6f6254]">
                New ATP and Non-BIR
                intake cards will appear
                here automatically.
              </p>
            </div>
          </div>
        ) : filteredCards.length ===
          0 ? (
          <div className="p-5 sm:p-7">
            <div className="rounded-xl border border-dashed border-[#d8cbb9] bg-[#fbf7ef] p-8 text-center">
              <p className="text-sm font-black text-black">
                No matching orders
                found.
              </p>

              <p className="mt-2 text-sm text-[#6f6254]">
                Try another search term
                or clear the current
                filters.
              </p>

              <Link
                href="/orders/printing/queue"
                className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-black px-5 text-xs font-black text-white transition hover:bg-[#6b421f]"
              >
                Clear Filters
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left text-sm">
              <thead className="bg-[#fffdf9] text-[#5f5448]">
                <tr>
                  <TableHeader>
                    Type
                  </TableHeader>

                  <TableHeader>
                    Card Name
                  </TableHeader>

                  <TableHeader>
                    Card ID
                  </TableHeader>

                  <TableHeader right>
                    Actions
                  </TableHeader>
                </tr>
              </thead>

              <tbody>
                {filteredCards.map(
                  (card) => (
                    <tr
                      key={card.id}
                      className="border-t border-[#eee5d8] align-middle transition hover:bg-[#fbf7ef]"
                    >
                      <td className="p-4">
                        <span
                          className={`inline-flex rounded-md px-3 py-1 text-xs font-black ${
                            card.type ===
                            "ATP"
                              ? "bg-[#f3eadc] text-[#6b421f]"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {card.type}
                        </span>
                      </td>

                      <td className="max-w-[540px] p-4">
                        <p className="whitespace-pre-line font-black leading-5 text-black">
                          {card.name}
                        </p>

                        <p className="mt-1 text-xs text-[#7c6a56]">
                          Waiting for
                          production
                          details
                        </p>
                      </td>

                      <td className="p-4 font-mono text-xs text-[#7c6a56]">
                        {card.id}
                      </td>

                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/orders/printing/queue/${encodeURIComponent(
                              card.id,
                            )}`}
                            className="inline-flex h-10 items-center justify-center rounded-lg border border-[#cfc1ae] bg-white px-4 text-xs font-black text-black transition hover:bg-[#f8f2e8]"
                          >
                            View
                          </Link>

                          <Link
                            href={`/orders/printing/queue/${encodeURIComponent(
                              card.id,
                            )}/edit`}
                            className="inline-flex h-10 items-center justify-center rounded-lg bg-black px-5 text-xs font-black text-white transition hover:bg-[#6b421f]"
                          >
                            Complete Details
                          </Link>

                          <a
                            href={card.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-10 items-center justify-center rounded-lg border border-[#cfc1ae] bg-white px-4 text-xs font-black text-black transition hover:bg-[#f8f2e8]"
                          >
                            Trello
                          </a>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-[#eee5d8] bg-[#fbf7ef] px-5 py-4 text-sm text-[#6f6254] sm:px-7">
          {filtersActive ? (
            <>
              Showing{" "}
              <span className="font-black text-black">
                {
                  filteredCards.length
                }
              </span>{" "}
              of{" "}
              <span className="font-black text-black">
                {cards.length}
              </span>{" "}
              intake cards.
            </>
          ) : (
            <>
              Showing{" "}
              <span className="font-black text-black">
                {cards.length}
              </span>{" "}
              intake card
              {cards.length === 1
                ? ""
                : "s"}
              .
            </>
          )}
        </div>
      </section>

      <footer className="mt-10 text-center text-xs text-[#7c6a56]">
        © 2026 LIC Printing
        Corporation. Production
        Management System.
      </footer>
    </AppShell>
  );
}

function QueueBadge({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: number;
  emphasized?: boolean;
}) {
  return (
    <span
      className={`inline-flex h-10 items-center rounded-lg px-4 text-sm font-black ${
        emphasized
          ? "bg-black text-white"
          : "border border-[#d8cbb9] bg-white text-[#6b421f]"
      }`}
    >
      {label}: {value}
    </span>
  );
}

function TableHeader({
  children,
  right = false,
}: {
  children: React.ReactNode;
  right?: boolean;
}) {
  return (
    <th
      className={`p-4 text-xs font-black uppercase tracking-wide ${
        right
          ? "text-right"
          : ""
      }`}
    >
      {children}
    </th>
  );
}