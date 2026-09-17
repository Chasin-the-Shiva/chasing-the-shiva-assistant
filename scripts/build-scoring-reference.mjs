import fs from "node:fs";

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) throw new Error("Usage: node build-scoring-reference.mjs INPUT OUTPUT");

const source = JSON.parse(fs.readFileSync(inputPath, "utf8"));
if (source.schema !== "shivagpt-season-manager-v1" || source.read_only !== true || !source.settings) {
  throw new Error("Current authoritative Yahoo feed is missing or invalid.");
}

const league = source.settings?.fantasy_content?.league;
if (!Array.isArray(league)) throw new Error("Yahoo league settings are missing.");
const leagueMetadata = league.find((item) => item && typeof item === "object" && item.season);
const settings = league.find((item) => Array.isArray(item?.settings))?.settings?.[0];
if (!leagueMetadata || !settings) throw new Error("Yahoo league metadata or scoring settings are missing.");

const unwrap = (items, key) => (items || []).map((item) => item?.[key]).filter(Boolean);
const categories = unwrap(settings.stat_categories?.stats, "stat").filter((stat) => String(stat.enabled) === "1");
const modifiers = unwrap(settings.stat_modifiers?.stats, "stat");
const modifiersById = new Map(modifiers.map((modifier) => [String(modifier.stat_id), modifier]));
const categoriesById = new Map(categories.map((category) => [String(category.stat_id), category]));
const isDisplayOnly = (category) => String(category.is_only_display_stat) === "1"
  || (category.stat_position_types || []).some((item) => String(item?.stat_position_type?.is_only_display_stat) === "1");

const categoryRecord = (category) => ({
  stat_id: category.stat_id,
  name: category.name,
  display_name: category.display_name,
  abbreviation: category.abbr,
  group: category.group,
  position_type: category.position_type,
});

const scoringCategories = categories
  .filter((category) => modifiersById.has(String(category.stat_id)))
  .map((category) => {
    const modifier = modifiersById.get(String(category.stat_id));
    return {
      ...categoryRecord(category),
      scoring_scope: category.position_type === "DT" ? "defense" : "offense",
      point_modifier: modifier.value,
      bonuses: unwrap(modifier.bonuses, "bonus").map((bonus) => ({
        target: bonus.target,
        points: bonus.points,
      })),
    };
  });

const displayOnlyCategories = categories
  .filter(isDisplayOnly)
  .map((category) => ({ ...categoryRecord(category), scoring: false, display_only: true }));

const output = {
  schema: "shivagpt-scoring-v1",
  read_only: true,
  league_id: source.league_id || leagueMetadata.league_id,
  league_name: source.league_name || leagueMetadata.name,
  season: leagueMetadata.season,
  retrieved_at: source.retrieved_at,
  source_retrieved_at: source.retrieved_at,
  scoring_settings: {
    scoring_type: settings.scoring_type,
    scoring_label: settings.scoring_label,
    uses_fractional_points: String(settings.uses_fractional_points) === "1",
    uses_negative_points: String(settings.uses_negative_points) === "1",
  },
  roster_positions: unwrap(settings.roster_positions, "roster_position").map((position) => ({
    position: position.position,
    position_type: position.position_type || null,
    count: position.count,
    is_starting_position: Boolean(Number(position.is_starting_position)),
  })),
  scoring_categories: scoringCategories,
  offense_scoring: scoringCategories.filter((category) => category.scoring_scope === "offense"),
  defense_scoring: scoringCategories.filter((category) => category.scoring_scope === "defense"),
  display_only_non_scoring_categories: displayOnlyCategories,
  yahoo_interpretation: {
    point_modifier_is_exact_yahoo_value: true,
    bonuses_are_additive_at_yahoo_target: true,
    display_only_categories_are_non_scoring: true,
  },
};

const scoringIds = new Set(scoringCategories.map((category) => String(category.stat_id)));
const modifierIds = new Set(modifiers.map((modifier) => String(modifier.stat_id)));
if (scoringIds.size !== modifierIds.size || [...modifierIds].some((id) => !scoringIds.has(id))) {
  throw new Error("Not every Yahoo scoring modifier is represented exactly once.");
}
for (const modifier of modifiers) {
  const record = scoringCategories.find((category) => String(category.stat_id) === String(modifier.stat_id));
  if (!record || record.point_modifier !== modifier.value
    || JSON.stringify(record.bonuses) !== JSON.stringify(unwrap(modifier.bonuses, "bonus").map((bonus) => ({ target: bonus.target, points: bonus.points })))) {
    throw new Error(`Yahoo scoring modifier or bonus mismatch for stat_id ${modifier.stat_id}.`);
  }
}
for (const category of displayOnlyCategories) {
  if (modifierIds.has(String(category.stat_id))) throw new Error(`Display-only stat ${category.stat_id} has a scoring modifier.`);
}
if (categories.some((category) => !modifiersById.has(String(category.stat_id)) && !isDisplayOnly(category))) {
  throw new Error("An enabled Yahoo category is neither scoring nor explicitly display-only.");
}
if (!output.offense_scoring.length || !output.defense_scoring.length || !output.roster_positions.length) {
  throw new Error("Offense scoring, defense scoring, or roster positions are incomplete.");
}

fs.writeFileSync(outputPath, JSON.stringify(output));
console.log(JSON.stringify({
  schema: output.schema,
  scoring_categories: output.scoring_categories.length,
  offense: output.offense_scoring.length,
  defense: output.defense_scoring.length,
  display_only: output.display_only_non_scoring_categories.length,
  roster_positions: output.roster_positions.length,
  validation: "passed",
}));
