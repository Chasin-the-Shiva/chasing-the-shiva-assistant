# Chasing the Shiva Assistant

Chasing the Shiva Assistant is a private, single-user fantasy football analytics and decision-support application for use with an authorized Yahoo Fantasy Football account.

## Purpose

The application is designed to assist with fantasy football research and decision-making by analyzing authorized read-only Yahoo Fantasy Sports data.

The application may use Yahoo Fantasy Sports data including:

- League settings and scoring rules
- Team rosters
- Player availability
- Draft results and completed selections
- League standings
- Weekly schedules and matchups
- Player and team statistics
- Transaction history

## Live Draft Assistance

During a live fantasy football draft, the application is intended to monitor completed draft selections and the remaining available-player pool.

This information may be analyzed to provide the authorized user with draft recommendations and player rankings.

The application does not make draft selections. All selections are made manually by the user through Yahoo Fantasy.

## In-Season Analysis

During the fantasy football season, the application may use authorized league information to provide recommendations involving:

- Start/sit decisions
- Roster construction
- Waiver and free-agent targets
- Trade analysis
- Weekly matchup analysis
- Player availability
- Opponent roster analysis

## Read-Only Access

Chasing the Shiva Assistant requires read-only access to Yahoo Fantasy Sports data.

The application does not make lineup changes, add or drop players, submit waiver claims, propose or accept trades, make draft selections, or otherwise modify Yahoo Fantasy data.

All fantasy football transactions and roster changes are performed manually by the authorized Yahoo user.

## Users

This is a private personal project intended for a single primary user and a single fantasy football league.

## Data Use

Yahoo Fantasy Sports data accessed by the application is used solely to provide fantasy football analytics and decision-support information to the authorized account holder.

## Operational rule — Data freshness disclosure

When answering with cached or potentially stale ShivaGPT research, use the most recent verified data rather than silently withholding all advice. Start the recommendation with:

> Based on the information I was able to gather as of HH:MM Eastern (the most recent update attempt was at HH:MM Eastern and succeeded/failed), I think you should…

The first time is the source data's verified retrieval timestamp; the second is the latest verified refresh-attempt time and its actual outcome. Never infer a successful attempt merely because an older report exists. If attempt status cannot be verified, state that it is unknown rather than inventing it. Display the date as well when the times could be ambiguous or data is from an earlier day. Do not imply stale availability, injury status, starting status, lineup, or FAAB is currently confirmed; mark any transaction advice conditional on re-verification. A failed refresh does not erase the last successfully collected evidence.


## Mandatory keeper-adjusted draft-pick valuation for every trade

**NON-NEGOTIABLE league rule:** Chasing the Shiva has 12 teams and 3 keepers per team, so up to 36 of the most valuable players are removed from the subsequent draft before Round 1. Never treat a keeper-league first- or second-round pick as a standard redraft first- or second-round pick. As a starting approximation, keeper Round 1 corresponds to redraft Round 4, keeper Round 2 to redraft Round 5, keeper Round 3 to redraft Round 6, etc. This is *player-pool equivalence*, not a guarantee of specific player ranks or intrinsic pick value.

**Critical exception:** Teams with more than three legitimate keeper-grade stars must release the surplus. That can push elite players back into the draft pool and disproportionately reward the very earliest Round 1 picks (and occasionally later picks if talent falls). Compare the precise pick's overall selection number, projected protected players for *all 12 teams*, likely keeper cuts, remaining unprotected players, and replacement-quality tiers. Account for picks retained/traded and draft-slot assignments before estimating actual prospects.

**Mandatory trade procedure:** For EVERY player-for-pick, player-for-player, or multi-asset trade, (1) evaluate each outgoing/incoming player's 2027 keeper candidacy and current/future Shiva scoring/trade market value, (2) if picks are involved, translate each pick to actual draft-pool value after 36 keepers rather than redraft round labels, (3) model likely players realistically available at that pick and identify exceptional keeper cuts, (4) account for Joe's keeper alternatives and the opportunity cost of losing a true keeper, (5) give a reasoned accept/counter/reject recommendation and disclose unknown pick ownership/position and keeper projections. A pick's round label alone is NEVER evidence that an offer is strong. Do not call a second-round pick premium compensation without this analysis. When evidence is unavailable, mark the valuation preliminary and request/check missing draft details.
