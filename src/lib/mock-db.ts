// Persistent in-memory store for development/offline testing
export interface MockRegistration {
  id: number;
  sr_no: number;
  first_name: string;
  last_name: string;
  country_name: string;
  company_name: string;
  designation?: string;
  participant_mobile?: string;
  participant_email?: string;
  company_website?: string;
  main_import_product_1: string;
  poc: string;
  assigned_caller_id: number | null;
  caller_comment: string | null;
  caller_remark: string | null;
  email_request_status: "none" | "pending" | "sent" | null;
  status?: string;
  eventId?: string;
  createdAt?: string;
  updatedAt?: string;
}

const GLOBAL_KEY = Symbol.for("app.mock_registrations");

// Ensure global persistence across hot reloads in Next.js
if (!(globalThis as any)[GLOBAL_KEY]) {
  (globalThis as any)[GLOBAL_KEY] = [
    {
      id: 1001,
      sr_no: 1,
      first_name: "Damodaran",
      last_name: "Venkatesan",
      country_name: "Oman",
      company_name: "W J Towell And Co.(L.L.C) Building Materials",
      designation: "Managing Director",
      participant_mobile: "+968 9123 4567",
      participant_email: "damodaran@wjtowell.com",
      company_website: "www.wjtowell.com",
      main_import_product_1: "Ceramic Tiles",
      poc: "Koshti",
      assigned_caller_id: 9999,
      caller_comment: "Interested - Send Details",
      caller_remark: "Requested pricing catalogue for ceramic tiles",
      email_request_status: "pending",
      status: "Confirmed",
    },
    {
      id: 1002,
      sr_no: 2,
      first_name: "Samsuddeen",
      last_name: "Mullalikunnontakath",
      country_name: "Oman",
      company_name: "W.J.Towell & Co.(L.L.C) Bathroom Division",
      designation: "Head of Procurement",
      participant_mobile: "+968 9876 5432",
      participant_email: "samsuddeen@wjtowell.com",
      company_website: "www.wjtowell.com",
      main_import_product_1: "Bathroom Accessories",
      poc: "Koshti",
      assigned_caller_id: 9999,
      caller_comment: null,
      caller_remark: null,
      email_request_status: "none",
      status: "Confirmed",
    },
    {
      id: 1003,
      sr_no: 3,
      first_name: "Jungchul",
      last_name: "Lee",
      country_name: "South Korea",
      company_name: "Arkbuild Co. Ltd.",
      designation: "General Manager",
      participant_mobile: "+82 10 2345 6789",
      participant_email: "jclee@arkbuild.kr",
      company_website: "www.arkbuild.kr",
      main_import_product_1: "Ceramic Tiles",
      poc: "Biral",
      assigned_caller_id: 9999,
      caller_comment: "Busy - Call Back Later",
      caller_remark: "Travelling, call back on Friday morning",
      email_request_status: "none",
      status: "Confirmed",
    },
    {
      id: 1004,
      sr_no: 4,
      first_name: "Won Hee",
      last_name: "Choi",
      country_name: "South Korea",
      company_name: "Gabo Giwa",
      main_import_product_1: "Construction Chemicals",
      poc: "Charles",
      assigned_caller_id: 9999,
      caller_comment: "Not Interested",
      caller_remark: "Does not import construction chemicals directly",
      email_request_status: "none",
      status: "Confirmed",
    },
    {
      id: 1005,
      sr_no: 5,
      first_name: "Jaebok",
      last_name: "Lim",
      country_name: "South Korea",
      company_name: "Gabo Giwa Solar",
      main_import_product_1: "Solar Panels & Inverters",
      poc: "Charles",
      assigned_caller_id: 9999,
      caller_comment: "Interested - Send Details",
      caller_remark: "Wants information on standard rates",
      email_request_status: "sent",
      status: "Confirmed",
    },
    {
      id: 1006,
      sr_no: 6,
      first_name: "Jonghae",
      last_name: "Yun",
      country_name: "South Korea",
      company_name: "Samilinc Walls",
      main_import_product_1: "Interior & Wall Panels",
      poc: "Charles",
      assigned_caller_id: 2,
      caller_comment: null,
      caller_remark: null,
      email_request_status: "none",
      status: "Confirmed",
    },
    {
      id: 1007,
      sr_no: 7,
      first_name: "Chang Young",
      last_name: "Oh",
      country_name: "South Korea",
      company_name: "Kooknae Gongyeong co.,Ltd.",
      main_import_product_1: "Interior & Wall Panels",
      poc: "Charles",
      assigned_caller_id: null,
      caller_comment: null,
      caller_remark: null,
      email_request_status: "none",
      status: "Confirmed",
    },
    {
      id: 1008,
      sr_no: 8,
      first_name: "Andrian",
      last_name: "Zubcu",
      country_name: "Moldova",
      company_name: "Zubcu Energy Group",
      main_import_product_1: "ACP Sheets & Cladding",
      poc: "Rutvik S",
      assigned_caller_id: 9999,
      caller_comment: "Wrong Number / Invalid Details",
      caller_remark: "Invalid number format, could not reach",
      email_request_status: "none",
      status: "Can't Verify",
    }
  ];
}

export const mockRegistrationsStore = {
  get(): MockRegistration[] {
    return (globalThis as any)[GLOBAL_KEY];
  },

  /** Bulk-insert records from admin import (offline fallback) */
  bulkInsert(incoming: Partial<MockRegistration>[]): number {
    const list = (globalThis as any)[GLOBAL_KEY] as MockRegistration[];
    let maxId = list.reduce((m, r) => Math.max(m, r.id), 1010);
    let maxSr = list.reduce((m, r) => Math.max(m, r.sr_no ?? 0), 100);
    let inserted = 0;

    for (const row of incoming) {
      // Overwrite by sr_no if already exists
      const existingIdx = row.sr_no != null
        ? list.findIndex((r) => r.sr_no === row.sr_no)
        : -1;

      const record: MockRegistration = {
        id: row.id ?? ++maxId,
        sr_no: row.sr_no ?? ++maxSr,
        first_name: row.first_name ?? "",
        last_name: row.last_name ?? "",
        country_name: row.country_name ?? "",
        company_name: row.company_name ?? "",
        main_import_product_1: row.main_import_product_1 ?? "",
        poc: row.poc ?? "",
        assigned_caller_id: row.assigned_caller_id ?? null,
        caller_comment: row.caller_comment ?? null,
        caller_remark: row.caller_remark ?? null,
        email_request_status: row.email_request_status ?? "none",
        status: row.status ?? "Pending",
      };

      if (existingIdx >= 0) {
        list[existingIdx] = record;
      } else {
        list.push(record);
      }
      inserted++;
    }
    return inserted;
  },

  update(
    id: number,
    payload: {
      callerComment?: string | null;
      callerRemark?: string | null;
      emailRequestStatus?: string | null;
    }
  ): MockRegistration | null {
    const list = (globalThis as any)[GLOBAL_KEY] as MockRegistration[];
    const idx = list.findIndex(item => item.id === id);
    if (idx === -1) return null;

    const updated = {
      ...list[idx],
      caller_comment: payload.callerComment !== undefined ? payload.callerComment : list[idx].caller_comment,
      caller_remark: payload.callerRemark !== undefined ? payload.callerRemark : list[idx].caller_remark,
      email_request_status: payload.emailRequestStatus !== undefined ? (payload.emailRequestStatus as any) : list[idx].email_request_status,
    };

    list[idx] = updated;
    return updated;
  }
};
