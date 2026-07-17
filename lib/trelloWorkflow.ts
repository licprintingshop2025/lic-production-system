export const PARTIAL_ORDER_LABEL_NAME = "Partial Order";
export const PARTIAL_ORDER_LABEL_COLOR = "yellow";

export const STATUS_CHECKLIST_NAME = "Status";
export const INITIAL_COMMITMENT_CHECKLIST_NAME = "Initial Commitment";

export const DONE_ITEM_NAME = "Done";
export const INITIAL_RELEASE_ITEM_NAME = "Initial Release Completed";

export const PRODUCTION_WORKFLOW = {
  COMPLETE: {
    [STATUS_CHECKLIST_NAME]: [DONE_ITEM_NAME],
  },
  PARTIAL: {
    [STATUS_CHECKLIST_NAME]: [DONE_ITEM_NAME],
    [INITIAL_COMMITMENT_CHECKLIST_NAME]: [INITIAL_RELEASE_ITEM_NAME],
  },
} as const;

export type DeliveryStrategy = keyof typeof PRODUCTION_WORKFLOW;

export function normalizeWorkflowText(value?: string | null): string {
  return (value || "").trim().toUpperCase();
}

export function namesMatch(
  value: string | undefined | null,
  expected: string,
): boolean {
  return normalizeWorkflowText(value) === normalizeWorkflowText(expected);
}
