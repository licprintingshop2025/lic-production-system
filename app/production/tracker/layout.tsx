import { requireSiteAuth } from "@/lib/siteAuth";

export default async function ProtectedLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    await requireSiteAuth();
    return children;
}
