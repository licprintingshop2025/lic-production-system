const PH_TIME_ZONE = "Asia/Manila";

export function formatPHDateTime(dateValue: string | Date) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("en-US", {
    timeZone: PH_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export function getPHDateTime() {
  return formatPHDateTime(new Date());
}

export function getPHDate() {
  return new Date().toLocaleDateString("en-US", {
    timeZone: PH_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
