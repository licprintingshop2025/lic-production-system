import { requireSiteAuth } from "@/lib/siteAuth";

export default async function OrdersLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireSiteAuth();

  return children;
}