export type TransactionStatus =
  | "Pending"
  | "In Progress"
  | "Waiting for Client"
  | "Completed"
  | "Cancelled";

export type TransactionDocument = {
  documentType: string;
  taxType: string;
  quantity: number;
};

export type TransactionInput = {
  dateReceived: string;
  applicationMethod: string;

  formUsed: string[];
  form1905: string[];
  computePenalty: string[];

  taxpayerName: string;
  businessName: string;
  branch: string;

  documents: TransactionDocument[];

  mobileNumber: string;
  email: string;
  assistedBy: string;

  books: string[];
  status: TransactionStatus;
};

export type TransactionRecord = TransactionInput & {
  transactionNo: string;
  createdAt: string;
  updatedAt: string;
  trelloCardId: string;
  trelloCardUrl: string;
};

export type TransactionSheetRecord = TransactionRecord & {
  rowNumber: number;
};

export type CreateTransactionResponse = {
  success: boolean;
  transactionNo?: string;
  transaction?: TransactionRecord;
  error?: string;
  details?: string;
};

export type UpdateTransactionResponse = {
  success: boolean;
  transaction?: TransactionRecord;
  error?: string;
  details?: string;
};