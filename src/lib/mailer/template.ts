export const TEMPLATE_VARIABLES = [
  { placeholder: "{{title}}", description: "Salutation/Title (e.g. Mr., Dr.)" },
  { placeholder: "{{first_name}}", description: "First name" },
  { placeholder: "{{last_name}}", description: "Last name" },
  { placeholder: "{{full_name}}", description: "Full name (Title + First + Last)" },
  { placeholder: "{{citizenship}}", description: "Citizenship / Passport Country" },
  { placeholder: "{{country}}", description: "Residing Country" },
  { placeholder: "{{company}}", description: "Company Name" },
  { placeholder: "{{designation}}", description: "Designation/Job Title" },
  { placeholder: "{{region}}", description: "Region" },
  { placeholder: "{{email}}", description: "Email address" },
];

export function fillTpl(template: string, delegate: Record<string, string>): string {
  if (!template) return "";
  
  // Normalize key lookups
  const getVal = (key: string): string => {
    return (delegate[key] ?? "").trim();
  };

  // Derive full name if not directly present
  let fullName = getVal("full_name");
  if (!fullName) {
    const title = getVal("title");
    const first = getVal("first_name");
    const last = getVal("last_name");
    fullName = [title, first, last].filter(Boolean).join(" ");
  }

  const values: Record<string, string> = {
    title: getVal("title"),
    first_name: getVal("first_name"),
    last_name: getVal("last_name"),
    full_name: fullName,
    citizenship: getVal("citizenship") || getVal("passport_country"),
    country: getVal("country") || getVal("country_name"),
    company: getVal("company") || getVal("company_name"),
    designation: getVal("designation"),
    region: getVal("region"),
    email: getVal("email") || getVal("participant_email"),
  };

  let result = template;
  for (const [key, val] of Object.entries(values)) {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi");
    result = result.replace(regex, val);
  }
  
  return result;
}
