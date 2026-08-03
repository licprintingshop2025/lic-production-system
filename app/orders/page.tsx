import AppShell from "@/app/components/AppShell";
import PageHeader from "@/app/components/PageHeader";
import Link from "next/link";

export default function OrdersPage() {
  return (
    <AppShell activePage="orders" contentWidth="standard">
      <PageHeader
        eyebrow="Operations"
        title="Orders"
        description="Select the type of customer order or transaction you want to manage."
      />

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <ModuleCard
          eyebrow="Order Production"
          title="Printing"
          description="Create and monitor BIR and Non-BIR printing orders that enter the production workflow."
          href="/orders/printing"
          actionLabel="Open Printing"
          items={[
            "BIR printing orders",
            "Non-BIR printing orders",
            "Production queue",
          ]}
        />

        <ModuleCard
          eyebrow="Customer Assistance"
          title="Transactions"
          description="Record and monitor non-production customer transactions handled by the administrative team."
          href="/orders/transactions"
          actionLabel="Open Transactions"
          items={[
            "ATP processing",
            "Application monitoring",
            "Trello and Google Sheets synchronization",
          ]}
        />
      </section>
    </AppShell>
  );
}

function ModuleCard({
  eyebrow,
  title,
  description,
  href,
  actionLabel,
  items,
}: {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  items: string[];
}) {
  return (
    <article className="flex min-h-[320px] flex-col rounded-2xl border border-[#e3d8c7] bg-white p-7 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8b5e34]">
        {eyebrow}
      </p>

      <h2 className="mt-3 text-3xl font-black text-black">
        {title}
      </h2>

      <p className="mt-3 max-w-xl text-sm leading-7 text-[#6f6254]">
        {description}
      </p>

      <ul className="mt-6 space-y-3">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-3 text-sm font-semibold text-[#3f352a]"
          >
            <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#f3dfbf] text-[10px] font-black text-black">
              ✓
            </span>

            <span>{item}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-8">
        <Link
          href={href}
          className="inline-flex h-12 items-center justify-center rounded-lg bg-black px-6 text-sm font-black text-white transition hover:bg-[#6b421f]"
        >
          {actionLabel}
        </Link>
      </div>
    </article>
  );
}