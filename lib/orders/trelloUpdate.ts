const SYSTEM_MANAGED_FIELDS = [
  "PRIORITY",
  "ORDER PRIORITY",

  "DELIVERY STRATEGY",
  "INITIAL RELEASE QTY",
  "INITIAL DUE WD",
  "FINAL DUE WD",

  "PRODUCTION START",
  "INITIAL DUE DATE",
  "FINAL DUE DATE",
  "INITIAL COMMITMENT STATUS",

  "PAPER",
  "PLY",
  "SIZE",
  "SPECIAL",
  "STATUS",
] as const;

const DOCUMENT_SPECIFICATIONS_START =
  "DOCUMENT SPECIFICATIONS START";

const DOCUMENT_SPECIFICATIONS_END =
  "DOCUMENT SPECIFICATIONS END";

function escapeRegExp(
  value: string,
) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
}

function extractManagedLine(
  desc: string,
  label: string,
) {
  const regex =
    new RegExp(
      `^${escapeRegExp(
        label,
      )}:\\s*([^\\n]*)$`,
      "im",
    );

  return (
    desc.match(regex)?.[1]?.trim() ||
    ""
  );
}

function replaceOrAppendLine(
  desc: string,
  label: string,
  value: string,
) {
  const regex =
    new RegExp(
      `^${escapeRegExp(
        label,
      )}:.*$`,
      "im",
    );

  const line =
    `${label}: ${value}`;

  if (regex.test(desc)) {
    return desc.replace(
      regex,
      line,
    );
  }

  return `${desc.trim()}\n${line}`.trim();
}

function extractDocumentSpecificationsBlock(
  desc: string,
) {
  const startIndex =
    desc.indexOf(
      DOCUMENT_SPECIFICATIONS_START,
    );

  const endIndex =
    desc.indexOf(
      DOCUMENT_SPECIFICATIONS_END,
    );

  if (
    startIndex < 0 ||
    endIndex < 0 ||
    endIndex <= startIndex
  ) {
    return "";
  }

  return desc
    .slice(
      startIndex,
      endIndex +
        DOCUMENT_SPECIFICATIONS_END.length,
    )
    .trim();
}

function removeDocumentSpecificationsBlock(
  desc: string,
) {
  const startIndex =
    desc.indexOf(
      DOCUMENT_SPECIFICATIONS_START,
    );

  const endIndex =
    desc.indexOf(
      DOCUMENT_SPECIFICATIONS_END,
    );

  if (
    startIndex < 0 ||
    endIndex < 0 ||
    endIndex <= startIndex
  ) {
    return desc.trim();
  }

  const before =
    desc
      .slice(
        0,
        startIndex,
      )
      .trimEnd();

  const after =
    desc
      .slice(
        endIndex +
          DOCUMENT_SPECIFICATIONS_END.length,
      )
      .trimStart();

  return [
    before,
    after,
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

export function preserveProductionDescription(
  currentDesc: string,
  sourceDesc: string,
) {
  /*
   * sourceDesc:
   * Newly generated order information.
   *
   * currentDesc:
   * Existing Trello description containing
   * production information.
   */

  let result =
    removeDocumentSpecificationsBlock(
      sourceDesc,
    );

  /*
   * Preserve production-managed fields.
   */
  for (
    const label of
    SYSTEM_MANAGED_FIELDS
  ) {
    const value =
      extractManagedLine(
        currentDesc,
        label,
      );

    if (value) {
      result =
        replaceOrAppendLine(
          result,
          label,
          value,
        );
    }
  }

  /*
   * Preserve per-document production
   * specifications.
   */
  const documentSpecifications =
    extractDocumentSpecificationsBlock(
      currentDesc,
    );

  if (documentSpecifications) {
    result = `${result.trim()}

${documentSpecifications}`.trim();
  }

  return result;
}

export async function loadTrelloCardForEdit(
  cardId: string,
  key: string,
  token: string,
) {
  const response =
    await fetch(
      `https://api.trello.com/1/cards/${encodeURIComponent(
        cardId,
      )}?fields=id,name,desc,url,idList,due&key=${key}&token=${token}`,
      {
        cache: "no-store",
      },
    );

  if (!response.ok) {
    throw new Error(
      `Failed to load Trello card: ${await response.text()}`,
    );
  }

  return (
    await response.json()
  ) as {
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
  const response =
    await fetch(
      `https://api.trello.com/1/cards/${encodeURIComponent(
        cardId,
      )}?key=${key}&token=${token}`,
      {
        method: "PUT",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          name,
          desc,
        }),
      },
    );

  if (!response.ok) {
    throw new Error(
      `Failed to update Trello card: ${await response.text()}`,
    );
  }

  return response.json();
}