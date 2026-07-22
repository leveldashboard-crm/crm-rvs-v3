# ConnectBuild CRM v3 — Enterprise Architecture & Antigravity Implementation Plan
### Bharat Buildcon 2026 · International Calling Operations Platform
### Prepared as a senior-engineer-grade architecture + execution document

---

## 0. Document Scope

This supersedes v2. v2 added task allocation, KPI, and enforced RBAC. This revision takes the platform from "solid team tool" to **enterprise-grade**: it adds the layers a real enterprise buyer or auditor would ask for — compliance, observability, disaster recovery, security hardening, workforce management, and a formal SDLC — and restructures the Antigravity plan to build all of it in a controlled, auditable sequence.

Sections 1–2 recap what's unchanged. Sections 3–11 are new or substantially upgraded. Section 12 is the full Antigravity execution plan.

---

## 1. System Overview (unchanged from v2)

Hybrid architecture: Firebase Firestore for real-time CRM state, Neon PostgreSQL as source of truth for delegate/pass master data, Firebase Auth for identity. Next.js 15 frontend, Three.js globe, Gmail Bridge via Google Apps Script.

## 2. Retained v2 Features (recap)
Task Allocation (batches, auto-balance, TTL locks), event-driven KPI engine, RBAC enforced via Firestore rules + custom claims, Master Admin Daily Command Center, Audit Log.

---

## 3. New Enterprise-Grade Feature Set

### 3.1 Expanded Role Hierarchy
The 3-tier model (Admin/Supervisor/Caller) doesn't hold up at enterprise scale — you need a QA function and a leadership-only reporting layer that can't accidentally touch operational data.

| Role | Scope | Notes |
|---|---|---|
| **MASTER ADMIN** | Global, unrestricted, write access to config | Infrastructure, security policy, role assignment |
| **REGIONAL ADMIN** | One or more continents | Was "Supervisor" in v2; renamed for clarity at scale |
| **TEAM LEAD** | One country, manages Callers + views QA scores | New — sits between Regional Admin and Caller |
| **CALLER** | Own assigned delegates only | Unchanged |
| **QA AUDITOR** | Read-only + scoring rights on call recordings/logs, no allocation rights | New — compliance function |
| **ANALYST (Leadership)** | Read-only, org-wide, dashboards only, zero PII on delegate contact fields | New — for executives who need numbers, not phone numbers |

### 3.2 Call Quality & Compliance
- **Call recording metadata hook**: integrate with your telephony provider's (e.g., Exotel/Knowlarity/Twilio) recording webhook — store the recording URL and duration against the `callLogs` entry, not the audio itself in Firestore (store in Cloud Storage with signed URLs, TTL'd access).
- **QA Scorecard**: QA Auditors score a sample of calls weekly against a rubric (script adherence, tone, data accuracy) — stored in a `qaScores` collection, feeds into a Caller's overall performance profile alongside the existing Performance Score.
- **Script adherence flags**: optional keyword/checklist tagging on a call log (e.g., "did the caller mention the venue address") — lightweight, not full speech-to-text analysis unless you want to add that later as a v4 AI feature.

### 3.3 Notification & Escalation Engine
- **Channels**: in-app (Firestore-driven toast/bell), email (via existing Gmail Bridge infra), and optionally WhatsApp Business API / SMS for time-critical alerts.
- **Triggers**: follow-up due in 30 min, follow-up missed (auto-escalates to Team Lead after 2 hours overdue), daily allocation cap reached, Caller idle > 2 hours during working hours, KPI dropping below a configurable threshold.
- **Escalation ladder**: Missed follow-up → Caller notified immediately → Team Lead notified at 2h → Regional Admin notified at 6h if still unresolved. This is what makes "the master admin can see all day updates" actually mean something operationally, not just visually.

### 3.4 Workforce & Shift Management
- **Shift scheduling**: define shifts (e.g., IST business hours covering multiple time zones for international calling) per Caller, stored in a `shifts` collection.
- **Attendance/presence tracking**: login/logout timestamps, active/idle status (heartbeat every N minutes while the tab is open), feeds into both the Master Admin live view and KPI fairness (a Caller who worked 4 hours shouldn't be penalized against one who worked 8).
- **Break tracking**: optional "on break" toggle so idle-detection escalation doesn't misfire during legitimate breaks.

### 3.5 AI-Assisted Lead Scoring (optional, phased)
- A lightweight model (or even a rules-based heuristic to start) that suggests a lead temperature (Hot/Warm/Cold) based on historical patterns — country, past interaction count, response latency, registration funnel stage — surfaced as a *suggestion* to the Caller, never auto-applied. Keeps humans in the loop, avoids the trap of an opaque AI silently reprioritizing the queue.

### 3.6 Multi-Channel Communication Hub
- Beyond Gmail: optional WhatsApp Business API integration for delegate outreach (many international delegates prefer WhatsApp over email), and SMS fallback for time-sensitive reminders. Architected as pluggable "channel adapters" behind a common interface so you're not locked into Gmail-only outreach.

### 3.7 Gamification (retention/engagement layer)
- Daily/weekly leaderboard (already partly implied by KPI ranking in v2) — formalized with streaks ("5-day hot-lead streak"), team-vs-team country leaderboards, and light badges. Optional and easily toggled off — some enterprise cultures don't want this, so it should be a config flag, not baked in.

### 3.8 Reporting & Business Intelligence
- **Scheduled reports**: daily/weekly digest auto-emailed to Master Admin and Regional Admins (delegate funnel, top/bottom performers, missed-follow-up count) — a Cloud Scheduler + Cloud Function job, not a manual export.
- **Custom report builder**: filter by date range, country, continent, status, caller — export CSV/PDF (retain from v2, formalized here).
- **Cohort & funnel analytics**: Recharts-powered views of Cold→Warm→Hot→Registered conversion over time, by country and by caller cohort (e.g., callers onboarded this week vs. veterans).

---

## 4. Non-Functional Requirements (NFRs)

Enterprise-grade means these are written down and tested against, not assumed.

| Category | Target |
|---|---|
| **Availability** | 99.5% uptime during active calling hours (define your actual business hours across time zones) |
| **Latency** | Dashboard reads < 500ms p95; Admin live feed updates within 2s of write |
| **Concurrency** | Support 20 concurrent active users with real-time listeners without read-cost blowup (denormalized `kpiSnapshots` from v2 already helps here) |
| **Data durability** | RPO ≤ 15 minutes, RTO ≤ 4 hours (see §7 Disaster Recovery) |
| **Scalability** | Architecture must support growth to 100+ users / multiple concurrent events without a rewrite — schema should be tenant-aware even if you launch single-tenant (see §3.9 below) |

### 3.9 Multi-Tenancy Readiness (forward-looking, not necessarily v3-launch)
Even if Bharat Buildcon 2026 is the only event today, add an `eventId` field to every collection now (`callLogs`, `taskBatches`, `kpiSnapshots`) scoped by Firestore rules. Retrofitting multi-tenancy later means touching every rule and every query — doing it now costs almost nothing and saves a painful migration if there's a Bharat Buildcon 2027, or a second concurrent event.

---

## 5. Security Hardening

- **Encryption**: TLS in transit (default on Firebase/Neon); encryption at rest (default on both, verify Neon's config explicitly — not all tiers enable it by default).
- **Secrets management**: GAS `SECRET_TOKEN`, Neon connection string, and any third-party API keys (WhatsApp, SMS) live in **Google Secret Manager**, injected at build/deploy time — never committed, never in `.env` files checked into git.
- **Rate limiting**: on the Next.js API routes that front Neon and the Gmail Bridge endpoint, to prevent a compromised or buggy client from hammering either backend.
- **MFA for Admin/Regional Admin roles**: enforce via Firebase Auth's multi-factor support — the highest-privilege roles are the highest-value target.
- **Penetration test checklist before go-live**: verify Firestore rules can't be bypassed via crafted client requests (test with the Firebase Emulator's rules unit tests plus a manual adversarial pass), verify the GAS endpoint validates the signed token on every request, verify no PII (delegate phone/email) leaks into client-side error logs or analytics events.
- **PII minimization**: Analyst role (§3.1) never receives delegate contact fields in its queries — enforced at the rules/query level, not just hidden in the UI.

---

## 6. Compliance & Data Governance

- **Applicable framework**: India's **Digital Personal Data Protection (DPDP) Act, 2023** governs delegate personal data here, alongside any GDPR exposure if international delegates are EU-based.
- **Data retention policy**: define and enforce (e.g., delegate contact data purged N months after the event concludes, call recordings retained for a shorter QA window than the CRM records themselves).
- **Right to erasure**: a documented (and ideally semi-automated) process for a delegate's data-deletion request to be honored across both Firestore and Neon.
- **Consent tracking**: if outreach requires opt-in (especially for WhatsApp/SMS channels under §3.6), track consent state per delegate.
- **Audit log retention**: the `auditLog` collection from v2 should itself have a defined retention period and be Master-Admin-only, immutable (no update/delete rule, only create).

---

## 7. Observability & Monitoring

- **Structured logging**: Cloud Functions and Next.js API routes emit structured JSON logs (not `console.log` strings) to Cloud Logging, tagged with `userId`, `role`, `action` for traceability.
- **Error tracking**: Sentry (or Google Cloud Error Reporting) wired into both the Next.js frontend and Cloud Functions — Master Admin gets alerted on a spike in errors, not just users silently hitting broken flows.
- **Uptime & performance monitoring**: Cloud Monitoring dashboards for Cloud Function latency/error rate, Firestore read/write volume (cost control — 20 people with real-time listeners can rack up reads fast if unbounded), and the GAS endpoint's response time.
- **Alerting**: PagerDuty/email alert to the dev team (not the CRM's internal notification engine — a separate, infra-level channel) on error-rate spikes or Cloud Function failures.

---

## 8. Disaster Recovery & Backup

- **Firestore**: enable scheduled exports to Cloud Storage (daily minimum, ideally more frequent during active event days) for point-in-time recovery.
- **Neon Postgres**: leverage Neon's built-in point-in-time restore; document the actual RPO/RTO Neon's plan tier gives you and confirm it meets the NFR in §4.
- **Runbook**: a written, tested procedure for "Firestore corrupted/deleted mid-event" and "Neon unreachable mid-event" — including a manual fallback (e.g., read-only cached delegate list) so 20 callers aren't fully blocked during a recovery window.
- **Backup verification**: a scheduled job that periodically test-restores a backup to a scratch environment to confirm backups are actually restorable, not just "exists."

---

## 9. CI/CD & Environments

- **Environments**: `dev` (individual/agent sandbox) → `staging` (mirrors prod config, used for Antigravity agent verification per §12) → `production`.
- **Pipeline**: GitHub Actions (or equivalent) running lint, type-check, unit tests, and Firestore rules emulator tests on every PR; deploy to staging automatically on merge to `main`; production deploy gated behind manual approval.
- **Feature flags**: for risk-bearing features (gamification, AI lead scoring, WhatsApp channel) — ship dark, enable per-config without a redeploy.
- **Rollback plan**: Cloud Functions and Firestore rules are versioned; document the one-command rollback for each.

---

## 10. API Layer & Integration Hub

- **Internal API**: versioned REST routes (`/api/v1/...`) fronting Neon reads and Firestore writes that need server-side validation beyond what rules alone can express (e.g., dailyCap enforcement logic).
- **Webhook support**: outbound webhooks (e.g., "delegate registered" event) so this CRM can eventually notify other Bharat Buildcon systems without tight coupling.
- **Channel adapter interface**: a common `sendMessage(channel, delegate, template)` interface behind which Gmail, WhatsApp, and SMS adapters plug in (§3.6) — keeps the Gmail Bridge from becoming a special case wired throughout the codebase.

---

## 11. Updated Firestore Schema (additions on top of v2)

```
shifts/{shiftId}          { userId, startTime, endTime, timezone }
qaScores/{scoreId}        { callLogId, auditorUid, rubricScores: map, notes, timestamp }
notifications/{notifId}   { targetUid, type, payload, read: bool, createdAt }
consentRecords/{delegateSr} { channel, consentGiven: bool, timestamp, source }
```
All new collections carry `eventId` per §3.9 multi-tenancy readiness.

---

## 12. Detailed Antigravity Implementation Plan (Enterprise Build)

Same governing principles as before — `AGENTS.md` + `GUARDRAILS.md`, Review-required mode for anything touching auth/rules/money, isolated agent domains, human checkpoint before Proceed. This plan extends the v2 phase sequence (RBAC → Allocation → KPI/Admin dashboard → Audit Log → Gmail scoping → Regression) with the enterprise layers, in dependency order.

### 12.1 Updated `AGENTS.md` domains
```
- auth-agent: /lib/auth, /middleware.ts, firestore.rules, custom claims functions
- allocation-agent: /app/(dashboard)/allocation, /lib/allocation, taskBatches
- kpi-agent: /functions/kpi, /app/(dashboard)/kpi, kpiSnapshots
- workforce-agent: /app/(dashboard)/workforce, /lib/shifts, shifts collection
- qa-agent: /app/(dashboard)/qa, qaScores collection
- notification-agent: /functions/notifications, /lib/notifications, notifications collection
- integration-agent: /lib/channels (Gmail/WhatsApp/SMS adapters), never modifies GAS deployment directly
- observability-agent: /lib/logging, Sentry config, Cloud Monitoring setup
- infra-agent: CI/CD pipeline, environment config — highest trust bar, always Review-required

## Global Rules
- No agent modifies firestore.rules except auth-agent.
- No agent commits secrets; all secrets referenced via Secret Manager env bindings.
- Every Cloud Function ships with a unit test; every RBAC-touching change ships with a rules emulator test.
- No agent deploys to production; all deploys stop at staging for human promotion.
```

### 12.2 Phase sequence

| Phase | Scope | Agent | Mode | Key checkpoint |
|---|---|---|---|---|
| **1** | Expanded RBAC (6 roles), custom claims, rules rewrite | auth-agent | Review-required | Manual test with 6 role accounts; rules emulator adversarial test suite green |
| **2** | Task Allocation (v2 carryover, now `eventId`-scoped) | allocation-agent | Review-required | E2E: allocate → queue → lock TTL → reclaim |
| **3** | KPI engine + Master Admin Command Center (v2 carryover) | kpi-agent | Review-required | Live feed < 2s latency verified manually |
| **4** | Workforce & Shift Management | workforce-agent | Review-required | Attendance heartbeat verified against a real 8-hour simulated shift in staging |
| **5** | QA Scorecard | qa-agent | Review-required | QA Auditor role can score but not reassign/allocate — verify via rules test |
| **6** | Notification & Escalation Engine | notification-agent | Review-required | Simulate missed follow-up → verify escalation ladder fires at 2h and 6h marks in staging (accelerated clock for testing) |
| **7** | Channel adapters (Gmail formalized, WhatsApp/SMS stubs) | integration-agent | Review-required | Gmail path regression-tested; WhatsApp/SMS behind feature flag, off by default |
| **8** | Observability (logging, Sentry, Cloud Monitoring) | observability-agent | Autonomous (low-risk, additive only) | Confirm a deliberately-thrown test error surfaces in Sentry within a minute |
| **9** | CI/CD pipeline | infra-agent | Review-required, human-run not agent-run for prod credentials | PR → staging deploy verified end-to-end before this phase is marked done |
| **10** | Full regression + adversarial RBAC pass | any (full-app scope) | Review-required, checkpoints per role | Login as all 6 roles, verify zero cross-scope data leakage, zero console errors |
| **11** | Disaster recovery drill | infra-agent (runbook authoring) + human-executed drill | Human-run | Actually execute a restore-from-backup drill in staging, time it against the RTO target |

### 12.3 Concurrency guidance
Run Phase 1 alone. Phases 2–3 in parallel once Phase 1 merges (as in v2). Phases 4–7 can run 2–3 at a time once Phases 1–3 are stable, since they touch disjoint collections (`shifts`, `qaScores`, `notifications`, `channels`) — but **always merge and regression-test after every 2 parallel phases**, don't let 4 agents' work pile up unreviewed. Phase 8 (observability) is safe to run anytime after Phase 1, in the background, since it's purely additive. Phases 9–11 are sequential, human-supervised, and not good candidates for autonomous mode regardless of how well earlier phases went — CI/CD and DR are the two places where a mistake is expensive and hard to notice quickly.

### 12.4 Definition of "enterprise-grade done" for this project
Before calling v3 complete, verify against this checklist (have Antigravity generate the E2E test suite that proves each line, don't just eyeball it):
- [ ] All 6 roles enforced server-side, adversarially tested
- [ ] Master Admin sees org-wide live updates within 2s
- [ ] Escalation ladder fires correctly on missed follow-ups
- [ ] Backups verified restorable via an actual drill
- [ ] Secrets are in Secret Manager, zero secrets in git history
- [ ] Error tracking confirmed working (not just installed)
- [ ] CI pipeline blocks a PR that fails rules tests
- [ ] Data retention/erasure process documented and at least manually tested once

---

*This document is the v3 enterprise baseline. Sections 3–11 define target state; Section 12 is the controlled execution path inside Google Antigravity to get there without introducing the two failure modes enterprise CRMs most commonly hit: silent RBAC leaks and unrecoverable data loss.*
