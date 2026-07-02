import Link from "next/link";
import AppShell from "../components/AppShell";
import PageHeader from "../components/PageHeader";

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

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

async function getLists() {
  const res = await fetch(`${BASE_URL}/api/trello/lists`, {
    cache: "no-store",
  });

  if (!res.ok) return [];

  const data = await res.json();
  return data.lists as TrelloList[];
}

function getQueueType(listName: string): "ATP" | "Non-BIR" | null {
  const name = listName.toUpperCase().trim();

  if (name === "ATP INTAKE") return "ATP";
  if (name === "NON-BIR INTAKE" || name === "NON BIR INTAKE") return "Non-BIR";

  return null;
}

export default async function ProductionPage() {
  const lists = await getLists();

  const cards: QueueCard[] = lists.flatMap((list) => {
    const type = getQueueType(list.name);

    if (!type) return [];

    return (list.cards || []).map((card) => ({
      ...card,
      type,
    }));
  });

  const atpCount = cards.filter((card) => card.type === "ATP").length;
  const nonBirCount = cards.filter((card) => card.type === "Non-BIR").length;

  return (
    <AppShell activePage="production">
      <div className="mx-auto max-w-[1400px]">
        <PageHeader
          title="Production Details Queue"
          description="ATP and Non-BIR intake cards waiting for production details before moving to Station 4."
        />

        <section className="mt-8 rounded-2xl border border-[#e3d8c7] bg-white p-6 shadow-[0_2px_10px_rgba(70,45,20,0.08)]">
          <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <h2 className="text-xl font-black text-black">Intake Cards</h2>
              <p className="mt-1 text-sm text-[#6f6254]">
                {cards.length} card(s) waiting for production details.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-xl border border-[#e3d8c7] bg-[#fbf7ef] px-4 py-2 text-sm font-bold text-[#8b5e24]">
                ATP: {atpCount}
              </span>

              <span className="rounded-xl border border-[#e3d8c7] bg-[#fbf7ef] px-4 py-2 text-sm font-bold text-[#8b5e24]">
                Non-BIR: {nonBirCount}
              </span>

              <span className="rounded-xl border border-[#e3d8c7] bg-[#fbf7ef] px-4 py-2 text-sm font-bold text-[#8b5e24]">
                Queue: {cards.length}
              </span>
            </div>
          </div>

          {cards.length === 0 ? (
            <div className="rounded-xl border border-[#eee4d6] bg-[#fbf7ef] p-6 text-sm text-[#6f6254]">
              No cards waiting for production details.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[#eee4d6]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#fbf7ef] text-[#6f6254]">
                  <tr>
                    <th className="p-4">Type</th>
                    <th className="p-4">Card Name</th>
                    <th className="p-4">Card ID</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {cards.map((card) => (
                    <tr key={card.id} className="border-t border-[#eee4d6]">
                      <td className="p-4">
                        <span
                          className={`rounded-md px-3 py-1 text-xs font-black ${
                            card.type === "ATP"
                              ? "bg-[#f8ead3] text-[#8b5e24]"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {card.type}
                        </span>
                      </td>

                      <td className="p-4">
                        <p className="font-bold text-black">{card.name}</p>
                        <p className="mt-1 text-xs text-[#7c6a56]">
                          Waiting for production details
                        </p>
                      </td>

                      <td className="p-4 font-mono text-xs text-[#7c6a56]">
                        {card.id}
                      </td>

                      <td className="p-4">
                        <div className="flex justify-end gap-3">
                          <Link
                            href={`/production/${card.id}`}
                            className="rounded-xl border border-[#dfd4c4] bg-white px-4 py-2 text-sm font-bold text-[#3f352a] hover:bg-[#fbf7ef]"
                          >
                            View
                          </Link>

                          <Link
                            href={`/production/${card.id}/edit`}
                            className="rounded-xl bg-[#e1bb5f] px-4 py-2 text-sm font-black text-black hover:bg-[#edca73]"
                          >
                            Complete Details
                          </Link>

                          <a
                            href={card.url}
                            target="_blank"
                            className="rounded-xl border border-[#dfd4c4] bg-white px-4 py-2 text-sm font-bold text-[#3f352a] hover:bg-[#fbf7ef]"
                          >
                            Trello
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="mt-10 text-center text-xs text-[#7c6a56]">
          © 2026 LIC Printing Shop. Production Management System.
        </footer>
      </div>
    </AppShell>
  );
}