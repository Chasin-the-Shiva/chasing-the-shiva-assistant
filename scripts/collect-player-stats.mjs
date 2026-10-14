import fs from "node:fs/promises";

const base = "https://shivagpt-yahoo-api.redmoosejoe.chatgpt.site/season-manager-player-stats";
const scopes = ["rostered", "FA", "W"];
const all = [];
const summary = {};
let completedThrough = null;
let requestedWeeks = null;
let latestRetrieved = null;
const seen = new Set();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchPage(scope, start) {
  const url = new URL(base);
  url.searchParams.set("scope", scope);
  url.searchParams.set("start", String(start));
  url.searchParams.set("count", "25");
  const response = await fetch(url, {headers: {accept: "application/json"}, signal: AbortSignal.timeout(120000)});
  assert(response.ok, `Stats API HTTP ${response.status} (${scope}, ${start})`);
  const data = await response.json();
  assert(data.schema === "shivagpt-season-manager-player-stats-v1" && data.read_only === true && !data.error, "Invalid stats response");
  assert(String(data.league_id) === "721343" && Number(data.season) === 2026, "League/season mismatch");
  assert(data.scope === scope && Array.isArray(data.players), "Scope or players missing");
  assert(typeof data.retrieved_at === "string" && Number.isFinite(Date.parse(data.retrieved_at)), "Missing timestamp");
  assert(data.pagination && data.pagination.start === start && data.pagination.count === 25, "Invalid pagination");
  assert(data.pagination.returned === data.players.length && data.players.length <= 25, "Unexpected page count");
  assert(Number.isInteger(data.completed_through_week) && data.completed_through_week >= 0 && data.completed_through_week <= 17, "Bad completed week");
  assert(Array.isArray(data.requested_weeks), "Missing weeks");
  if (completedThrough === null) {
    completedThrough = data.completed_through_week;
    requestedWeeks = data.requested_weeks;
  }
  assert(completedThrough === data.completed_through_week && JSON.stringify(requestedWeeks) === JSON.stringify(data.requested_weeks), "Completed week changed during scan; retry later");
  const pageDate = Date.parse(data.retrieved_at);
  assert(Date.now() - pageDate < 30 * 60 * 1000 && pageDate - Date.now() < 5 * 60 * 1000, "Stale/future source timestamp");
  latestRetrieved = data.retrieved_at;
  return data;
}

for (const scope of scopes) {
  let start = 0;
  let pages = 0;
  let count = 0;
  let total = null;
  while (true) {
    assert(++pages <= 100, `Excessive pagination for ${scope}`);
    const data = await fetchPage(scope, start);
    if (scope === "rostered") {
      assert(Number.isInteger(data.pagination.total), "Rostered total missing");
      total = data.pagination.total;
    }
    for (const player of data.players) {
      assert(player && /^\\d+$/.test(String(player.player_id)), "Invalid player ID");
      assert(Array.isArray(player.weeks), "Missing player weeks");
      count++;
      const id = String(player.player_id);
      assert(!seen.has(id), `Duplicate player across scopes: ${id}; rerun scan`);
      seen.add(id);
      all.push(player);
    }
    const p = data.pagination;
    if (!p.has_more) {
      assert(p.complete_for_scope === true && p.next_start === null, `Incomplete ${scope} final page`);
      break;
    }
    assert(p.complete_for_scope === false && Number.isInteger(p.next_start) && p.next_start > start, "Invalid next page");
    start = p.next_start;
  }
  if (scope === "rostered") assert(count === total, `Rostered total mismatch: ${count}/${total}`);
  summary[scope] = {count, pages, complete_for_scope: true};
  console.log(`${scope}: ${count} players across ${pages} pages`);
}
assert(all.length > 195, "Unexpectedly small combined player pool");
const stats = {
  schema: "shivagpt-player-stats-snapshot-v1",
  read_only: true,
  league_id: "721343",
  season: 2026,
  retrieved_at: latestRetrieved,
  generated_at: new Date().toISOString(),
  completed_through_week: completedThrough,
  requested_weeks: requestedWeeks,
  collection: {scopes: summary, total_players: all.length, complete: true},
  players: all
};
await fs.mkdir("public", {recursive: true});
await fs.writeFile("public/shivagpt-player-stats.json.tmp", JSON.stringify(stats));
await fs.rename("public/shivagpt-player-stats.json.tmp", "public/shivagpt-player-stats.json");
console.log(`Validated ${all.length} players through Week ${completedThrough}`);
