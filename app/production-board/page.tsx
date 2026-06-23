type TrelloCard = {
  id: string;
  name: string;
  desc: string;
  url: string;
  labels?: {
    name: string;
    color: string;
  }[];
};

type TrelloList = {
  id: string;
  name: string;
  cards: TrelloCard[];
};

async function getLists() {
  const res = await fetch("http://localhost:3000/api/trello/lists", {
    cache: "no-store",
  });

  if (!res.ok) return [];

  const data = await res.json();
  return data.lists as TrelloList[];
}

const PRODUCTION_STATIONS = [
  "Station 1 & 2",
  "Admin Head",
  "Quality Checking",
  "Receiving & Pre-Print",
  "Running",
  "Numbering",
  "Collating",
  "Stapling",
  "Cutting",
  "Browning",
  "Stamping",
  "Packaging",
  "Finish Receipt",
  "Ready for Release",
  "Delivered by LIC",
  "Picked Up by Client",
];

const WIP_LIMIT = 20;

function isProductionStation(name: string) {
  return PRODUCTION_STATIONS.some((station) =>
    name.toUpperCase().includes(station.toUpperCase())
  );
}

function getStatus(count: number) {
  const percent = (count / WIP_LIMIT) * 100;

  if (percent >= 100) return { label: "Limit Reached", color: "bg-red-500" };
  if (percent >= 80) return { label: "Near Limit", color: "bg-yellow-400" };
  if (count === 0) return { label: "No Active Job", color: "bg-zinc-600" };

  return { label: "Within Capacity", color: "bg-green-500" };
}

export default async function ProductionBoardPage() {
  const lists = await getLists();

  const productionLists = lists.filter((list) => isProductionStation(list.name));

  return (
    <main className="min-h-screen bg-[#070A0F] p-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-zinc-800 pb-6">
          <h1 className="text-3xl font-bold text-yellow-400">
            Production Queue Board
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Active production queues based on Trello workflow.
          </p>
        </header>

        <section className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {productionLists.map((list) => {
            const status = getStatus(list.cards.length);
            const percent = Math.min((list.cards.length / WIP_LIMIT) * 100, 100);

            return (
              <div
                key={list.id}
                className="rounded-2xl border border-zinc-800 bg-[#0D1118] p-5"
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-bold text-yellow-400">{list.name}</h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      {list.cards.length}/{WIP_LIMIT} WIP
                    </p>
                  </div>

                  <span
                    className={`rounded-md px-3 py-1 text-xs font-bold text-black ${status.color}`}
                  >
                    {status.label}
                  </span>
                </div>

                <div className="mb-5 h-3 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className={`h-full ${status.color}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>

                <div className="space-y-3">
                  {list.cards.length === 0 ? (
                    <p className="rounded-xl bg-zinc-950 p-4 text-sm text-zinc-500">
                      No cards in this station.
                    </p>
                  ) : (
                    list.cards.slice(0, 6).map((card) => {
                      const isRush =
                        card.labels?.some((label) =>
                          label.name.toLowerCase().includes("rush")
                        ) ||
                        card.desc?.toUpperCase().includes("ORDER PRIORITY: RUSH");

                      return (
                        <a
                          key={card.id}
                          href={`/production/${card.id}`}
                          className={`block rounded-xl border p-4 hover:border-yellow-400 ${
                            isRush
                              ? "border-red-500/40 bg-red-950/30"
                              : "border-zinc-800 bg-zinc-950"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="line-clamp-2 text-sm font-bold">
                              {card.name}
                            </p>

                            {isRush && (
                              <span className="rounded-md bg-red-500 px-2 py-1 text-xs font-bold text-white">
                                Rush
                              </span>
                            )}
                          </div>
                        </a>
                      );
                    })
                  )}

                  {list.cards.length > 6 && (
                    <p className="text-xs text-zinc-500">
                      +{list.cards.length - 6} more card(s)
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}