export function generateTrackingNumber() {
  const now = new Date();

  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  // Removed confusing characters
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let random = "";

  for (let i = 0; i < 6; i++) {
    random += chars[Math.floor(Math.random() * chars.length)];
  }

  return `LIC-${year}${month}${day}-${random}`;
}