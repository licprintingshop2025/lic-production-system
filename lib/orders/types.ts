export type DocumentItem = {
  id: string;
  description: string;
  descriptionOther: string;
  manner: string;
  booklets: string;
  setsPerBooklet: string;
  copiesPerSet: string;
  copiesPerSetOther: string;
  serialNumbers: string;
};

export type ReceivedATPOrder = {
  trackingNo: string;
  dateOfAtp: string;
  ocn: string;
  tin: string;
  taxpayerName: string;
  businessName: string;
  registeredAddress: string;
  rdoCode: string;
  taxType: string;
  documents: DocumentItem[];
  atpReceived: string;
  atpStatus?: string;
  salesAssigned: string;
  salesAssignedOther?: string;
  branchNo?: string;
};

export type NonBIROrder = {
  trackingNumber: string;
  dateReceived: string;
  businessName: string;
  salesAssigned: string;
  documents: DocumentItem[];
};
