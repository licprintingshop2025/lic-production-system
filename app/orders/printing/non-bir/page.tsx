import PrintingOrdersDashboard from "@/app/components/PrintingOrdersDashboard";

export default function NonBIRPrintingDashboardPage() {
  return (
    <PrintingOrdersDashboard
      kind="NON-BIR"
      title="Non-BIR Printing"
      description="Monitor Non-BIR printing orders, current production stages, and release readiness."
      endpoint="/api/non-bir-orders"
      newOrderHref="/orders/printing/non-bir/new"
      newOrderLabel="New Non-BIR Printing"
    />
  );
}
