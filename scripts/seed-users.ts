import "dotenv/config";
import { db } from "../src/db";
import { users } from "../src/db/schema";
import { hashPassword } from "../src/lib/password";
import { eq } from "drizzle-orm";


async function seed() {
  console.log("Seeding team users into database...");
  const passHash = hashPassword("buildcon2026");

  const seedData = [
    {
      email: "admin",
      name: "Master Admin",
      role: "master_admin",
      sector: "Bharat Buildcon",
      assignedCountries: ["India", "Germany", "Thailand", "UAE", "USA"],
      passwordHash: passHash,
    },
    {
      email: "regional_admin",
      name: "Regional Supervisor",
      role: "regional_admin",
      sector: "Bharat Buildcon",
      assignedCountries: ["India", "Sri Lanka", "Bangladesh", "Nepal", "Vietnam"],
      passwordHash: passHash,
    },
    {
      email: "team_lead",
      name: "Team Lead",
      role: "team_lead",
      sector: "Export Calling",
      assignedCountries: ["Germany", "Oman", "South Korea", "UAE", "USA"],
      passwordHash: passHash,
    },
    {
      email: "caller",
      name: "Caller Koshti",
      role: "caller",
      sector: "Bharat Buildcon",
      assignedCountries: ["India", "Sri Lanka"],
      passwordHash: passHash,
    },
    {
      email: "caller2",
      name: "Caller Deepak",
      role: "caller",
      sector: "Food Pro",
      assignedCountries: ["Thailand", "Indonesia", "Malaysia", "Singapore"],
      passwordHash: passHash,
    },
    {
      email: "qa_auditor",
      name: "Compliance Auditor",
      role: "qa_auditor",
      sector: "Bharat Buildcon",
      assignedCountries: ["India", "Germany", "Thailand"],
      passwordHash: passHash,
    },
    {
      email: "analyst",
      name: "BI Analyst",
      role: "analyst",
      sector: "Bharat Buildcon",
      assignedCountries: ["India", "Germany", "Thailand"],
      passwordHash: passHash,
    },
  ];

  for (const u of seedData) {
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, u.email))
      .limit(1);

    if (existing) {
      await db
        .update(users)
        .set({
          name: u.name,
          role: u.role,
          sector: u.sector,
          assignedCountries: u.assignedCountries,
          passwordHash: u.passwordHash,
        })
        .where(eq(users.id, existing.id));
      console.log(`Updated existing user: ${u.email}`);
    } else {
      await db.insert(users).values({
        email: u.email,
        name: u.name,
        role: u.role,
        sector: u.sector,
        assignedCountries: u.assignedCountries,
        passwordHash: u.passwordHash,
      });
      console.log(`Inserted new user: ${u.email}`);
    }
  }

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
