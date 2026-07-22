# Project X — Enterprise Calling CRM
### Multi-Sector Office CRM for Export Calling, Bharat Buildcon & Food Pro Operations

---

## 1. Overview

Project X is a multi-sector, multi-team calling CRM built for an organization running several parallel outbound campaigns — **Export Calling**, **Bharat Buildcon**, and **Food Pro** — each with its own leads, targets, and country allocations, but all managed from one platform so Admin has a single pane of glass across the whole operation.

Core idea: **Admin/Supervisor allocate → Caller executes and updates → Admin/Supervisor monitor in real time**, with every conversation, phase update, and chat message logged so nothing lives only in someone's head or a WhatsApp thread.

---

## 2. Roles & Permissions

| Role | Can Do | Data Scope |
|---|---|---|
| **ADMIN** | Everything — allocate sector/country/task to any caller, manage roster, set 3/6/9-month targets, view all KPIs, all chats, all reports, manage users | Full, all sectors, all countries |
| **SUPERVISOR** | Add/update leads, allocate country within their sector, monitor caller activity, view team KPIs, join/monitor task chats | Their assigned sector(s) only |
| **CALLER** | View only their assigned country + sector leads, call, log comments, update task phases, chat, send email, see own KPI/target progress | Own assigned country + sector, own registrations only |
| **TECH/COMPLIANCE (hidden monitoring role)** | Read-only access to all chat logs and attachments for audit/QA — no edit rights anywhere | Full read-only |

Enforced server-side (not just hidden UI) — a Caller's queries are always pre-filtered by `sector == assignedSector AND country in assignedCountries`, so there's no client-side trick to see another team's leads.

---

## 3. Sectors (Business Verticals)

Project X is built multi-sector from day one:

1. **Export Calling**
2. **Bharat Buildcon**
3. **Food Pro**

Each sector has its own:
- Lead/contact pool
- Country allocation map
- Task list & phases
- KPI targets and reports
- Roster

Admin can view a **combined cross-sector dashboard** or drill into one sector at a time. A Caller is generally scoped to one sector at a time (can be re-assigned by Admin), so their daily view never mixes Export Calling leads with Bharat Buildcon leads by accident.

---

## 4. Task Allocation

### 4.1 What a "Task" is
A Task = a defined chunk of calling work: a **sector + country + assigned caller(s) + deadline + a scheduling/time link**.

Example: *"Bharat Buildcon — Germany — Caller: Priya — Deadline: 25 Jul — Time Link: [calendar link for follow-up call bookings]"*

### 4.2 Fields
| Field | Description |
|---|---|
| `sector` | Export Calling / Bharat Buildcon / Food Pro |
| `country` | Country pool this task covers |
| `assignedTo` | Caller(s) |
| `assignedBy` | Admin or Supervisor |
| `timeLink` | A scheduling link (e.g. Calendly/Google Meet link) attached to the task, so a lead can be sent a direct booking link during follow-up — set by Admin per task or per campaign |
| `deadline` | Task due date |
| `phases[]` | See §6 |
| `status` | Not Started / In Progress / Completed |
| `completionPercent` | Auto-calculated from phase completion |

### 4.3 Who can allocate what
- **Admin**: allocate any country, any sector, to any caller.
- **Supervisor**: allocate countries within their own sector only, and can add new leads to the pool before allocating.
- **Caller**: cannot allocate — only executes what's assigned to them.

---

## 5. Lead / Contact Data (Caller-Facing Calling Sheet)

This is what a Caller sees and works from — exactly the fields you specified:

| Field | Notes |
|---|---|
| Company Name | |
| Contact Person | |
| Designation | |
| Personal Info | Free-text notes (LinkedIn, prior relationship, etc.) |
| Mobile | Click-to-call where telephony integration exists |
| E-mail | If present, enables one-click email (see §10). If blank, Caller can still send by typing an address manually |
| Website | |
| Address | |
| Remarks | Caller's running notes after each call |
| Email Comment | Notes specific to email interactions (separate from call remarks) |
| Comment | General comment/update log, timestamped, append-only (never overwrite — keep full history per lead) |

**Visibility rule**: a Caller only ever sees rows where `country ∈ theirAssignedCountries AND sector == theirAssignedSector`. Their "My Registrations" view further filters to leads *they personally* converted — this is what you meant by "also there registration only."

---

## 6. Task Phases (Progress Tracking)

Every task is broken into **phases** — Admin/Supervisor can define a default phase template per sector (e.g., *Data Collection → Initial Calling → Follow-up → Registration Closure*), and a Caller can **create additional custom phases** if the task needs a step the template didn't anticipate.

- Each phase has: `name`, `status` (Not Started/In Progress/Done), `updatedBy`, `updatedAt`, and a linked **phase chat thread** (see §7) where the caller logs what happened at that stage.
- **Caller must update the phase** they're working on before moving to the next — this isn't just a UI nicety, it's what makes `completionPercent` trustworthy: it's computed as `(phases marked Done) / (total phases)`, so Admin's percentage view is only as good as callers actually updating it, which is why phase updates are a required action, not optional.
- Admin sees a live **% Complete** bar per task, and can drill into exactly which phase is stuck and who owns it.

---

## 7. Team Chat (Task-Level + Team-Level)

- **Task chat**: every task has its own chat thread — Caller, Supervisor, and Admin can post updates, questions, or blockers directly against that task. Fully persisted in the database (never client-only).
- **Team chat**: a broader thread per sector/team for general coordination.
- **Attachments**: files/images/documents can be shared directly in chat (screenshots of a delegate's registration confirmation, a scanned form, etc.) — stored in cloud storage with the chat message holding a reference + metadata (filename, size, uploader, timestamp).
- **Tech/Compliance monitoring**: because every message and attachment is stored in the database (not an ephemeral chat tool), the tech team can review chat history for QA, dispute resolution, or audit purposes without depending on anyone's personal WhatsApp/Slack history.

---

## 8. Monitoring & KPI (Admin + Supervisor)

### 8.1 Call Activity Monitoring
Admin (and Supervisor, scoped to their sector) sees a **live view of who is calling how much** — calls made today/this week, broken down by caller, country, and sector, updating in near real time as call logs come in.

### 8.2 KPI Dashboard
- Individual: calls made, leads converted, follow-ups completed vs missed, phase completion rate.
- Team: rolled up by sector/country, compared against roster targets (§13).
- Admin view: everything, across every sector, every caller, every day — the single "see everything" screen.

### 8.3 Follow-Up Notifications
When a Caller logs a comment saying, e.g., *"follow up after 4 days,"* they set a `followUpDate` on that lead. The system automatically triggers a **notification** to that Caller when the follow-up is due (and can additionally escalate a nudge to the Supervisor if it's missed) — so follow-ups don't silently fall through the cracks in a busy calling day.

---

## 9. Reports & Business Intelligence

A dedicated Reports section (matches your reference layout):

- **Delegate Funnel** — Cold → Warm → Hot → Registered, sector and country filterable.
- **Team Performance** — caller-by-caller comparison, sortable, exportable.
- **By Country** — conversion and activity broken down geographically.
- **Missed Follow-Ups** — a dedicated view surfacing every overdue follow-up, who owns it, how overdue it is — this is the Admin's daily "what's falling behind" check.
- **Refresh** button — pulls latest data on demand (for anyone who doesn't want to wait for the auto real-time update).
- **Export CSV** — every report view is exportable for leadership decks / offline review.

---

## 10. Email Module (Send Directly from the CRM)

This is a full email workflow inside the CRM, not just a "mailto:" link.

### 10.1 If the lead has an email on file
- Caller clicks **Email** on that lead → a compose popup opens, **pre-filled with the recipient's email**.
- Caller can add **CC** recipients.
- Caller can pick a **template**. If the template contains variables like `{{name}}`, `{{company}}`, `{{event_date}}`, the popup **automatically detects the placeholders and prompts the Caller to fill each one in** before sending (a small form: "Name → ___", "Company → ___", etc.) — so nobody accidentally sends a raw `{{name}}` to a delegate.
- Caller can also write from scratch, no template required.

### 10.2 If the lead has no email on file
- Caller can still hit **Email**, and instead of a pre-filled recipient, the popup lets them **type in an email address manually** — useful when they get an email verbally on a call and want to follow up immediately without leaving the CRM to update the lead record first (though it should still prompt them to save that email back to the lead record).

### 10.3 Behind the scenes
- Sends go through the same secure Gmail-bridge-style architecture as before (a signed server-side call — never expose SMTP credentials to the browser).
- Every sent email is **logged against the lead** (subject, timestamp, sender, CC list) so "Email Comment" (§5) always has a real record behind it, not just a manual note.
- Template library is centrally managed (Admin/Supervisor can create/edit templates), so callers aren't each writing from scratch every time.

---

## 11. Analytics

A dedicated Analytics layer beyond the standard Reports section — more exploratory, more visual:

- **Trend lines**: calls made / conversions over time (daily/weekly/monthly), per sector and org-wide.
- **Country heatmap**: visual intensity map showing which countries are hot/warm/cold in volume and conversion rate.
- **Caller leaderboard**: ranked by performance score, filterable by sector, week, or target period.
- **Sector comparison**: Export Calling vs Bharat Buildcon vs Food Pro side-by-side — volume, conversion rate, team size, target attainment.
- **Target attainment tracker**: visual progress bars against the 3/6/9-month targets (§13), at both individual and team level.
- **Funnel drop-off analysis**: where leads are stalling (e.g., lots of Warm leads that never become Hot) — helps Admin/Supervisor spot a systemic issue rather than a single caller's problem.

---

## 12. Enterprise Multi-Sector Management

Since Project X spans three distinct calling operations, the platform is architected so Admin can:

- Switch between sector-specific views or see a **combined org-wide view**.
- Manage users' sector assignments centrally — a caller can, if needed, be moved from Food Pro to Bharat Buildcon by Admin without losing their historical KPI record (history stays tagged to the sector it happened in).
- Run sector-specific reporting and analytics independently, while still rolling everything up for leadership at the top level.

---

## 13. Roster & Target Management

### 13.1 Weekly Roster (Admin-managed)
Admin sets the **weekly roster** — which caller is working which country/sector this week. This is the short-term operational allocation layer sitting above individual tasks.

### 13.2 Long-Term Targets (Caller/Team-facing)
Each Caller (and their team) sees their **3-month, 6-month, and 9-month targets** — set by Admin — alongside their current attainment, so day-to-day calling work is always visible against the bigger picture, not just today's task list.

| Target Period | Visible To | Set By |
|---|---|---|
| Weekly Roster | Caller (their own), Supervisor (their team), Admin (all) | Admin |
| 3-Month Target | Caller + Team | Admin |
| 6-Month Target | Caller + Team | Admin |
| 9-Month Target | Caller + Team | Admin |

---

## 14. Data Model Summary

```
sectors/{sectorId}                { name, countries[] }

users/{userId}                    { role, sector, assignedCountries[], name }

leads/{leadId}                    {
                                     sector, country, companyName, contactPerson,
                                     designation, personalInfo, mobile, email,
                                     website, address, remarks[], emailComments[],
                                     comments[] (timestamped, append-only),
                                     assignedTo, status, followUpDate, registeredBy
                                   }

tasks/{taskId}                    {
                                     sector, country, assignedTo[], assignedBy,
                                     timeLink, deadline, status, completionPercent
                                   }

taskPhases/{phaseId}              { taskId, name, status, updatedBy, updatedAt }

chatMessages/{msgId}              {
                                     threadId (task or team), sender, text,
                                     attachments[] (url, filename, size), timestamp
                                   }

notifications/{notifId}           { targetUser, type: "follow_up_due", leadId, dueAt, read }

kpiSnapshots/{userId}_{date}      { callsMade, converted, followUpsCompleted, followUpsMissed, score }

roster/{rosterId}                 { week, userId, sector, country }

targets/{userId}                  { period: "3m"|"6m"|"9m", goal, currentAttainment }

emailLogs/{emailId}               { leadId, sentBy, to, cc[], subject, body, templateUsed, timestamp }

emailTemplates/{templateId}       { name, subject, body (with {{placeholders}}), sector }
```

---

## 15. Access Control Summary (enforced server-side)

- Caller queries always filtered: `sector == user.sector AND country IN user.assignedCountries`.
- "My Registrations" view further filtered: `registeredBy == user.id`.
- Supervisor queries filtered to `sector == user.sector` (all countries within it).
- Admin: no filter.
- Tech/Compliance monitoring role: read-only on `chatMessages` and attachments only — no access to lead PII edit rights, no allocation rights.
- Every allocation change, target update, and role change is written to an immutable audit log, Admin-visible only.

---

*This document defines the target feature set and data architecture for Project X. It's structured so each section (Task Allocation, Phases, Chat, Email, Reports, Analytics, Roster/Targets) can be built as an independent module against the shared data model in §14.*
