# ShivaGPT NFL evidence integration — source and decision contract

Status: DESIGN / NOT YET AN AUTOMATED NFL INGESTION. Do not mark this feature operational.

## Sources to validate
- nflverse-data releases: https://github.com/nflverse/nflverse-data/releases
- nflverse docs: https://github.com/nflverse/nflverse-data/blob/main/README.Rmd
- NFL Pro / Next Gen Stats: https://support.nfl.com/hc/en-us/articles/35869706651156-NFL-Pro-FAQ-s-and-Answers
- Official NFL club transaction reports and weekly participation / injury reporting, plus attributable beat reporting.

## Required NFL evidence per potential ADD
player_id (Yahoo), NFL name/team, NFL source-player ID mapping, season and latest completed week,
source URL, published_at, retrieved_at, numeric opportunity fields with observed windows:
offensive snaps, snap share, routes, routes per dropback, targets, target share,
receptions, receiving yards, receiving first downs, aDOT / air yards if supplied,
carries, RB rush share, RB receiving/goal line and red-zone work, return yards/duties,
teammate depth chart, injuries, offensive line, quarterback and coaching changes.

Do not manufacture routes, target share, red-zone counts or return-date estimates.
Use null for missing metrics. Yahoo league fantasy points come ONLY from the existing Yahoo
player-statistics snapshot, never from nflverse generic fantasy points.

## Gating requirements
- Current FA/W and FAAB verified from Yahoo.
- Direct comparison with Joe's specific drop candidate, including cross-position starting
  lineup coverage, flexes, bye weeks, injury reserves and keeper/trade options.
- Multi-week offensive trend and plausible sustainability backed by dated sources.
- Marketability to a manager as a useful offensive player, not simply return-yard points.
- RB scarcity breaks close calls; Jets players require clear superiority.
- Bid target/max and percentage of remaining FAAB only after evidence passes.
- NO_MOVE is a valid outcome.
- No Yahoo writes, trades, waiver claims, lineup edits, or manager contact.

## Wednesday
Post-waiver FA candidates require new Yahoo status, successful/failed claim observation and
current FAAB confirmation. An FA candidate must genuinely improve the roster even at $0.

## Outstanding verification
1. Validate live 2026 nflverse weekly data freshness, identifier joins and fields.
2. Validate separate snaps/routes/participation source and its license/access.
3. Validate recent injury/news and IR-return source freshness.
4. Build automated ingestion with retries, schema and missing-field protection.
5. Publish audited evidence to GitHub and test against at least 5 contrasting ADD/DROP cases.
6. Test actual Tuesday schedule with the newest completed week.

No NFL research step is fully automated merely by publishing this contract.
