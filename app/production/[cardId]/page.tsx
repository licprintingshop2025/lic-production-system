import AppShell from "../../components/AppShell";
import PageHeader from "../../components/PageHeader";
import {
  findReceivedATPByCardId,
  findNonBIROrderByCardId,
  findBIRProductionRecordByCardId,
} from "@/lib/googleSheets";

type Props = {
  params: Promise<{
    cardId: string;
  }>;
};

type TrelloCard = {
  id: string;
  name: string;
  desc: string;
  url: string;
};

type ParsedDetails = Record<string, string>;

async function getCard(cardId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/trello/card/${cardId}`, {
    cache: "no-store",
  });

  if (!res.ok) return null;

  const data = await res.json();
  return data.card as TrelloCard;
}

function clean(value?: string | null) {
  if (!value) return "";
  const trimmed = value.toString().trim();

  if (!trimmed || trimmed === "-") return "";

  return trimmed;
}

function prefer(...values: (string | undefined | null)[]) {
  return values.map(clean).find(Boolean) || "-";
}

function parseDescription(desc: string): ParsedDetails {
  const result: ParsedDetails = {};

  const lines = desc
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes(":")) {
      const [rawKey, ...rest] = line.split(":");
      const key = rawKey.trim().toUpperCase();
      const value = rest.join(":").trim();

      if (value) {
        result[key] = value;
      }

      continue;
    }

    const key = line.replace(/:$/, "").toUpperCase();
    const nextValue = lines[i + 1] || "";

    if (nextValue && !nextValue.includes(":")) {
      result[key] = nextValue;
    }
  }

  return result;
}

export default async function ProductionJobPage({ params }: Props) {
  const { cardId } = await params;

  const card = await getCard(cardId);
  const productionRecord = await findBIRProductionRecordByCardId(cardId);
  const birRecord = await findReceivedATPByCardId(cardId);
  const nonBirRecord = await findNonBIROrderByCardId(cardId);

  if (!card) {
    return (
      <AppShell activePage="production">
        <PageHeader
          title="Job Not Found"
          description="The selected Trello card could not be loaded."
        />
      </AppShell>
    );
  }

  const parsed = parseDescription(card.desc || "");

  const isNonBir =
    !!nonBirRecord ||
    card.name.toUpperCase().includes("NON-BIR") ||
    card.name.toUpperCase().includes("NON BIR");

  const birRow = productionRecord?.row || birRecord?.row || [];
  const nonBirRow = nonBirRecord?.row || [];

  const trackingNo = isNonBir
    ? prefer(nonBirRow[0], parsed["TRACKING NUMBER"], parsed["TRACKING"])
    : prefer(
        birRow[1],
        birRow[0],
        parsed["TRACKING NUMBER"],
        parsed["TRACKING"]
      );

  const dateAtp = isNonBir ? "-" : prefer(birRow[2], birRow[1]);
  const ocn = isNonBir ? "-" : prefer(birRow[3], birRow[2], parsed["OCN"]);
  const tin = isNonBir ? "-" : prefer(birRow[4], birRow[3], parsed["TIN"]);

  const taxpayer = isNonBir
    ? "-"
    : prefer(birRow[5], birRow[4], parsed["TAXPAYER"]);

  const businessName = isNonBir
    ? prefer(nonBirRow[2], parsed["BUSINESS"], parsed["BUSINESS NAME"])
    : prefer(
        birRow[6],
        birRow[5],
        parsed["TRADE NAME"],
        parsed["BUSINESS"],
        parsed["BUSINESS NAME"]
      );

  const registeredAddress = isNonBir
    ? "-"
    : prefer(birRow[7], birRow[6], parsed["ADDRESS"]);

  const rdoCode = isNonBir
    ? "-"
    : prefer(birRow[8], birRow[7], parsed["RDO"], parsed["RDO CODE"]);

  const manner = isNonBir
    ? "-"
    : prefer(birRow[9], birRow[8], parsed["MANNER"]);

  const documentType = isNonBir
    ? prefer(nonBirRow[3], parsed["DOCUMENT"], parsed["DESCRIPTION"])
    : prefer(birRow[10], birRow[9], parsed["DOCUMENT"], parsed["DESCRIPTION"]);

  const taxType = isNonBir
    ? "NON-BIR"
    : prefer(birRow[11], birRow[10], parsed["TAX TYPE"]);

  const quantity = isNonBir
    ? prefer(nonBirRow[4], parsed["QTY"], parsed["QUANTITY"], parsed["BOOKLETS"])
    : prefer(birRow[12], birRow[11], parsed["QTY"], parsed["QUANTITY"]);

  const sets = isNonBir ? "-" : prefer(birRow[13], birRow[12], parsed["SETS"]);

  const copies = isNonBir
    ? "-"
    : prefer(birRow[14], birRow[13], parsed["COPIES"]);

  const serialNumbers = isNonBir
    ? prefer(nonBirRow[5], parsed["SERIAL"], parsed["SERIAL NUMBERS"])
    : prefer(
        birRow[15],
        birRow[14],
        parsed["SERIAL"],
        parsed["SERIAL NUMBERS"]
      );

  const atpReceived = isNonBir
    ? "-"
    : prefer(birRow[16], birRow[15], parsed["ATP"], parsed["ATP RECEIVED"]);

  const salesAssigned = isNonBir
    ? prefer(nonBirRow[6], parsed["SALES ASSIGNED"])
    : prefer(birRow[17], birRow[16], parsed["SALES ASSIGNED"]);

  const paper = prefer(parsed["PAPER"], parsed["PAPER TYPE"], birRow[19]);

  const ply = prefer(
    parsed["PLY"],
    parsed["NO. OF PLY"],
    parsed["NO OF PLY"],
    birRow[20]
  );

  const size = prefer(parsed["SIZE"], parsed["PAPER SIZE"], birRow[21]);

  const priority = prefer(
    parsed["PRIORITY"],
    parsed["ORDER PRIORITY"],
    birRow[22],
    "Normal"
  );

  const specialInstructions = prefer(
    parsed["SPECIAL"],
    parsed["SPECIAL INSTRUCTIONS"],
    parsed["INSTRUCTIONS"],
    parsed["REMARKS"],
    birRow[23]
  );

  const detailsComplete =
    !!productionRecord || card.desc?.includes("COMPLETED PRODUCTION DETAILS");

  return (
    <AppShell activePage="production">
      <div className="mx-auto max-w-[1200px]">
        <section className="rounded-xl border border-[#e6ddd1] bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-[#8b5e24]">
                Job Card
              </p>

              <h1 className="mt-3 text-3xl font-black text-black">
                {card.name}
              </h1>

              <p className="mt-2 text-sm text-[#6f6254]">
                Trello Card ID: {card.id}
              </p>
            </div>

            <span className="rounded-lg bg-[#f8ead3] px-4 py-2 text-sm font-black text-[#8b5e24]">
              Done Checklist: Open
            </span>
          </div>
        </section>

        <section className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-4">
          <InfoCard title="Tracking No." value={trackingNo} />
          <InfoCard title="Tax Type" value={taxType} />
          <InfoCard title="Priority" value={priority} />
          <InfoCard
            title="Status"
            value={detailsComplete ? "Details Complete" : "Pending Details"}
            green={detailsComplete}
          />
        </section>

        <section className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <section className="rounded-xl border border-[#e6ddd1] bg-white p-6 shadow-sm">
            <SectionHeader
              number="01"
              title="Business Information"
              description={
                isNonBir
                  ? "Non-BIR order details."
                  : "Taxpayer and registered business details."
              }
            />

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Detail label="Date of ATP" value={dateAtp} />
              <Detail label="Business / Trade Name" value={businessName} />
              <Detail label="Taxpayer" value={taxpayer} />
              <Detail label="TIN" value={tin} />
              <Detail label="OCN" value={ocn} />
              <Detail label="RDO Code" value={rdoCode} />
              <Detail label="Sales Assigned" value={salesAssigned} />

              <div className="md:col-span-2">
                <Detail label="Registered Address" value={registeredAddress} />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-[#e6ddd1] bg-white p-6 shadow-sm">
            <SectionHeader
              number="02"
              title="Printing Details"
              description="Booklet, serial, ATP, and print specifications."
            />

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Detail label="Manner" value={manner} />
              <Detail label="ATP" value={atpReceived} />
              <Detail label="Quantity" value={quantity} />
              <Detail label="Sets" value={sets} />
              <Detail label="Copies" value={copies} />
              <Detail label="Serial Numbers" value={serialNumbers} />
              <Detail label="Document" value={documentType} />
              <Detail label="Paper" value={paper} />
              <Detail label="Ply" value={ply} />
              <Detail label="Size" value={size} />

              <div className="md:col-span-2">
                <Detail
                  label="Special Instructions"
                  value={specialInstructions}
                />
              </div>
            </div>
          </section>
        </section>

        <BottomActions trelloUrl={card.url} />
      </div>
    </AppShell>
  );
}

function SectionHeader({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6 flex items-start gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f8ead3] text-sm font-black text-[#8b5e24]">
        {number}
      </div>

      <div>
        <h2 className="text-xl font-black text-black">{title}</h2>
        <p className="mt-1 text-sm text-[#6f6254]">{description}</p>
      </div>
    </div>
  );
}

function InfoCard({
  title,
  value,
  green = false,
}: {
  title: string;
  value: string;
  green?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#e6ddd1] bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-widest text-[#8b5e24]">
        {title}
      </p>

      <p
        className={`mt-3 inline-block rounded-lg px-3 py-2 text-sm font-black ${
          green
            ? "bg-green-100 text-green-700"
            : "bg-[#f8ead3] text-[#8b5e24]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-2 text-xs font-black uppercase tracking-widest text-[#8b5e24]">
        {label}
      </p>

      <div className="rounded-lg border border-[#e6ddd1] bg-[#fbf7ef] p-4 text-sm font-bold text-black">
        {value}
      </div>
    </div>
  );
}

function BottomActions({ trelloUrl }: { trelloUrl: string }) {
  return (
    <div className="sticky bottom-0 z-20 -mx-6 mt-8 border-t border-[#e6ddd1] bg-[#fffaf2]/95 px-6 py-5 backdrop-blur lg:-mx-8 lg:px-8">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-xs text-[#6f6254]">
          Use this page to review job details. Google Sheets provides record
          details, while Trello fills missing production details.
        </p>

        <div className="flex gap-3">
          <a
            href="/production"
            className="rounded-lg border border-[#e6ddd1] bg-white px-6 py-3 text-sm font-bold text-black hover:bg-[#fbf7ef]"
          >
            Back to Queue
          </a>

          <a
            href={trelloUrl}
            target="_blank"
            className="rounded-lg bg-[#e1bb5f] px-6 py-3 text-sm font-black text-black hover:bg-[#edca73]"
          >
            Open in Trello
          </a>
        </div>
      </div>
    </div>
  );
}