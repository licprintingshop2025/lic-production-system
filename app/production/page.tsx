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

async function getLists() {
  const res = await fetch("http://localhost:3000/api/trello/lists", {
    cache: "no-store",
  });

  if (!res.ok) return [];

  const data = await res.json();
  return data.lists as TrelloList[];
}

export default async function ProductionPage() {
  const lists = await getLists();

  const atpIntakeList = lists.find((list) =>
    list.name.toUpperCase().includes("ATP INTAKE")
  );

  const cards = atpIntakeList?.cards || [];

  return (
    <main className="min-h-screen bg-[#070A0F] p-8 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold text-yellow-400">
          Production Details Queue
        </h1>

        <p className="mt-2 text-sm text-zinc-400">
          Cards waiting for production details before moving to Station 4.
        </p>

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-[#0D1118] p-6">
          <h2 className="mb-4 text-xl font-bold">
            ATP Intake Cards ({cards.length})
          </h2>

          <div className="space-y-3">
            {cards.length === 0 ? (
              <p className="rounded-xl bg-zinc-950 p-5 text-zinc-400">
                No cards waiting for production details.
              </p>
            ) : (
              cards.map((card) => (
                <div
                  key={card.id}
                  className="flex flex-col justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-950 p-5 md:flex-row md:items-center"
                >
                  <div>
                    <h3 className="font-bold">{card.name}</h3>
                    <p className="mt-1 text-xs text-zinc-500">
                      Card ID: {card.id}
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <Link
                      href={`/production/${card.id}`}
                      className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-bold text-zinc-300"
                    >
                      View
                    </Link>

                    <Link
                      href={`/production/${card.id}/edit`}
                      className="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-bold text-black"
                    >
                      Complete Details
                    </Link>

                    <a
                      href={card.url}
                      target="_blank"
                      className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-bold text-zinc-300"
                    >
                      Trello
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}