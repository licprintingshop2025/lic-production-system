"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ProductionSyncRunner() {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function runSyncAndRefresh() {
      try {
        const res = await fetch("/api/production-sync", {
          cache: "no-store",
        });

        if (res.ok && isMounted) {
          router.refresh();
        }
      } catch (error) {
        console.error("Production auto-refresh failed:", error);
      }
    }

    const interval = setInterval(runSyncAndRefresh, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [router]);

  return null;
}