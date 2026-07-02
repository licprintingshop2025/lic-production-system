"use client";

import { useEffect, useRef } from "react";

export function useProductionSync(
  onSynced?: () => Promise<void> | void,
  intervalMs = 5000
) {
  const syncingRef = useRef(false);
  const lastSyncRef = useRef("");

  useEffect(() => {
    let mounted = true;

    async function syncAndReload() {
      if (!mounted) return;
      if (syncingRef.current) return;

      syncingRef.current = true;

      try {
        const response = await fetch("/api/production-sync", {
          cache: "no-store",
        });

        if (!response.ok) {
          syncingRef.current = false;
          return;
        }

        const result = await response.json();

        /**
         * Your API should return:
         *
         * {
         *   success:true,
         *   lastUpdated:"2026-06-30T10:15:22.000Z"
         * }
         */

        if (
          result.lastUpdated &&
          result.lastUpdated !== lastSyncRef.current
        ) {
          lastSyncRef.current = result.lastUpdated;

          if (onSynced) {
            await onSynced();
          }
        }
      } catch (error) {
        console.error("Production Sync Error:", error);
      } finally {
        syncingRef.current = false;
      }
    }

    syncAndReload();

    const interval = setInterval(syncAndReload, intervalMs);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [onSynced, intervalMs]);
}