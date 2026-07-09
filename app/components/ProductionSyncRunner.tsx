"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ProductionSyncRunner() {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function runSyncAndRefresh() {
      try {
        await fetch("/api/production-sync", {
          cache: "no-store",
        });

        if (isMounted) {
          router.refresh();
        }
      } catch (error) {
        console.error("Production auto-refresh failed:", error);
      }
    }

    const interval = setInterval(runSyncAndRefresh, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [router]);

  return null;
}