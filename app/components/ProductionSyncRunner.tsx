"use client";

import { useProductionSync } from "@/hooks/useProductionSync";

export default function ProductionSyncRunner() {
  useProductionSync(undefined, 5000);
  return null;
}