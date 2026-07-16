"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type NavItemProps = {
  label: string;
  href: string;
  active?: boolean;
  onClick?: () => void;
};

type ContentWidth = "standard" | "wide" | "form";

type AppShellProps = {
  activePage: string;
  children: React.ReactNode;
  contentWidth?: ContentWidth;
};

const CONTENT_WIDTH_CLASSES: Record<ContentWidth, string> = {
  standard: "max-w-[1500px]",
  wide: "max-w-[1800px]",
  form: "max-w-[1400px]",
};

export default function AppShell({
  activePage,
  children,
  contentWidth = "standard",
}: AppShellProps) {
  const pathname = usePathname();
  const [menuOpenedAtPath, setMenuOpenedAtPath] = useState<string | null>(null);

  const mobileMenuOpen = menuOpenedAtPath === pathname;

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  return (
    <main className="h-screen overflow-hidden bg-[#fbf7ef] text-black">
      <div className="flex h-full min-w-0">
        <DesktopSidebar activePage={activePage} />

        <div className="flex min-w-0 flex-1 flex-col">
          <MobileHeader
            menuOpen={mobileMenuOpen}
            onMenuClick={() => setMenuOpenedAtPath(pathname)}
          />

          <section className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-9 lg:py-8">
            <div
              className={`mx-auto w-full ${CONTENT_WIDTH_CLASSES[contentWidth]}`}
            >
              {children}
            </div>
          </section>
        </div>
      </div>

      <MobileSidebar
        activePage={activePage}
        open={mobileMenuOpen}
        onClose={() => setMenuOpenedAtPath(null)}
      />
    </main>
  );
}

function DesktopSidebar({ activePage }: { activePage: string }) {
  return (
    <aside className="hidden h-screen w-[290px] shrink-0 border-r border-[#e3d8c7] bg-[#fffaf2] lg:flex lg:flex-col">
      <SidebarContent activePage={activePage} />
    </aside>
  );
}

function MobileHeader({
  menuOpen,
  onMenuClick,
}: {
  menuOpen: boolean;
  onMenuClick: () => void;
}) {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-[#e3d8c7] bg-[#fffaf2] px-4 py-3 lg:hidden">
      <div className="flex items-center gap-3">
        <Image
          src="/lic-logo.jpg"
          alt="LIC Printing Shop"
          width={56}
          height={42}
          className="h-auto w-[56px] rounded-md object-contain"
          priority
        />

        <div>
          <p className="text-sm font-black text-black">LIC Operations Center</p>
          <p className="text-xs font-semibold text-[#6b421f]">
            Production System
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation menu"
        aria-expanded={menuOpen}
        aria-controls="mobile-navigation"
        className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#e3d8c7] bg-white px-4 text-sm font-bold text-black shadow-sm transition hover:bg-[#fbf7ef]"
      >
        <MenuIcon />
        Menu
      </button>
    </header>
  );
}

function MobileSidebar({
  activePage,
  open,
  onClose,
}: {
  activePage: string;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className={`fixed inset-0 z-50 lg:hidden ${
        open ? "pointer-events-auto" : "pointer-events-none"
      }`}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close navigation menu"
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <aside
        id="mobile-navigation"
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
        className={`absolute inset-y-0 left-0 flex w-[min(86vw,320px)] flex-col border-r border-[#e3d8c7] bg-[#fffaf2] shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[#e3d8c7] px-4 py-3">
          <p className="text-sm font-black uppercase tracking-wide text-[#6b421f]">
            Navigation
          </p>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#e3d8c7] bg-white transition hover:bg-[#fbf7ef]"
          >
            <CloseIcon />
          </button>
        </div>

        <SidebarContent activePage={activePage} onNavigate={onClose} />
      </aside>
    </div>
  );
}

function SidebarContent({
  activePage,
  onNavigate,
}: {
  activePage: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="shrink-0 px-5 pt-5">
        <div className="mx-auto w-[160px] overflow-hidden rounded-lg">
          <Image
            src="/lic-logo.jpg"
            alt="LIC Printing Shop"
            width={160}
            height={120}
            className="h-auto w-full object-contain"
            priority
          />
        </div>

        <p className="mt-4 text-center text-sm font-bold uppercase leading-5 text-[#6b421f]">
          Print Smarter, Build Trust,
          <br />
          Grow Faster
        </p>
      </div>

      <nav className="mt-7 min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-6 text-sm">
        <NavItem
          active={activePage === "dashboard"}
          label="DASHBOARD"
          href="/"
          onClick={onNavigate}
        />

        <p className="px-3 pt-7 text-xs font-black uppercase tracking-widest text-[#6b421f]">
          Admin
        </p>

        <NavItem
          active={activePage === "received-atp"}
          label="Received ATP"
          href="/received-atp"
          onClick={onNavigate}
        />

        <NavItem
          active={activePage === "non-bir-orders"}
          label="Non-BIR Orders"
          href="/non-bir-orders"
          onClick={onNavigate}
        />

        <NavItem
          active={activePage === "production"}
          label="Production Queue"
          href="/production"
          onClick={onNavigate}
        />

        <div className="my-6 border-t border-[#e3d8c7]" />

        <p className="px-3 text-xs font-black uppercase tracking-widest text-[#6b421f]">
          Production
        </p>

        <NavItem
          active={activePage === "production-tracker"}
          label="Production Tracker"
          href="/production-tracker"
          onClick={onNavigate}
        />

        <NavItem
          active={activePage === "daily-operations"}
          label="Daily Operations"
          href="/daily-operations"
          onClick={onNavigate}
        />

        <NavItem
          active={activePage === "employees"}
          label="Employees"
          href="/employees"
          onClick={onNavigate}
        />
      </nav>
    </>
  );
}

function NavItem({ label, href, active = false, onClick }: NavItemProps) {
  return (
    <a
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
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

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  );
}
