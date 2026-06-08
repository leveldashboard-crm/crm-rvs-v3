import Papa from "papaparse";

export interface CSVData {
  headers: string[];
  rows: Record<string, string>[];
}

// Ported matching patterns for standard fields
export const COL_PATTERNS = {
  title: /^(title|salutation|honorific)$/i,
  first_name: /^(first\s*name|given\s*name|fname)$/i,
  last_name: /^(last\s*name|surname|family\s*name|lname)$/i,
  full_name: /^(full\s*name|name|delegate|participant)$/i,
  email: /^(email|e-mail|mail\s*address|email\s*address)$/i,
  citizenship: /^(citizenship|passport\s*country|nationality)$/i,
  country: /^(country|residence\s*country|country\s*of\s*residence|residing\s*country)$/i,
  company: /^(company|organization|company\s*name|org|firm)$/i,
  designation: /^(designation|job\s*title|role|position)$/i,
  region: /^(region|zone|continent)$/i,
  mobile: /^(mobile|phone|contact|telephone|mobile\s*number|phone\s*number)$/i,
  passport_number: /^(passport\s*no|passport\s*number|passport)$/i,
  place_of_issue: /^(place\s*of\s*issue|issue\s*place)$/i,
  date_of_expiry: /^(date\s*of\s*expiry|expiry\s*date|expiry)$/i,
  poc: /^(poc|point\s*of\s*contact|coordinator|staff\s*poc)$/i,
};

export function parseCSV(text: string): CSVData {
  const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
  if (!parsed.data.length) return { headers: [], rows: [] };
  const headers = parsed.data[0].map(h => h.trim());
  const rows = parsed.data.slice(1).map(cells => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => {
      o[h] = (cells[i] ?? "").trim();
    });
    return o;
  });
  return { headers, rows };
}

export function detectColumns(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  
  headers.forEach(h => {
    const cleanHeader = h.trim();
    for (const [key, pattern] of Object.entries(COL_PATTERNS)) {
      if (pattern.test(cleanHeader)) {
        mapping[key] = cleanHeader;
        break;
      }
    }
  });
  
  return mapping;
}
