const PH_TIME_ZONE = "Asia/Manila";

export function generateTrackingNumber() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PH_TIME_ZONE,
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === "year")?.value || "00";
  const month = parts.find((p) => p.type === "month")?.value || "00";
  const day = parts.find((p) => p.type === "day")?.value || "00";

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let random = "";

  for (let i = 0; i < 6; i++) {
    random += chars[Math.floor(Math.random() * chars.length)];
  }

  return `LIC-${year}${month}${day}-${random}`;
}