import Image from "next/image";

type NavItemProps = {
  label: string;
  href: string;
  active?: boolean;
};

export default function AppShell({
  activePage,
  children,
}: {
  activePage: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#fbf7ef] text-black">
      <div className="flex">
        <aside className="hidden min-h-screen w-[290px] border-r border-[#e3d8c7] bg-[#fffaf2] lg:block">
          <div className="px-5 pt-5">
            <div className="mx-auto w-[110px] overflow-hidden rounded-lg">
              <Image
                src="/lic-logo.jpg"
                alt="LIC Printing Shop"
                width={110}
                height={80}
                className="h-auto w-full object-contain"
                priority
              />
            </div>

            <p className="mt-3 text-center text-sm leading-5 text-[#5f5448]">
              Print Smarter. Build Trust. Grow Faster.
            </p>
          </div>

          <nav className="mt-7 space-y-2 px-4 text-sm">
            <NavItem
              active={activePage === "dashboard"}
              label="DASHBOARD"
              href="/"
            />

            <p className="px-3 pt-7 text-xs font-black uppercase tracking-widest text-[#6b421f]">
              Admin
            </p>

            <NavItem
              active={activePage === "received-atp"}
              label="Received ATP"
              href="/received-atp"
            />

            <NavItem
              active={activePage === "non-bir-orders"}
              label="Non-BIR Orders"
              href="/non-bir-orders"
            />

            <NavItem
              active={activePage === "production"}
              label="Production Queue"
              href="/production"
            />

            <div className="my-6 border-t border-[#e3d8c7]" />

            <p className="px-3 text-xs font-black uppercase tracking-widest text-[#6b421f]">
              Production
            </p>

            <NavItem
              active={activePage === "production-tracker"}
              label="Production Tracker"
              href="/production-tracker"
            />

            <NavItem
              active={activePage === "daily-operations"}
              label="Daily Operations"
              href="/daily-operations"
            />

            <NavItem
              active={activePage === "employees"}
              label="Employees"
              href="/employees"
            />
          </nav>
        </aside>

        <section className="flex-1 px-7 py-8 lg:px-9">{children}</section>
      </div>
    </main>
  );
}

function NavItem({ label, href, active = false }: NavItemProps) {
  return (
    <a
      href={href}
      className={`block rounded-lg px-5 py-4 text-sm transition ${
        active
          ? "bg-[#f3dfbf] font-black text-black"
          : "font-medium text-black hover:bg-[#f7ead6]"
      }`}
    >
      {label}
    </a>
  );
}