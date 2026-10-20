# ShivaGPT — Operations Control Map and Safe Test Runbook
Version 1.0 — 2026-10-20
Repository: `Chasin-the-Shiva/chasing-the-shiva-assistant`

## Non-negotiable goal
Every Tuesday morning deliver to the user **in ChatGPT** an actionable, team-specific waiver report (ADD, exact safe DROP, FA/W status, FAAB, injuries, offensive opportunity, trades, lineup). A GitHub Markdown file is an intermediate artifact, NOT delivery. Never declare success solely from a green GitHub run.

## Authorities and boundaries
- Yahoo API service: `https://shivagpt-yahoo-api.redmoosejoe.chatgpt.site`; source lives in a separately managed ChatGPT Site, not the GitHub repo. Work handoff (2026-10-19) reports site production v35 with 12 FA/W position partitions, 25-row paging, player-ID deduplication, and validated last-good fallback. This describes its deployment **at that time**, not a guarantee of current health.
- GitHub repository `main`: versioned workflow definitions, published sanitized snapshots and report artifacts.
- Render workspace **ShivaGPT**: confirmed cron `shivagpt-yahoo-refresh`, scheduled `10,40 * * * *`, **user-suspended**. NOT the Yahoo collector. Do not resume without explicit authorization.
- ChatGPT Tasks: *separate scheduler* from GitHub. The enabled task titled `ShivaGPT Tuesday Waiver Report` was configured for Tuesday 08:00 America/Toronto and instructed to deliver actual recommendations to the user. Its destination in a PARTICULAR conversation cannot be guaranteed. Check current task state before editing: ChatGPT Tasks cannot be managed through GitHub commits.
- Hourly `ShivaGPT Reliability Watch` checks failures only; do not re-enable historic repetitive CHECK CONNECTION alerts.
- No Yahoo writes, FAAB claims, roster changes, lineup changes, email-setting changes, repository visibility changes, or secret disclosure.

## Verified configuration / inventory (checked 2026-10-20)
| Layer | Control location | Current verified settings | Output/dependency | Risk |
|---|---|---|---|---|
| Yahoo league snapshot | `.github/workflows/refresh-yahoo-snapshot.yml` | GitHub cron `:17,:47` UTC; manual dispatch; concurrency `refresh-yahoo-snapshot` | `public/shivagpt-live.json`, `public/shivagpt-available.json`, `public/shivagpt-scoring.json` | High: upstream rate limiting, Git conflicts, source freshness |
| Freshness recovery | `.github/workflows/shivagpt-yahoo-freshness-watch.yml` and `scripts/watch-yahoo-freshness.mjs` | cron `:47` UTC, manual dispatch; may request refresh | Recovers stale league snapshot if the watch itself fires | Medium/high: overlapping :47 schedule; inspect before changes |
| Player statistics | `.github/workflows/validate-shivagpt-player-stats.yml`; `scripts/collect-player-stats.mjs` | Tuesday `04:00 America/New_York`; manual dispatch; timeout 35m | `public/shivagpt-player-stats.json`; 25-player pages across rostered/FA/W, dynamic `completed_through_week` | High: Yahoo 503/999, sequencing |
| Tuesday brief | `.github/workflows/shivagpt-tuesday-brief.yml`; `scripts/build-tuesday-brief.mjs` | Tuesday `07:00 America/New_York`; manual dispatch; timeout 15m; concurrency `shivagpt-tuesday-report` | `reports/shivagpt-tuesday-latest.md` and decision/lineup artifacts | High: depends on refreshed stats and live snapshots, separate schedules |
| ChatGPT report delivery | ChatGPT Task `ShivaGPT Tuesday Waiver Report` | Tuesday `08:00 America/Toronto`; enabled as of 2026-10-20 | User-facing ChatGPT scheduled response | Critical: GitHub success is not delivery, delivery to a named existing thread unverified |
| Render dispatcher | Render workspace `ShivaGPT`, cron `shivagpt-yahoo-refresh` | `10,40 * * * *`; **suspended by user** | Optional GitHub workflow dispatch, not Yahoo collection | Never unpause as a quick fix |
| 400-player monitor | GitHub Actions UI `ShivaGPT 400-Player Monitor` | Has successful runs; exact workflow filename/cron NOT YET VERIFIED | `reports/shivagpt-monitoring-400.json` | Verify prior to changing |
| Injury radar | GitHub Actions UI `ShivaGPT Injury & Return Radar` | Has successful runs; exact workflow filename/cron NOT YET VERIFIED | `reports/shivagpt-injury-radar.json` / validated state | Preserve NA/CEL exclusions and fallback |
| Popularity | GitHub Actions UI `ShivaGPT Yahoo Popularity Radar` | Exact workflow filename/cron NOT YET VERIFIED | `reports/shivagpt-popularity-radar.json` | Verify prior to changing |
| Wednesday FA publishing | GitHub Actions UI / repo | Actual workflow file and schedule NOT YET VERIFIED | Wednesday report | Do not assume tested merely from Tuesday success |

**Inventory is deliberately partial**: do not infer that these are every change point. Before any time change, discover ALL matching workflow files, triggers, task schedules, and upstream dependencies and update this inventory.

## Known test evidence and uncovered faults
- 2026-10-20: statistics workflow run `39413794194` manually triggered, succeeded, published stats through Week 6 for 1,140 players. Transient HTTP 503 retries recovered.
- 2026-10-20: Tuesday workflow run `39415190754` manually triggered, succeeded, published `reports/shivagpt-tuesday-latest.md` around 07:28 EDT. **Not evidence scheduled 07:00 trigger worked.**
- 2026-10-20: ChatGPT 08:00 delivery was separately scheduled. Delivery still requires inspection; a published Markdown file is not proof.
- Tuesday brief reads `current_week - 1` from live Yahoo; stats collector reads `completed_through_week` supplied by API. **Do not hard-code Week 6, Week 7, etc.** Script bounds currently permit `expected<=17` and stats `completed_through_week<=17` — inspect 18-week boundaries before postseason.
- Tuesday brief enforces: live/availability <=3h, stats generated <=8h, stats completed through previous league week, monitoring compatibility. A delayed upstream scheduled job can block it correctly.
- The stats collector has pagination and retry but can still be affected by upstream throttling.
- Two cron systems (GitHub and ChatGPT) DO NOT provide guaranteed cross-system ordering.

## Mandatory CHANGE IMPACT MATRIX — fill before modifying any schedule
For any requested change, write:
1. **User outcome** — what must be delivered (GitHub file vs actual ChatGPT report), deadline/timezone, freshness requirements.
2. **Trigger chain** — upstream collectors, snapshot refresh, player stats, priority/monitor, brief generation, GitHub publication, ChatGPT delivery. Record exact workflow/task names, IDs/paths and present values. Mark anything unknown as BLOCKED.
3. **All relevant clocks** — source collection cron, freshness watchdog, stats cron, Tuesday GitHub cron, ChatGPT delivery task, Render cron *only if authorized/active*, Wednesday cron where relevant. Note UTC vs America/New_York/Toronto DST.
4. **Dependencies** — e.g. stats should finish before Tuesday report, report should finish before ChatGPT delivery. Include max observed runtime and buffer.
5. **Side effects** — push triggers, concurrency, stale artifacts, excessive full Yahoo scans, secrets, website rebuilds, rebase conflicts, other monitors.
6. **Rollback** — capture prior SHA, original cron/task schedule/prompt; specify exact restore action, verify it worked.
7. **Proof** — trigger happened automatically, every job succeeded, expected-week data is fresh, artifact was published, user actually received usable recommendations.

Do not change a timing field without completing this matrix; use manual `workflow_dispatch` to test wherever possible instead.

## Safe test protocol — no need to wait another week
**Phase A: Dry-run / preflight (no scheduling changes).**
- Verify source data timestamps, latest completed week, FA/W coverage, current FAAB/roster and health. Read cached snapshots; avoid repeated full Yahoo collection.
- Confirm no equivalent workflow is already queued/running. Ensure the real Tuesday deliverable is not already published.
- Inspect script dependency gates and exact schedules. Snapshot SHAs and task settings.

**Phase B: Controlled execution (one pass).**
- For report-generation logic: manually dispatch `Prepare ShivaGPT Tuesday Waiver Brief` on `main`, using existing VALIDATED fresh stats and live snapshots. This is a full generation test without changing Tuesday cron.
- If stats are stale, run statistics workflow ONCE first; wait for success/publication; rate limit/back off on 503 or 999. Don't spam retriggers.
- Verify the GitHub Actions run's job logs and the report's *new generated_at/date/week*, not merely a green check or existing file.
- For ChatGPT delivery, test using a separate **one-time scheduled ChatGPT task** or direct delivery in the currently active conversation, NOT by moving the production weekly task back and forth. A one-time delivery test must validate substantive output and actual notification destination; disable/delete the test afterward if necessary.

**Phase C: Automatic scheduling proof.**
- A manual successful dispatch proves execution logic only, not GitHub cron reliability.
- To test cron scheduling without waiting seven days, use an explicitly temporary, isolated **canary workflow** with a harmless hourly schedule that ONLY records timestamp and scheduler event (no Yahoo calls/no production reports); verify multiple automatic launches, then remove it. Keep production cron unchanged.
- If the goal is end-to-end automatic weekly delivery, prove GitHub cron OR arrange a verified backup trigger + idempotent run guard; prove ChatGPT task delivery separately.
- Do not claim end-to-end PASS until the final ChatGPT report is actually delivered in the user-facing experience.

**Phase D: Rollback and handoff.**
- If temporary controls changed, restore prior settings and verify SHAs/schedules. Do not leave extra live recurring tasks.
- Publish a short structured test log with requested time, actual trigger time, source SHA, retrieved_at, expected week, report generated_at, GitHub run ID, ChatGPT delivery status, PASS/FAIL, deviations and next owner/action.

## Risk classifications
- **LOW:** Read-only GitHub artifact inspection, parsing, code review, controlled report-only manual dispatch with fresh validated data.
- **MEDIUM:** One complete stats scan, single snapshot refresh, adding isolated canary; avoid overlap and rate-limit risk.
- **HIGH:** Editing cron timing in production, changing several independent schedulers, changing week detection, changing recovery/checkpoint semantics, retry loops, changing API collector. Require an impact matrix, separate test and rollback.
- **PROHIBITED:** weakening completeness gates merely to pass; changing Yahoo transactions, rosters, bids, lineups; changing repository visibility or email settings; unsuspending Render cron without explicit authorization; enabling historical CHECK CONNECTION spam.

## Required operating practice for future ChatGPT sessions
Read this runbook FIRST before scheduling changes or tests. Inspect live connected tools, because this document can be stale. Never rely on memory for exact cron paths. Update this file after finding additional workflows or when changing a real control point. Work toward **user-facing delivery**, not merely publication in GitHub. A successful manual run is not a successful automatic schedule.
