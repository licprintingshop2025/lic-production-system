type Props = {
  params: Promise<{
    cardId: string;
  }>;
};

type TrelloChecklist = {
  id: string;
  name: string;
  checkItems: {
    id: string;
    name: string;
    state: "complete" | "incomplete";
  }[];
};

type TrelloCard = {
  id: string;
  name: string;
  desc: string;
  url: string;
  labels?: { id: string; name?: string; color?: string }[];
  checklists?: TrelloChecklist[];
};

async function getCard(cardId: string) {
  const res = await fetch(`http://localhost:3000/api/trello/card/${cardId}`, {
    cache: "no-store",
  });

  if (!res.ok) return null;

  const data = await res.json();
  return data.card as TrelloCard;
}

export default async function ProductionJobPage({ params }: Props) {
  const { cardId } = await params;
  const card = await getCard(cardId);
  const hasProductionDetails = card?.desc?.includes(
    "COMPLETED PRODUCTION DETAILS"
  );
  const hasRushLabel = card?.labels?.some(
    (label) => label.name?.toLowerCase() === "rush"
  );
  const statusChecklist = card?.checklists?.find(
    (checklist) => checklist.name.toLowerCase() === "status"
  );
  const doneItem = statusChecklist?.checkItems.find(
    (item) => item.name.toLowerCase() === "done"
  );

  if (!card) {
    return (
      <main className="min-h-screen bg-[#070A0F] p-8 text-white">
        <h1 className="text-2xl font-bold text-red-400">Job not found</h1>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070A0F] p-8 text-white">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-bold text-yellow-400">{card.name}</h1>

        <p className="mt-2 text-sm text-zinc-400">Production Job Details</p>

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-[#0D1118] p-6">
          <h2 className="mb-4 text-xl font-bold">ATP / Job Information</h2>

          <pre className="whitespace-pre-wrap rounded-xl bg-zinc-950 p-5 text-sm text-zinc-300">
            {card.desc}
          </pre>
        </section>

        <section className="mt-8 rounded-2xl border border-yellow-400/30 bg-[#0D1118] p-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <h2 className="text-xl font-bold">Staff Trello Workflow</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Trello remains usable for station work. Use the LIC app for
                structured job details; use Trello for movement, Rush labels,
                comments, attachments, and the Status checklist.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {hasRushLabel && (
                <span className="rounded-lg bg-red-500 px-3 py-2 text-xs font-bold text-white">
                  Rush Label
                </span>
              )}

              <span
                className={`rounded-lg px-3 py-2 text-xs font-bold ${
                  doneItem?.state === "complete"
                    ? "bg-green-500 text-black"
                    : "bg-zinc-800 text-zinc-300"
                }`}
              >
                Done Checklist:{" "}
                {doneItem?.state === "complete" ? "Checked" : "Open"}
              </span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-zinc-950 p-5">
              <h3 className="font-bold text-green-400">Safe in Trello</h3>
              <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                <li>Move cards between workflow lists.</li>
                <li>Add or remove the Rush label.</li>
                <li>Check Status / Done when station work is complete.</li>
                <li>Add comments, attachments, and internal notes.</li>
              </ul>
            </div>

            <div className="rounded-xl bg-zinc-950 p-5">
              <h3 className="font-bold text-yellow-400">Keep Structured</h3>
              <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                <li>Do not manually rewrite tracking number fields.</li>
                <li>Do not change core ATP details in free text.</li>
                <li>
                  Use the LIC production details form for paper, ply, size, and
                  priority.
                </li>
                <li>Keep Rush as a Trello label, not only description text.</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {!hasProductionDetails && (
              <a
                href={`/production/${card.id}/edit`}
                className="inline-block rounded-xl border border-yellow-400 px-6 py-3 font-bold text-yellow-400 hover:bg-yellow-400 hover:text-black"
              >
                Complete Production Details
              </a>
            )}

            <a
              href={card.url}
              target="_blank"
              className="inline-block rounded-xl bg-yellow-400 px-6 py-3 font-bold text-black"
            >
              Open in Trello
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
