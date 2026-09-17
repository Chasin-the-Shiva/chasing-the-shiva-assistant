import fs from "node:fs";

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) throw new Error("Usage: node build-manager-history-v3.mjs INPUT OUTPUT");

const source = JSON.parse(fs.readFileSync(inputPath, "utf8"));
if (!source.read_only || !source.seasons?.["2025"] || !source.seasons?.["2026"]) {
  throw new Error("Historical source is incomplete or not read-only.");
}

const normalize = (value) => String(value || "")
  .normalize("NFKD")
  .replace(/[’']/g, "")
  .replace(/[^a-zA-Z0-9]+/g, " ")
  .trim()
  .toLowerCase();

const MANAGERS = [
  { manager_id: "manager_miles", manager_name: "Miles", current_team_name: "LES Screamin' Eagles", matches: ["Les Screaming Eagles", "LES Screamin' Eagles"] },
  { manager_id: "manager_mik", manager_name: "Mik", current_team_name: "Roadrunner", matches: ["Roadrunner"] },
  { manager_id: "manager_trevor", manager_name: "Trevor", current_team_name: "Eastboro Elites", matches: ["Eastboro Elites"] },
  { manager_id: "manager_dom", manager_name: "Dom", current_team_name: "Team Stud Monkey", matches: ["Team StudMonkey", "Team Stud Monkey"] },
  { manager_id: "manager_joe", manager_name: "Joe", current_team_name: "Chase'n The Shiva", matches: ["Chase'n The Shiva", "Chase and the Shiva"] },
  { manager_id: "manager_dan", manager_name: "Dan", current_team_name: "Balls Deep", matches: ["Balls Deep"] },
  { manager_id: "manager_john", manager_name: "John", current_team_name: "To Infinity and Bijan", matches: ["To infinity and Bijon", "To Infinity and Bijan"] },
  { manager_id: "manager_jason", manager_name: "Jason", current_team_name: "The Can't Finish on Top Turds", matches: ["The 'Cant Finish on Top' Turds", "The Can't Finish on Top Turds", "The Polished Turds"] },
  { manager_id: "manager_james", manager_name: "James", current_team_name: "Bismo Funions", matches: ["Bismo Funions", "Ismo Funions"] },
  { manager_id: "manager_dwayne", manager_name: "Dwayne", current_team_name: "ACP", matches: ["ACP"] },
  { manager_id: "manager_perry", manager_name: "Perry", current_team_name: "Will the Real Bijan Please Stand Up", matches: ["Will da real Bijon pls Stand ⬆️", "Will the Real Bijan Please Stand Up"] },
  { manager_id: "manager_ryan_gorsh", manager_name: "Ryan Gorsh", preferred_name: "Gorsh", current_team_name: "Digs in a Blanket", matches: ["Diggs in a blanket", "Digs in a Blanket"] },
];

function mergeYahooArray(value) {
  if (!Array.isArray(value)) return value;
  return Object.assign({}, ...value.filter((item) => item && typeof item === "object" && !Array.isArray(item)));
}

function findObjects(value, predicate, found = []) {
  if (value && typeof value === "object") {
    const merged = mergeYahooArray(value);
    if (merged && predicate(merged)) found.push(merged);
    for (const child of Object.values(value)) findObjects(child, predicate, found);
  }
  return found;
}

function compactRoster(rosterPayload) {
  const players = findObjects(rosterPayload, (v) => (v.player_key || v.player_id) && v.name);
  const unique = new Map();
  for (const player of players) {
    const key = String(player.player_key || player.player_id);
    const name = typeof player.name === "string" ? player.name : player.name?.full;
    if (!name) continue;
    unique.set(key, {
      player_id: player.player_id || key.split(".p.")[1] || null,
      player_name: name,
      position: player.display_position || player.primary_position || null,
      nfl_team: player.editorial_team_abbr || null,
      keeper_on_final_roster: Boolean(player.is_keeper?.status || player.is_keeper?.kept),
      status: player.status || null,
    });
  }
  return [...unique.values()];
}

function teamMetadata(rosterPayload, teamKey) {
  const candidates = findObjects(rosterPayload, (v) => String(v.team_key || "") === String(teamKey));
  const team = candidates.sort((a, b) => Object.keys(b).length - Object.keys(a).length)[0] || {};
  return {
    previous_season_team_rank: team.previous_season_team_rank ?? null,
    waiver_priority: team.waiver_priority ?? null,
    faab_balance_at_archive: team.faab_balance ?? null,
    number_of_moves: team.number_of_moves ?? null,
    number_of_trades: team.number_of_trades ?? null,
    draft_grade: team.draft_grade ?? null,
  };
}

function transactionAssociation(transaction, teamKey) {
  let direct = false;
  let asset = false;
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (["trader_team_key", "tradee_team_key", "source_team_key", "destination_team_key"].includes(key) && String(child) === String(teamKey)) direct = true;
      if (key === "original_team_key" && String(child) === String(teamKey)) asset = true;
      visit(child);
    }
  };
  visit(transaction);
  return direct ? "direct" : asset ? "asset_reference_only" : null;
}

function transactionSummary(transaction, association) {
  const summary = {
    transaction_key: transaction.transaction_key || null,
    transaction_id: transaction.transaction_id || null,
    type: transaction.type || null,
    status: transaction.status || null,
    timestamp: transaction.timestamp || null,
    association,
    trader_team_name: transaction.trader_team_name || null,
    tradee_team_name: transaction.tradee_team_name || null,
    picks: (transaction.picks || []).map((item) => {
      const pick = item.pick || item;
      return {
        round: pick.round || null,
        source_team_name: pick.source_team_name || null,
        destination_team_name: pick.destination_team_name || null,
        original_team_name: pick.original_team_name || null,
      };
    }),
  };
  return Object.fromEntries(Object.entries(summary).filter(([, value]) => value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0)));
}

function compactDraftPick(pick) {
  return Object.fromEntries(Object.entries({
    overall_pick: pick.overall_pick,
    round: pick.round,
    player_id: pick.player_id,
    player_name: pick.player_name,
    position: pick.position,
    nfl_team: pick.nfl_team,
    is_keeper: Boolean(pick.is_keeper),
  }).filter(([, value]) => value !== null && value !== undefined));
}

function compactDraftSummary(summary) {
  if (!summary) return null;
  return {
    positional_pick_sequence: summary.positional_pick_sequence,
    first_round_selected: summary.first_round_selected,
    totals_by_position: summary.totals_by_position,
  };
}

function compactLeagueTransaction(transaction) {
  const picks = (transaction.picks || []).map((item) => {
    const pick = item.pick || item;
    return [
      pick.source_team_key || null,
      pick.source_team_name || null,
      pick.destination_team_key || null,
      pick.destination_team_name || null,
      pick.original_team_key || null,
      pick.original_team_name || null,
      pick.round || null,
    ];
  });
  return [
    transaction.transaction_key || null,
    transaction.transaction_id || null,
    transaction.type || null,
    transaction.status || null,
    transaction.timestamp || null,
    transaction.trader_team_key || null,
    transaction.trader_team_name || null,
    transaction.tradee_team_key || null,
    transaction.tradee_team_name || null,
    transaction.faab_bid || null,
    picks.length ? picks : null,
  ];
}

function counts(values, key) {
  return values.reduce((result, item) => {
    const value = item[key] || "unknown";
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
}

const sourceProfiles = source.manager_profiles || [];
const sourceProfileByCurrentName = new Map(sourceProfiles.map((p) => [normalize(p.current_team_name), p]));

const managerProfiles = MANAGERS.map((manager) => {
  const sourceProfile = manager.matches.map((name) => sourceProfileByCurrentName.get(normalize(name))).find(Boolean);
  if (!sourceProfile?.manager_ref) throw new Error(`Could not resolve ${manager.manager_name} to an anonymous manager reference.`);

  const historicalNames = new Set([manager.current_team_name, ...manager.matches, ...(sourceProfile.historical_team_names || [])]);
  const seasons = {};

  for (const season of ["2025", "2026"]) {
    const archive = source.seasons[season];
    const team = (archive.teams || []).find((item) => item.manager_ref === sourceProfile.manager_ref);
    if (!team) continue;
    historicalNames.add(team.team_name);
    const rosterRecord = (archive.final_rosters || []).find((item) => item.manager_ref === sourceProfile.manager_ref);
    const draft = (archive.draft || []).filter((item) => item.manager_ref === sourceProfile.manager_ref).map(compactDraftPick);
    const keepers = (archive.keepers || []).filter((item) => item.manager_ref === sourceProfile.manager_ref).map(compactDraftPick);
    const draftSummary = compactDraftSummary((archive.draft_summaries || []).find((item) => item.manager_ref === sourceProfile.manager_ref));
    const transactions = (archive.transactions || [])
      .map((transaction) => ({ transaction, association: transactionAssociation(transaction, team.team_key) }))
      .filter((item) => item.association)
      .map((item) => transactionSummary(item.transaction, item.association));
    const directTransactions = transactions.filter((item) => item.association === "direct");
    const metadata = teamMetadata(rosterRecord?.roster, team.team_key);
    const roster = compactRoster(rosterRecord?.roster);

    seasons[season] = {
      team_id: team.team_id,
      team_key: team.team_key,
      team_name: team.team_name,
      roster,
      keepers,
      draft,
      draft_summary: draftSummary,
      transactions,
      factual_summary: {
        roster_position_counts: counts(roster, "position"),
        drafted_position_counts: draftSummary?.totals_by_position || counts(draft, "position"),
        keeper_position_counts: counts(keepers, "position"),
        directly_attributable_transaction_counts: counts(directTransactions, "type"),
        directly_attributable_successful_trades: directTransactions.filter((item) => item.type === "trade" && item.status === "successful").length,
        directly_attributable_vetoed_trades: directTransactions.filter((item) => item.type === "trade" && item.status === "vetoed").length,
        ...metadata,
      },
      limitations: {
        unsuccessful_faab_bids_available: false,
        per_manager_add_drop_attribution: directTransactions.some((item) => ["add", "add/drop", "drop"].includes(item.type)),
        note: "Yahoo's archived transaction summaries do not always retain player/team attribution for add, drop and waiver records. Team-level number_of_moves and final FAAB balance are retained when Yahoo supplied them; exact unsuccessful bids are unavailable.",
      },
    };
  }

  const historicalTeamNames = [...historicalNames].filter(Boolean).filter((name) => normalize(name) !== normalize(manager.current_team_name));
  const lookupKeys = [...new Set([
    manager.manager_id,
    manager.manager_name,
    manager.preferred_name,
    manager.current_team_name,
    ...historicalTeamNames,
    sourceProfile.manager_ref,
  ].filter(Boolean))];

  return {
    manager_id: manager.manager_id,
    manager_ref: sourceProfile.manager_ref,
    manager_name: manager.manager_name,
    preferred_name: manager.preferred_name || manager.manager_name,
    current_team_name: manager.current_team_name,
    yahoo_current_team_name: sourceProfile.current_team_name,
    historical_team_names: historicalTeamNames,
    lookup_keys: lookupKeys,
    continuity_status: "verified_across_2025_and_2026",
    seasons,
    tendencies: {
      evidence_type: "factual_observations_for_season_manager_interpretation",
      draft: Object.fromEntries(Object.entries(seasons).map(([year, data]) => [year, data.draft_summary])),
      roster_construction: Object.fromEntries(Object.entries(seasons).map(([year, data]) => [year, data.factual_summary.roster_position_counts])),
      transactions: Object.fromEntries(Object.entries(seasons).map(([year, data]) => [year, {
        number_of_moves: data.factual_summary.number_of_moves,
        number_of_trades: data.factual_summary.number_of_trades,
        directly_attributable_transaction_counts: data.factual_summary.directly_attributable_transaction_counts,
      }])),
      waiver_faab: Object.fromEntries(Object.entries(seasons).map(([year, data]) => [year, {
        waiver_priority: data.factual_summary.waiver_priority,
        faab_balance_at_archive: data.factual_summary.faab_balance_at_archive,
        unsuccessful_bids_available: false,
      }])),
      interpretation_rule: "Use these factual season records to infer patterns cautiously. Do not invent unsuccessful bids, missing player-level add/drop attribution, motives or preferences not supported by the data.",
    },
  };
});

const byName = {};
const byTeamName = {};
const byManagerRef = {};
for (const profile of managerProfiles) {
  byName[normalize(profile.manager_name)] = profile.manager_id;
  byName[normalize(profile.preferred_name)] = profile.manager_id;
  byManagerRef[profile.manager_ref] = profile.manager_id;
  for (const teamName of [profile.current_team_name, profile.yahoo_current_team_name, ...profile.historical_team_names]) {
    byTeamName[normalize(teamName)] = profile.manager_id;
  }
}

const output = {
  schema: "shivagpt-manager-history-v3",
  read_only: true,
  generated_at: new Date().toISOString(),
  source_retrieved_at: source.retrieved_at,
  usage: {
    primary_collection: "manager_profiles",
    lookup_sequence: ["manager_lookup.by_name", "manager_lookup.by_team_name", "manager_lookup.by_manager_ref", "manager_profiles"],
    note: "Resolve a manager_id first, then read that profile's seasons, keepers, draft, roster, transactions and tendencies. Current team names are display labels; historical team names are aliases for the same manager.",
  },
  manager_lookup: { by_name: byName, by_team_name: byTeamName, by_manager_ref: byManagerRef },
  manager_profiles: managerProfiles,
  source_archive: {
    schema: source.schema,
    retrieved_at: source.retrieved_at,
    seasons: Object.fromEntries(Object.entries(source.seasons).map(([year, season]) => [year, {
      season: season.season,
      located: season.located,
      league_key: season.league_key,
      league_id: season.league_id,
      league_name: season.league_name,
      settings: season.settings,
      standings: season.standings,
      completed_transaction_fields: ["transaction_key", "transaction_id", "type", "status", "timestamp", "trader_team_key", "trader_team_name", "tradee_team_key", "tradee_team_name", "faab_bid", "draft_picks"],
      completed_transaction_draft_pick_fields: ["source_team_key", "source_team_name", "destination_team_key", "destination_team_name", "original_team_key", "original_team_name", "round"],
      completed_transactions: (season.transactions || []).map(compactLeagueTransaction),
      yahoo_limitations: season.yahoo_limitations,
      preservation_note: "All non-null transaction fields, league settings and standings are retained. Manager-specific teams, rosters, keepers, drafts, draft summaries and factual Yahoo team metrics are normalized under manager_profiles; repeated and null-only representations are omitted without removing their underlying information.",
    }])),
    manager_continuity: source.manager_continuity,
    manager_profiles: source.manager_profiles,
    design_notes: source.design_notes,
  },
};

if (output.manager_profiles.length !== MANAGERS.length) throw new Error(`Expected ${MANAGERS.length} manager profiles.`);
if (new Set(output.manager_profiles.map((profile) => profile.manager_id)).size !== MANAGERS.length) throw new Error("Manager IDs are not unique.");
if (new Set(output.manager_profiles.map((profile) => profile.manager_ref)).size !== MANAGERS.length) throw new Error("Anonymous manager references are not unique.");

for (const expected of MANAGERS) {
  const profile = output.manager_profiles.find((item) => item.manager_id === expected.manager_id);
  if (!profile) throw new Error(`Missing manager profile: ${expected.manager_id}.`);
  for (const season of ["2025", "2026"]) {
    if (!profile.seasons?.[season]) throw new Error(`Missing ${season} history for ${expected.manager_id}.`);
  }
  for (const name of [profile.manager_name, profile.preferred_name]) {
    if (output.manager_lookup.by_name[normalize(name)] !== expected.manager_id) {
      throw new Error(`Name lookup failed for ${expected.manager_id}: ${name}.`);
    }
  }
  for (const teamName of [profile.current_team_name, profile.yahoo_current_team_name, ...profile.historical_team_names]) {
    if (output.manager_lookup.by_team_name[normalize(teamName)] !== expected.manager_id) {
      throw new Error(`Team-name lookup failed for ${expected.manager_id}: ${teamName}.`);
    }
  }
  if (output.manager_lookup.by_manager_ref[profile.manager_ref] !== expected.manager_id) {
    throw new Error(`Manager-reference lookup failed for ${expected.manager_id}.`);
  }
}

fs.writeFileSync(outputPath, JSON.stringify(output));
console.log(JSON.stringify({
  schema: output.schema,
  managers: output.manager_profiles.map((profile) => ({
    manager_id: profile.manager_id,
    manager_ref: profile.manager_ref,
    manager_name: profile.manager_name,
    current_team_name: profile.current_team_name,
    historical_team_names: profile.historical_team_names,
    seasons: Object.keys(profile.seasons),
  })),
}));
