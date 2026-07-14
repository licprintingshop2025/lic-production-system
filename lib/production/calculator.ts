export type ProcessingInput = {
  booklets: number;
  paperType: string;
  ply: string;
  size: string;
  priority?: string;
  specialInstruction?: string;
};

function isRush(priority?: string) {
  return priority?.toLowerCase().includes("rush") || false;
}

function isThreePly(ply: string) {
  return ply.toLowerCase().includes("3");
}

function isCarbonized(paperType: string) {
  return paperType.toLowerCase().includes("carbon");
}

function getBaseTimePerBooklet(input: ProcessingInput) {
  const smallOrRush = input.booklets < 50 || isRush(input.priority);

  if (isThreePly(input.ply)) {
    return smallOrRush ? 0.3356 : 0.2211;
  }

  return smallOrRush ? 0.2388 : 0.1622;
}

function getPaperFactor(paperType: string) {
  if (isCarbonized(paperType)) return 1.15;
  return 1;
}

function getSizeFactor(size: string) {
  const value = size.toLowerCase();

  if (value.includes("whole")) return 1.4;
  if (value.includes("1/2") || value.includes("half")) return 1.2;
  if (value.includes("1/3")) return 1.1;
  if (value.includes("1/4")) return 1;

  return 1;
}

function getSpecialFactor(specialInstruction?: string) {
  const value = specialInstruction?.toLowerCase() || "";

  if (!value || value === "-") return 1;

  let factor = 1;

  if (value.includes("numbering")) factor += 0.1;
  if (value.includes("perforation")) factor += 0.1;
  if (value.includes("stamping")) factor += 0.15;
  if (value.includes("special")) factor += 0.1;

  return factor;
}

export function calculateDocumentHours(input: ProcessingInput) {
  const qty = Math.max(input.booklets, 1);

  const total =
    qty *
    getBaseTimePerBooklet({ ...input, booklets: qty }) *
    getPaperFactor(input.paperType) *
    getSizeFactor(input.size) *
    getSpecialFactor(input.specialInstruction);

  return Number(total.toFixed(2));
}

export function calculateOrderHours(items: ProcessingInput[]) {
  const total = items.reduce((sum, item) => {
    return sum + calculateDocumentHours(item);
  }, 0);

  return Number(total.toFixed(2));
}

// Backward-compatible name
export function calculateProcessingHoursV1(input: ProcessingInput) {
  return calculateDocumentHours(input);
}
