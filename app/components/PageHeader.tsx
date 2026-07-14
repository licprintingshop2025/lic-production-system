"use client";

import { useEffect, useState } from "react";

export default function PageHeader({
  eyebrow = "LIC Operations Center",
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description: string;
}) {
  const [lastUpdated, setLastUpdated] = useState("");

  useEffect(() => {
    setLastUpdated(new Date().toLocaleString());
  }, []);

  return (
    <header className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
      <div>
        <p className="text-sm font-bold text-black">{eyebrow}</p>

        <h1 className="mt-2 text-4xl font-black tracking-tight text-black">
          {title}
        </h1>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#5f5448]">
          {description}
        </p>
      </div>

      <div className="rounded-lg border border-[#e6ddd1] bg-white px-6 py-4 text-sm text-[#5f5448] shadow-sm">
        Last Updated: {lastUpdated || "Loading..."}
      </div>
    </header>
  );
}
