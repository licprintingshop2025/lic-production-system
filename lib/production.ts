export const COMPLETED_LISTS = ["DELIVERED BY LIC", "PICKED UP BY CLIENT"];

export function isCompletedList(name: string) {
  return COMPLETED_LISTS.some((completed) =>
    name.toUpperCase().includes(completed)
  );
}

export function getStatus(count: number) {
  if (count === 0) return { label: "None", color: "bg-zinc-600" };
  if (count <= 5) return { label: "Low", color: "bg-green-500" };
  if (count <= 10) return { label: "Moderate", color: "bg-yellow-400" };
  if (count <= 50) return { label: "Heavy", color: "bg-orange-500" };
  return { label: "High", color: "bg-red-500" };
}

export function getBottlenecks<T extends { name: string; cards: unknown[] }>(
  lists: T[]
) {
  return lists
    .filter((list) => !isCompletedList(list.name))
    .filter((list) => list.cards.length >= 10)
    .sort((a, b) => b.cards.length - a.cards.length);
}

export function getProgressByListName(name: string) {
  const stationOrder = [
    "STATION 4",
    "TEXT MESSAGING",
    "STATION 3",
    "HOLD",
    "STATION 1 & 2",
    "ADMIN HEAD",
    "QUALITY CHECKING",
    "RECEIVING",
    "RUNNING",
    "NUMBERING",
    "COLLATING",
    "STAPLING",
    "CUTTING",
    "BROWNING",
    "STAMPING",
    "PACKAGING",
    "FINISH RECEIPT",
    "READY FOR RELEASE",
    "DELIVERED BY LIC",
    "PICKED UP BY CLIENT",
  ];

  const index = stationOrder.findIndex((station) =>
    name.toUpperCase().includes(station)
  );

  if (index === -1) return 0;

  return Math.round(((index + 1) / stationOrder.length) * 100);
}