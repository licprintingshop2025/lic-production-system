const SYSTEM_MANAGED_FIELDS = [
  "PRODUCTION START",
  "INITIAL DUE DATE",
  "FINAL DUE DATE",
  "INITIAL COMMITMENT STATUS",
  "INITIAL DUE WD",
  "FINAL DUE WD",
  "DELIVERY STRATEGY",
  "ORDER PRIORITY",
] as const;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractManagedLine(desc: string, label: string) {
  const regex = new RegExp(`^${escapeRegExp(label)}:\\s*([^\\n]*)$`, "im");
  return desc.match(regex)?.[1]?.trim() || "";
}

function replaceOrAppendLine(desc: string, label: string, value: string) {
  const regex = new RegExp(`^${escapeRegExp(label)}:.*$`, "im");
  const line = `${label}: ${value}`;

  if (regex.test(desc)) {
    return desc.replace(regex, line);
  }

  return `${desc.trim()}\n${line}`.trim();
}

export function preserveProductionDescription(
  currentDesc: string,
  sourceDesc: string,
) {
  let result = sourceDesc.trim();

  for (const label of SYSTEM_MANAGED_FIELDS) {
    const value = extractManagedLine(currentDesc, label);
    if (value) {
      result = replaceOrAppendLine(result, label, value);
    }
  }

  return result;
}

export async function loadTrelloCardForEdit(
  cardId: string,
  key: string,
  token: string,
) {
  const response = await fetch(
    `https://api.trello.com/1/cards/${encodeURIComponent(cardId)}?fields=id,name,desc,url,idList,due&key=${key}&token=${token}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error(`Failed to load Trello card: ${await response.text()}`);
  }

  return (await response.json()) as {
    id: string;
    name: string;
    desc: string;
    url?: string;
    idList?: string;
    due?: string | null;
  };
}

export async function updateTrelloCardNameAndDescription({
  cardId,
  name,
  desc,
  key,
  token,
}: {
  cardId: string;
  name: string;
  desc: string;
  key: string;
  token: string;
}) {
  const response = await fetch(
    `https://api.trello.com/1/cards/${encodeURIComponent(cardId)}?key=${key}&token=${token}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, desc }),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to update Trello card: ${await response.text()}`);
  }

  return response.json();
}
