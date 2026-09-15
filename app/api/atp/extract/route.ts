import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const receiptTypes = [
  "SALES INVOICE",
  "SERVICE INVOICE",
  "BILLING INVOICE",
  "VAT INVOICE",
  "NON-VAT INVOICE",
  "INVOICE",
  "OFFICIAL RECEIPT",
  "COLLECTION RECEIPT",
  "DELIVERY RECEIPT",
  "ACKNOWLEDGEMENT RECEIPT",
  "ORDER SLIP",
  "DISBURSEMENT VOUCHER",
  "OTHER",
] as const;

const mannerTypes = ["BOUND", "LOOSE", "MANUAL", "COMPUTERIZED"] as const;

type ReceiptType = (typeof receiptTypes)[number];

type MannerType = (typeof mannerTypes)[number];

type ATPDocumentExtraction = {
  description: ReceiptType | "";
  descriptionOther: string;
  manner: MannerType | "";
  booklets: string;
  setsPerBooklet: string;
  copiesPerSet: string;
  copiesPerSetOther: string;
  serialNumbers: string;
};

type ATPExtraction = {
  dateOfAtp: string;
  ocn: string;
  tin: string;
  taxpayerName: string;
  businessName: string;
  registeredAddress: string;
  rdoCode: string;
  taxType: "VAT" | "NON-VAT" | "";
  documents: ATPDocumentExtraction[];
  overallConfidence: "high" | "medium" | "low";
  warnings: string[];
};

type OpenAIResponse = {
  status?: string;

  incomplete_details?: {
    reason?: string;
  };

  error?: {
    message?: string;
  };

  output?: Array<{
    type?: string;

    content?: Array<{
      type?: string;
      text?: string;
      refusal?: string;
    }>;
  }>;
};

const atpSchema = {
  type: "object",
  additionalProperties: false,

  properties: {
    dateOfAtp: {
      type: "string",
    },

    ocn: {
      type: "string",
    },

    tin: {
      type: "string",
    },

    taxpayerName: {
      type: "string",
    },

    businessName: {
      type: "string",
    },

    registeredAddress: {
      type: "string",
    },

    rdoCode: {
      type: "string",
    },

    taxType: {
      type: "string",
      enum: ["VAT", "NON-VAT", ""],
    },

    documents: {
      type: "array",

      items: {
        type: "object",
        additionalProperties: false,

        properties: {
          description: {
            type: "string",
            enum: [...receiptTypes, ""],
          },

          descriptionOther: {
            type: "string",
          },

          manner: {
            type: "string",
            enum: [...mannerTypes, ""],
          },

          booklets: {
            type: "string",
          },

          setsPerBooklet: {
            type: "string",
          },

          copiesPerSet: {
            type: "string",
          },

          copiesPerSetOther: {
            type: "string",
          },

          serialNumbers: {
            type: "string",
          },
        },

        required: [
          "description",
          "descriptionOther",
          "manner",
          "booklets",
          "setsPerBooklet",
          "copiesPerSet",
          "copiesPerSetOther",
          "serialNumbers",
        ],
      },
    },

    overallConfidence: {
      type: "string",
      enum: ["high", "medium", "low"],
    },

    warnings: {
      type: "array",
      items: {
        type: "string",
      },
    },
  },

  required: [
    "dateOfAtp",
    "ocn",
    "tin",
    "taxpayerName",
    "businessName",
    "registeredAddress",
    "rdoCode",
    "taxType",
    "documents",
    "overallConfidence",
    "warnings",
  ],
};

function getOutputText(response: OpenAIResponse) {
  for (const output of response.output || []) {
    if (output.type !== "message") {
      continue;
    }

    for (const content of output.content || []) {
      if (content.type === "refusal") {
        throw new Error(
          content.refusal || "The ATP image could not be processed.",
        );
      }

      if (content.type === "output_text" && content.text) {
        return content.text;
      }
    }
  }

  return "";
}

function cleanString(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim();
}

function cleanNumericString(value: unknown) {
  const text = cleanString(value);

  if (!text) {
    return "";
  }

  return /^\d+$/.test(text) ? text : "";
}

function normalizeDate(value: unknown) {
  const text = cleanString(value);

  if (!text) {
    return "";
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return "";
  }

  const [yearText, monthText, dayText] = text.split("-");

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return "";
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "";
  }

  return text;
}

function normalizeTaxType(value: unknown): ATPExtraction["taxType"] {
  const text = cleanString(value).toUpperCase();

  if (text === "VAT") {
    return "VAT";
  }

  if (text === "NON-VAT" || text === "NON VAT") {
    return "NON-VAT";
  }

  return "";
}

function normalizeReceiptType(value: unknown): ReceiptType | "" {
  const text = cleanString(value).toUpperCase();

  if (!text) {
    return "";
  }

  const match = receiptTypes.find((item) => item === text);

  return match || "";
}

function normalizeManner(value: unknown): MannerType | "" {
  const text = cleanString(value).toUpperCase();

  const match = mannerTypes.find((item) => item === text);

  return match || "";
}

function normalizeSerialNumbers(value: unknown) {
  const text = cleanString(value);

  if (!text) {
    return "";
  }

  const normalized = text.replace(/\s*[-–—]\s*/g, "-").trim();

  const match = normalized.match(/^(\d+)-(\d+)$/);

  if (!match) {
    return "";
  }

  return `${match[1]}-${match[2]}`;
}

function parseSerialRange(serialNumbers: string) {
  const match = serialNumbers.match(/^(\d+)-(\d+)$/);

  if (!match) {
    return null;
  }

  const from = Number(match[1]);
  const to = Number(match[2]);

  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) {
    return null;
  }

  return {
    from,
    to,
    count: to - from + 1,
  };
}

function addWarning(warnings: string[], warning: string) {
  if (!warnings.includes(warning)) {
    warnings.push(warning);
  }
}

function sanitizeDocument(
  rawDocument: unknown,
  index: number,
  warnings: string[],
): ATPDocumentExtraction | null {
  if (!rawDocument || typeof rawDocument !== "object") {
    return null;
  }

  const source = rawDocument as Record<string, unknown>;

  const rawDescription = cleanString(source.description);

  const rawDescriptionOther = cleanString(source.descriptionOther);

  const rawManner = cleanString(source.manner);

  const rawBooklets = cleanString(source.booklets);

  const rawSets = cleanString(source.setsPerBooklet);

  const rawCopies = cleanString(source.copiesPerSet);

  const rawCopiesOther = cleanString(source.copiesPerSetOther);

  const rawSerialNumbers = cleanString(source.serialNumbers);

  const hasAnyValue = Boolean(
    rawDescription ||
    rawDescriptionOther ||
    rawManner ||
    rawBooklets ||
    rawSets ||
    rawCopies ||
    rawCopiesOther ||
    rawSerialNumbers,
  );

  if (!hasAnyValue) {
    return null;
  }

  let description = normalizeReceiptType(source.description);

  let descriptionOther = rawDescriptionOther;

  if (!description && rawDescription) {
    const exactOtherText = rawDescription.toUpperCase();

    if (exactOtherText !== "OTHER") {
      description = "OTHER";
      descriptionOther = rawDescription;

      addWarning(
        warnings,
        `Document #${index + 1}: description did not exactly match a supported type and was saved as OTHER.`,
      );
    }
  }

  if (
    description === "OTHER" &&
    !descriptionOther &&
    rawDescription &&
    rawDescription.toUpperCase() !== "OTHER"
  ) {
    descriptionOther = rawDescription;
  }

  const manner = normalizeManner(source.manner);

  const booklets = cleanNumericString(source.booklets);

  const setsPerBooklet = cleanNumericString(source.setsPerBooklet);

  const copiesPerSet = cleanNumericString(source.copiesPerSet);

  const serialNumbers = normalizeSerialNumbers(source.serialNumbers);

  if (rawManner && !manner) {
    addWarning(
      warnings,
      `Document #${index + 1}: manner was not confidently validated.`,
    );
  }

  if (rawBooklets && !booklets) {
    addWarning(
      warnings,
      `Document #${index + 1}: number of booklets was not a clear numeric value.`,
    );
  }

  if (rawSets && !setsPerBooklet) {
    addWarning(
      warnings,
      `Document #${index + 1}: sets per booklet was not a clear numeric value.`,
    );
  }

  if (rawCopies && !copiesPerSet) {
    addWarning(
      warnings,
      `Document #${index + 1}: copies per set was not a clear numeric value.`,
    );
  }

  if (rawSerialNumbers && !serialNumbers) {
    addWarning(
      warnings,
      `Document #${index + 1}: serial number range could not be validated.`,
    );
  }

  if (booklets && setsPerBooklet && serialNumbers) {
    const serialRange = parseSerialRange(serialNumbers);

    if (serialRange) {
      const expected = Number(booklets) * Number(setsPerBooklet);

      if (expected > 0 && serialRange.count !== expected) {
        addWarning(
          warnings,
          `Document #${index + 1}: serial range contains ${serialRange.count} numbers but booklets × sets per booklet equals ${expected}. Review these values.`,
        );
      }
    }
  }

  return {
    description,

    descriptionOther: description === "OTHER" ? descriptionOther : "",

    manner,

    booklets,

    setsPerBooklet,

    copiesPerSet,

    copiesPerSetOther: rawCopiesOther,

    serialNumbers,
  };
}

function calculateConfidence(
  extraction: Omit<ATPExtraction, "overallConfidence">,
): ATPExtraction["overallConfidence"] {
  const coreValues = [
    extraction.dateOfAtp,
    extraction.ocn,
    extraction.tin,
    extraction.taxpayerName,
    extraction.businessName,
    extraction.registeredAddress,
    extraction.rdoCode,
    extraction.taxType,
  ];

  const coreFound = coreValues.filter(Boolean).length;

  const documentsComplete =
    extraction.documents.length > 0 &&
    extraction.documents.every((document) =>
      Boolean(
        document.description &&
        document.manner &&
        document.booklets &&
        document.setsPerBooklet &&
        document.copiesPerSet &&
        document.serialNumbers,
      ),
    );

  if (coreFound >= 7 && documentsComplete && extraction.warnings.length === 0) {
    return "high";
  }

  if (coreFound >= 5 && extraction.documents.length > 0) {
    return "medium";
  }

  return "low";
}

function sanitizeExtraction(value: unknown): ATPExtraction {
  if (!value || typeof value !== "object") {
    throw new Error("The extraction service returned invalid ATP data.");
  }

  const source = value as Record<string, unknown>;

  const warnings = Array.isArray(source.warnings)
    ? source.warnings.map(cleanString).filter(Boolean)
    : [];

  const dateOfAtp = normalizeDate(source.dateOfAtp);

  if (cleanString(source.dateOfAtp) && !dateOfAtp) {
    addWarning(warnings, "Date of ATP could not be validated.");
  }

  const taxType = normalizeTaxType(source.taxType);

  if (cleanString(source.taxType) && !taxType) {
    addWarning(
      warnings,
      "Tax type could not be confidently validated as VAT or NON-VAT.",
    );
  }

  const documents = Array.isArray(source.documents)
    ? source.documents
        .map((document, index) => sanitizeDocument(document, index, warnings))
        .filter(
          (document): document is ATPDocumentExtraction => document !== null,
        )
    : [];

  const baseExtraction: Omit<ATPExtraction, "overallConfidence"> = {
    dateOfAtp,

    ocn: cleanString(source.ocn),

    tin: cleanString(source.tin),

    taxpayerName: cleanString(source.taxpayerName),

    businessName: cleanString(source.businessName),

    registeredAddress: cleanString(source.registeredAddress),

    rdoCode: cleanString(source.rdoCode),

    taxType,

    documents,

    warnings,
  };

  if (!baseExtraction.dateOfAtp) {
    addWarning(warnings, "Date of ATP was not confidently read.");
  }

  if (!baseExtraction.ocn) {
    addWarning(warnings, "OCN was not confidently read.");
  }

  if (!baseExtraction.tin) {
    addWarning(warnings, "Taxpayer TIN was not confidently read.");
  }

  if (!baseExtraction.taxpayerName) {
    addWarning(warnings, "Taxpayer name was not confidently read.");
  }

  if (!baseExtraction.businessName) {
    addWarning(warnings, "Business/trade name was not confidently read.");
  }

  if (!baseExtraction.registeredAddress) {
    addWarning(warnings, "Registered address was not confidently read.");
  }

  if (!baseExtraction.rdoCode) {
    addWarning(warnings, "RDO code was not confidently read.");
  }

  if (!baseExtraction.taxType) {
    addWarning(warnings, "Tax type was not confidently read.");
  }

  if (baseExtraction.documents.length === 0) {
    addWarning(warnings, "No populated document row was confidently read.");
  }

  const overallConfidence = calculateConfidence(baseExtraction);

  return {
    ...baseExtraction,
    overallConfidence,
  };
}

function buildExtractionInstructions() {
  return [
    "Read the attached Philippine BIR Form 1921 Authority to Print, PAGE 1 only.",
    "",
    "The goal is to encode the form into LIC Printing Corporation's Received ATP form.",
    "",
    "IMPORTANT FORM STRUCTURE:",
    "- The upper section contains the BIR Form 1921 heading, Revenue District Office, OCN, Date of ATP, and QR code.",
    "- The TAXPAYER DETAILS section contains the customer's TIN & Branch Code, Name, Business/Trade Name, and Registered Address.",
    "- The PRINTER DETAILS section contains the accredited printer's information. NEVER use printer information as taxpayer information.",
    "- Below the printer section is DESCRIPTION OF RECEIPT/INVOICES.",
    "- Under A. PRINCIPAL RECEIPTS/INVOICES is the document table.",
    "- Read populated rows located ABOVE the REMINDER section.",
    "",
    "HEADER FIELD RULES:",
    "- dateOfAtp: read the printed Date of ATP and return YYYY-MM-DD.",
    "- ocn: read the printed OCN. Preserve all letters, digits, punctuation, and leading zeroes.",
    "- tin: use ONLY the taxpayer TIN & Branch Code from TAXPAYER DETAILS. Do not use the printer TIN.",
    "- taxpayerName: use ONLY the NAME in TAXPAYER DETAILS.",
    "- businessName: use ONLY BUSINESS/TRADE NAME in TAXPAYER DETAILS.",
    "- registeredAddress: use ONLY REGISTERED ADDRESS in TAXPAYER DETAILS.",
    "- rdoCode: read the Revenue District Office number printed near the top of the form. Return only its code, such as 031, 040, 041, or 54B. Preserve a printed leading zero.",
    "- Never derive the RDO code from the TIN, address, OCN, QR code, or printer details.",
    "",
    "DOCUMENT TABLE RULES:",
    "- Create exactly one documents item for every clearly populated document row.",
    "- Read each document row horizontally from left to right.",
    "- The columns are DESCRIPTION, TYPE, MANNER, NO. OF BOOKS/BOOKLETS, NO. OF SETS PER BOX/BOOKLET, NO. OF COPIES PER SET, SERIAL NUMBERS FROM, SERIAL NUMBERS TO.",
    "- Do not read column headings as values.",
    "- Do not read the REMINDER text as part of a document row.",
    `- description must match one of: ${receiptTypes.join(", ")}. Return an empty string if the description itself is not readable.`,
    "- Prefer the most specific visible description. If the form says SERVICE INVOICE, return SERVICE INVOICE, not generic INVOICE.",
    "- Use OTHER only when the printed description is readable but does not match a supported description. Put the exact printed wording in descriptionOther.",
    `- manner must be one of: ${mannerTypes.join(", ")}, or empty if unreadable.`,
    "- taxType is determined from the document TYPE column when clearly printed. It must be VAT, NON-VAT, or blank.",
    "- If populated document rows show a clear VAT/NON-VAT type, use that as taxType.",
    "- booklets must come only from NO. OF BOOKS/BOOKLETS.",
    "- setsPerBooklet must come only from NO. OF SETS PER BOX/BOOKLET.",
    "- copiesPerSet must come only from NO. OF COPIES PER SET.",
    "- booklets, setsPerBooklet, and copiesPerSet must contain digits only.",
    "- Do not swap booklets, sets, and copies even when the numbers look similar.",
    "- serialNumbers must combine SERIAL NUMBERS FROM and TO using a hyphen, for example 0001-0500.",
    "- Preserve leading zeroes in both serial numbers.",
    "",
    "VERY IMPORTANT NUMERIC READING RULE:",
    "- Read the document row visually before doing any arithmetic.",
    "- The expected horizontal order is: DESCRIPTION | TYPE | MANNER | BOOKLETS | SETS PER BOOKLET | COPIES PER SET | SERIAL FROM | SERIAL TO.",
    "- A typical row may visually look like: SERVICE INVOICE | VAT | BOUND | 10 | 50 | 2 | 0001 | 0500.",
    "- The example above describes column order only. NEVER copy its values unless those exact values are visibly printed on the uploaded form.",
    "",
    "CONSISTENCY CHECK:",
    "- When booklets, setsPerBooklet, serial FROM, and serial TO are readable, verify the values.",
    "- Serial count is TO - FROM + 1.",
    "- Normally serial count should equal booklets multiplied by setsPerBooklet.",
    "- Use arithmetic only as a verification check.",
    "- NEVER alter a clearly printed number merely to make the calculation match.",
    "- If the visible values are inconsistent, preserve the visible values and add a warning.",
    "- copiesPerSet is NOT part of the serial-count calculation and must always be read directly from its own column.",
    "",
    "UNCERTAINTY RULES:",
    "- Never guess.",
    "- Never invent missing digits.",
    "- Never reconstruct a blurry value merely because another combination would satisfy the arithmetic check.",
    "- If a field is blurry, covered, cut off, redacted, ambiguous, or not visible, return an empty string.",
    "- Add a concise warning explaining every important uncertain field.",
    "- Ignore handwritten marks unless they clearly form part of the field value.",
    "- Ignore stamps, signatures, logos, QR contents, decorative text, Page 2 references, and reminder text.",
    "",
    "CONFIDENCE:",
    "- high: all important header fields and all clearly populated document-row values are readable.",
    "- medium: most values are readable but one or more important values require review.",
    "- low: several important fields are missing or uncertain.",
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "OPENAI_API_KEY is not configured on the server.",
        },
        {
          status: 500,
        },
      );
    }

    const formData = await request.formData();

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error: "Please select or capture an ATP image.",
        },
        {
          status: 400,
        },
      );
    }

    if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          error: "Unsupported image format. Please use JPG, PNG, or WEBP.",
        },
        {
          status: 400,
        },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: "ATP image must be 10 MB or smaller.",
        },
        {
          status: 400,
        },
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    const imageUrl = `data:${file.type};base64,${bytes.toString("base64")}`;

    const model = process.env.OPENAI_ATP_MODEL || "gpt-5.6-luna";

    const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",

      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        model,

        store: false,

        reasoning: {
          effort: "low",
        },

        max_output_tokens: 3000,

        input: [
          {
            role: "system",

            content: [
              {
                type: "input_text",

                text: [
                  "You are a highly accurate document extraction system for Philippine BIR Form 1921 Authority to Print.",
                  "Read the uploaded form visually.",
                  "Accuracy is more important than filling every field.",
                  "Never invent unreadable information.",
                  "The taxpayer section and printer section represent different entities and must never be mixed.",
                  "Return only data supported by the visible Page 1 form.",
                ].join("\n"),
              },
            ],
          },

          {
            role: "user",

            content: [
              {
                type: "input_text",
                text: buildExtractionInstructions(),
              },

              {
                type: "input_image",
                image_url: imageUrl,
                detail: "original",
              },
            ],
          },
        ],

        text: {
          format: {
            type: "json_schema",

            name: "bir_1921_atp_extraction",

            strict: true,

            schema: atpSchema,
          },
        },
      }),

      cache: "no-store",
    });

    let raw: OpenAIResponse;

    try {
      raw = (await openAIResponse.json()) as OpenAIResponse;
    } catch {
      return NextResponse.json(
        {
          error: "OpenAI returned an unreadable response.",
        },
        {
          status: 502,
        },
      );
    }

    if (!openAIResponse.ok) {
      console.error("OpenAI ATP extraction error:", raw);

      return NextResponse.json(
        {
          error:
            raw.error?.message ||
            "OpenAI could not process the ATP image. Please try again.",
        },
        {
          status: openAIResponse.status,
        },
      );
    }

    if (raw.status && raw.status !== "completed") {
      console.error("Incomplete OpenAI ATP response:", raw);

      const reason = raw.incomplete_details?.reason;

      return NextResponse.json(
        {
          error: reason
            ? `ATP extraction did not complete: ${reason}. Please try again.`
            : "ATP extraction did not complete. Please try again.",
        },
        {
          status: 502,
        },
      );
    }

    const outputText = getOutputText(raw);

    if (!outputText) {
      return NextResponse.json(
        {
          error: "No ATP data was returned from the extraction service.",
        },
        {
          status: 502,
        },
      );
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(outputText);
    } catch (parseError) {
      console.error(
        "Could not parse ATP extraction JSON:",
        parseError,
        outputText,
      );

      return NextResponse.json(
        {
          error:
            "The ATP extraction result could not be parsed. Please try again.",
        },
        {
          status: 502,
        },
      );
    }

    const extraction = sanitizeExtraction(parsed);

    console.log("[ATP AI] Extraction result:", {
      model,
      confidence: extraction.overallConfidence,
      documentCount: extraction.documents.length,
      warnings: extraction.warnings,
    });

    return NextResponse.json(
      {
        success: true,
        model,
        extraction,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("ATP extraction failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to extract ATP data.",
      },
      {
        status: 500,
      },
    );
  }
}
