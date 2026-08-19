import PrintingOrdersDashboard from "@/app/components/PrintingOrdersDashboard";

export default function BIRPrintingDashboardPage() {
  return (
    <PrintingOrdersDashboard
      kind="BIR"
      title="BIR Printing"
      description="Monitor received ATP printing orders, current production stages, and release readiness."
      endpoint="/api/received-atp"
      newOrderHref="/orders/printing/bir/new"
      newOrderLabel="New BIR Printing"
    />
  );
}
