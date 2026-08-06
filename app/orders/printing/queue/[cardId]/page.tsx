import AppShell from "@/app/components/AppShell";
import PageHeader from "@/app/components/PageHeader";
import {
  findBIRProductionRecordByCardId,
  findNonBIROrderByCardId,
  findReceivedATPByCardId,
} from "@/lib/googleSheets";
import Link from "next/link";

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

type ParsedDetails = Record<
  string,
  string
>;

async function getCard(
  cardId: string,
) {
  const baseUrl =
    process.env
      .NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  const response = await fetch(
    `${baseUrl}/api/trello/card/${encodeURIComponent(
      cardId,
    )}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return null;
  }

  const data =
    (await response.json()) as {
      card?: TrelloCard;
    };

  return data.card || null;
}

function clean(
  value?: string | null,
) {
  if (!value) {
    return "";
  }

  const trimmed = value
    .toString()
    .trim();

  if (
    !trimmed ||
    trimmed === "-"
  ) {
    return "";
  }

  return trimmed;
}

function prefer(
  ...values: (
    | string
    | undefined
    | null
  )[]
) {
  return (
    values.map(clean).find(Boolean) ||
    "-"
  );
}

function parseDescription(
  desc: string,
): ParsedDetails {
  const result: ParsedDetails = {};

  const lines = desc
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (
    let index = 0;
    index < lines.length;
    index += 1
  ) {
    const line = lines[index];

    if (line.includes(":")) {
      const [rawKey, ...rest] =
        line.split(":");

      const key = rawKey
        .trim()
        .toUpperCase();

      const value = rest
        .join(":")
        .trim();

      if (value) {
        result[key] = value;
      }

      continue;
    }

    const key = line
      .replace(/:$/, "")
      .toUpperCase();

    const nextValue =
      lines[index + 1] || "";

    if (
      nextValue &&
      !nextValue.includes(":")
    ) {
      result[key] = nextValue;
    }
  }

  return result;
}

export default async function ProductionJobPage({
  params,
}: Props) {
  const { cardId } = await params;

  const card = await getCard(cardId);

  const productionRecord =
    await findBIRProductionRecordByCardId(
      cardId,
    );

  const birRecord =
    await findReceivedATPByCardId(
      cardId,
    );

  const nonBirRecord =
    await findNonBIROrderByCardId(
      cardId,
    );

  if (!card) {
    return (
      <AppShell
        activePage="production"
        contentWidth="standard"
      >
        <PageHeader
          eyebrow="Orders / Printing / Queue"
          title="Job Not Found"
          description="The selected Trello card could not be loaded."
        />

        <section className="mt-7 rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <p className="text-sm font-black text-red-700">
            The job card does not
            exist or could not be
            retrieved from Trello.
          </p>

          <Link
            href="/orders/printing/queue"
            className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-black px-5 text-sm font-black text-white transition hover:bg-[#6b421f]"
          >
            Back to Queue
          </Link>
        </section>
      </AppShell>
    );
  }

  const parsed =
    parseDescription(
      card.desc || "",
    );

  const isNonBir =
    Boolean(nonBirRecord) ||
    card.name
      .toUpperCase()
      .includes("NON-BIR") ||
    card.name
      .toUpperCase()
      .includes("NON BIR");

  const birRow =
    productionRecord?.row ||
    birRecord?.row ||
    [];

  const nonBirRow =
    nonBirRecord?.row || [];

  const trackingNo = isNonBir
    ? prefer(
        nonBirRow[0],
        parsed[
          "TRACKING NUMBER"
        ],
        parsed["TRACKING"],
      )
    : prefer(
        birRow[1],
        birRow[0],
        parsed[
          "TRACKING NUMBER"
        ],
        parsed["TRACKING"],
      );

  const dateAtp = isNonBir
    ? "-"
    : prefer(
        birRow[2],
        birRow[1],
      );

  const ocn = isNonBir
    ? "-"
    : prefer(
        birRow[3],
        birRow[2],
        parsed["OCN"],
      );

  const tin = isNonBir
    ? "-"
    : prefer(
        birRow[4],
        birRow[3],
        parsed["TIN"],
      );

  const taxpayer = isNonBir
    ? "-"
    : prefer(
        birRow[5],
        birRow[4],
        parsed["TAXPAYER"],
      );

  const businessName = isNonBir
    ? prefer(
        nonBirRow[2],
        parsed["BUSINESS"],
        parsed[
          "BUSINESS NAME"
        ],
      )
    : prefer(
        birRow[6],
        birRow[5],
        parsed["TRADE NAME"],
        parsed["BUSINESS"],
        parsed[
          "BUSINESS NAME"
        ],
      );

  const registeredAddress =
    isNonBir
      ? "-"
      : prefer(
          birRow[7],
          birRow[6],
          parsed["ADDRESS"],
        );

  const rdoCode = isNonBir
    ? "-"
    : prefer(
        birRow[8],
        birRow[7],
        parsed["RDO"],
        parsed["RDO CODE"],
      );

  const manner = isNonBir
    ? "-"
    : prefer(
        birRow[9],
        birRow[8],
        parsed["MANNER"],
      );

  const documentType = isNonBir
    ? prefer(
        nonBirRow[3],
        parsed["DOCUMENT"],
        parsed["DESCRIPTION"],
      )
    : prefer(
        birRow[10],
        birRow[9],
        parsed["DOCUMENT"],
        parsed["DESCRIPTION"],
      );

  const taxType = isNonBir
    ? "NON-BIR"
    : prefer(
        birRow[11],
        birRow[10],
        parsed["TAX TYPE"],
      );

  const quantity = isNonBir
    ? prefer(
        nonBirRow[4],
        parsed["QTY"],
        parsed["QUANTITY"],
        parsed["BOOKLETS"],
      )
    : prefer(
        birRow[12],
        birRow[11],
        parsed["QTY"],
        parsed["QUANTITY"],
      );

  const sets = isNonBir
    ? "-"
    : prefer(
        birRow[13],
        birRow[12],
        parsed["SETS"],
      );

  const copies = isNonBir
    ? "-"
    : prefer(
        birRow[14],
        birRow[13],
        parsed["COPIES"],
      );

  const serialNumbers = isNonBir
    ? prefer(
        nonBirRow[5],
        parsed["SERIAL"],
        parsed[
          "SERIAL NUMBERS"
        ],
      )
    : prefer(
        birRow[15],
        birRow[14],
        parsed["SERIAL"],
        parsed[
          "SERIAL NUMBERS"
        ],
      );

  const atpReceived = isNonBir
    ? "-"
    : prefer(
        birRow[16],
        birRow[15],
        parsed["ATP"],
        parsed[
          "ATP RECEIVED"
        ],
      );

  const salesAssigned = isNonBir
    ? prefer(
        nonBirRow[6],
        parsed[
          "SALES ASSIGNED"
        ],
      )
    : prefer(
        birRow[17],
        birRow[16],
        parsed[
          "SALES ASSIGNED"
        ],
      );

  const paper = prefer(
    parsed["PAPER"],
    parsed["PAPER TYPE"],
    birRow[19],
  );

  const ply = prefer(
    parsed["PLY"],
    parsed["NO. OF PLY"],
    parsed["NO OF PLY"],
    birRow[20],
  );

  const size = prefer(
    parsed["SIZE"],
    parsed["PAPER SIZE"],
    birRow[21],
  );

  const priority = prefer(
    parsed["PRIORITY"],
    parsed[
      "ORDER PRIORITY"
    ],
    birRow[22],
    "Normal",
  );

  const specialInstructions =
    prefer(
      parsed["SPECIAL"],
      parsed[
        "SPECIAL INSTRUCTIONS"
      ],
      parsed["INSTRUCTIONS"],
      parsed["REMARKS"],
      birRow[23],
    );

  const detailsComplete =
    Boolean(productionRecord) ||
    card.desc?.includes(
      "COMPLETED PRODUCTION DETAILS",
    );

  return (
    <AppShell
      activePage="production"
      contentWidth="standard"
    >
      <PageHeader
        eyebrow="Orders / Printing / Queue"
        title="Production Job Details"
        description="Review the intake record and available printing specifications before completing production details."
      />

      <section className="mt-7 overflow-hidden rounded-2xl border border-[#e3d8c7] bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-5 border-b border-[#eee5d8] bg-[#fbf7ef] px-5 py-5 sm:px-7 md:flex-row md:items-start">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6b421f]">
              Job Card
            </p>

            <h1 className="mt-2 text-2xl font-black leading-tight text-black sm:text-3xl">
              {card.name}
            </h1>

            <p className="mt-2 break-all text-sm text-[#6f6254]">
              Trello Card ID:{" "}
              <span className="font-mono">
                {card.id}
              </span>
            </p>
          </div>

          <span className="inline-flex h-10 shrink-0 items-center rounded-lg border border-[#d8cbb9] bg-white px-4 text-sm font-black text-[#6b421f]">
            Done Checklist: Open
          </span>
        </div>
      </section>

      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard
          title="Tracking No."
          value={trackingNo}
        />

        <InfoCard
          title="Tax Type"
          value={taxType}
        />

        <InfoCard
          title="Priority"
          value={priority}
        />

        <InfoCard
          title="Status"
          value={
            detailsComplete
              ? "Details Complete"
              : "Pending Details"
          }
          green={
            detailsComplete
          }
        />
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <DetailSection
          number="1"
          title="Business Information"
          description={
            isNonBir
              ? "Non-BIR order details."
              : "Taxpayer and registered business details."
          }
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Detail
              label="Date of ATP"
              value={dateAtp}
            />

            <Detail
              label="Business / Trade Name"
              value={businessName}
            />

            <Detail
              label="Taxpayer"
              value={taxpayer}
            />

            <Detail
              label="TIN"
              value={tin}
            />

            <Detail
              label="OCN"
              value={ocn}
            />

            <Detail
              label="RDO Code"
              value={rdoCode}
            />

            <Detail
              label="Sales Assigned"
              value={salesAssigned}
            />

            <div className="md:col-span-2">
              <Detail
                label="Registered Address"
                value={
                  registeredAddress
                }
              />
            </div>
          </div>
        </DetailSection>

        <DetailSection
          number="2"
          title="Printing Details"
          description="Booklet, serial, ATP, and print specifications."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Detail
              label="Manner"
              value={manner}
            />

            <Detail
              label="ATP"
              value={atpReceived}
            />

            <Detail
              label="Quantity"
              value={quantity}
            />

            <Detail
              label="Sets"
              value={sets}
            />

            <Detail
              label="Copies"
              value={copies}
            />

            <Detail
              label="Serial Numbers"
              value={serialNumbers}
            />

            <Detail
              label="Document"
              value={documentType}
            />

            <Detail
              label="Paper"
              value={paper}
            />

            <Detail
              label="Ply"
              value={ply}
            />

            <Detail
              label="Size"
              value={size}
            />

            <div className="md:col-span-2">
              <Detail
                label="Special Instructions"
                value={
                  specialInstructions
                }
              />
            </div>
          </div>
        </DetailSection>
      </section>

      <BottomActions
        trelloUrl={card.url}
        cardId={card.id}
        detailsComplete={
          detailsComplete
        }
      />
    </AppShell>
  );
}

function DetailSection({
  number,
  title,
  description,
  children,
}: {
  number: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#e3d8c7] bg-white shadow-sm">
      <div className="border-b border-[#eee5d8] bg-[#fbf7ef] px-5 py-4 sm:px-7">
        <div className="flex items-start gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-sm font-black text-white">
            {number}
          </div>

          <div>
            <h2 className="text-lg font-black text-black">
              {title}
            </h2>

            <p className="mt-1 text-sm leading-6 text-[#6f6254]">
              {description}
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-7">
        {children}
      </div>
    </section>
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
    <article className="rounded-2xl border border-[#e3d8c7] bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6b421f]">
        {title}
      </p>

      <p
        className={`mt-3 inline-flex rounded-md px-3 py-2 text-sm font-black ${
          green
            ? "bg-green-100 text-green-700"
            : "bg-[#f3eadc] text-[#6b421f]"
        }`}
      >
        {value}
      </p>
    </article>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#6b421f]">
        {label}
      </p>

      <div className="min-h-12 rounded-lg border border-[#e3d8c7] bg-[#fbf7ef] px-4 py-3 text-sm font-bold text-black">
        {value}
      </div>
    </div>
  );
}

function BottomActions({
  trelloUrl,
  cardId,
  detailsComplete,
}: {
  trelloUrl: string;
  cardId: string;
  detailsComplete: boolean;
}) {
  return (
    <section className="mt-6 flex flex-col gap-5 rounded-2xl border border-[#e3d8c7] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="max-w-2xl text-xs leading-5 text-[#7c6a56]">
        Use this page to review
        job details. Google Sheets
        provides record details,
        while Trello fills missing
        production details.
      </p>

      <div className="flex shrink-0 flex-col-reverse gap-3 sm:flex-row">
        <Link
          href="/orders/printing/queue"
          className="inline-flex h-12 items-center justify-center rounded-lg border border-[#cfc1ae] bg-white px-6 text-sm font-black text-black transition hover:bg-[#f8f2e8]"
        >
          Back to Queue
        </Link>

        {!detailsComplete && (
          <Link
            href={`/orders/printing/queue/${encodeURIComponent(
              cardId,
            )}/edit`}
            className="inline-flex h-12 items-center justify-center rounded-lg bg-black px-6 text-sm font-black text-white transition hover:bg-[#6b421f]"
          >
            Complete Details
          </Link>
        )}

        <a
          href={trelloUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex h-12 items-center justify-center rounded-lg px-6 text-sm font-black transition ${
            detailsComplete
              ? "bg-black text-white hover:bg-[#6b421f]"
              : "border border-[#cfc1ae] bg-white text-black hover:bg-[#f8f2e8]"
          }`}
        >
          Open in Trello
        </a>
      </div>
    </section>
  );
}