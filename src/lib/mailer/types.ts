export interface DriveFileLink {
  fileId: string;
  fileName: string;
  fileUrl: string;
}

export interface DelegateMatch {
  rowIndex: number;
  fullName: string;
  email: string;
  citizenship: string;
  country: string;
  confidence: string;
  hasEmail: boolean;
  hasManualOverride: boolean;
  letter: DriveFileLink | null;
  hasLetter: boolean;
  card: DriveFileLink | null;
  hasCard: boolean;
  itinerary: DriveFileLink | null;
  hasItinerary: boolean;
  voucher: DriveFileLink | null;
  hasVoucher: boolean;
  [key: string]: any; // Allow indexing
}

export interface Draft {
  id: string;
  name: string;
  subject: string;
  htmlBody: string;
  plainBody: string;
  cc: string;
  bcc: string;
  created?: string;
  modified?: string;
}

export interface FolderConfig {
  folders?: {
    letter?: string;
    card?: string;
    itinerary?: string;
    voucher?: string;
  };
  counts?: {
    letter?: number;
    card?: number;
    itinerary?: number;
    voucher?: number;
  };
  success?: boolean;
  error?: string;
}

export interface SendPayload {
  toEmail: string;
  recipientName: string;
  subject: string;
  htmlBody: string;
  plainBody: string;
  draftName: string;
  cc: string;
  bcc: string;
  sendLetter: boolean;
  letterFileId: string;
  sendCard: boolean;
  cardFileId: string;
  sendItinerary: boolean;
  itineraryFileId: string;
  sendVoucher: boolean;
  voucherFileId: string;
}

export interface MailerResult<T = any> {
  success: boolean;
  error?: string;
  result?: T;
  [key: string]: any;
}
