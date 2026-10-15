import fs from "node:fs/promises";
const read=async p=>JSON.parse(await fs.readFile(p,"utf8"));
const [lineup,avail,executive]=await Promise.all([read("reports/shivagpt-lineup-safety.json"),read("public/shivagpt-available.json"),read("reports/shivagpt-weekly-executive-decisions.json")]);
if(lineup.schema!=="shivagpt-live-lineup-check-v1"||String(lineup.league_id)!=="721343"||executive.schema!=="shivagpt-weekly-executive-decisions-v1")throw Error("Sources invalid");
const byName=new Map(avail.available_players.map(x=>[x.name,x]));
const candidates=["Jameis Winston","Geno Smith","Michael Penix Jr.","Kyler Murray"].map(name=>{const p=byName.get(name);return p?{name,player_id:p.player_id,status:p.availability_status,injury_status:p.injury_status}:null}).filter(Boolean);
const warnings=lineup.starter_warnings.map(p=>({name:p.name,status:p.status,slot:p.selected_position,severity:["O","IR","IR-R"].includes(p.status)?"HIGH":"REVIEW"}));
const out={schema:"shivagpt-weekly-lineup-action-review-v1",read_only:true,generated_at:new Date().toISOString(),league_id:"721343",
 season_week:lineup.lineup_week,roster_source_at:lineup.source_at,availability_source_at:avail.retrieved_at,
 starter_warnings:warnings,verified_available_qb_options:candidates,preferred_short_term_qb_research:"Jameis Winston",
 priority_actions:["URGENT: replace QB Jalen Hurts (Out) if a viable starter can be obtained without sacrificing core assets.",
 "Review Tre Harris (Doubtful) and A.J. Brown (IR-R) in the two FLEX slots before lock.",
 "Verify Chris Olave and Dontayvion Wicks questionable status close to their games.",
 "Avoid spending substantial FAAB on a lost bye-week matchup unless player has value past Week 6."],
 trade_or_waiver_orders_placed:0,lineup_changed:false,
 limits:["Yahoo may change after the source snapshot; check status before claims.","No replacement is approved without current eligibility, roster slot, potential drop and meaningful future value.","This is a safety/priority report, not a projected optimal lineup."]};
await fs.mkdir("reports",{recursive:true});
await fs.writeFile("reports/shivagpt-weekly-lineup-action-review.json",JSON.stringify(out,null,2)+"\n");
console.log(JSON.stringify({week:out.season_week,warnings:warnings.length,qbs:candidates.length,priority:out.priority_actions[0]}));
