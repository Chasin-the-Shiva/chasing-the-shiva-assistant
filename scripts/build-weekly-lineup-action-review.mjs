import fs from "node:fs/promises";
const read=async p=>JSON.parse(await fs.readFile(p,"utf8"));
const [lineup,avail,executive]=await Promise.all([read("reports/shivagpt-lineup-safety.json"),read("public/shivagpt-available.json"),read("reports/shivagpt-weekly-executive-decisions.json")]);
if(lineup.schema!=="shivagpt-live-lineup-check-v1"||String(lineup.league_id)!=="721343"||executive.schema!=="shivagpt-weekly-executive-decisions-v1"||avail.schema!=="shivagpt-season-manager-v1"||avail.read_only!==true||String(avail.league_id)!=="721343"||!Array.isArray(avail.available_players))throw Error("Sources invalid");
const age=t=>(Date.now()-Date.parse(t))/3600000;
const fresh=[lineup.source_at,avail.retrieved_at].every(t=>Number.isFinite(age(t))&&age(t)>=-0.25&&age(t)<=3);
const sameSnapshot=Math.abs(Date.parse(lineup.source_at)-Date.parse(avail.retrieved_at))<=60*60*1000;
const safe=fresh&&sameSnapshot;
const inactive=p=>["O","IR","IR-R","D","NA","SUSP","PUP"].includes(p.status||"")||Number(p.bye_week)===Number(lineup.lineup_week);
const slotMatch=(p,slot)=>slot==="W/R/T"?["WR","RB","TE"].includes(p.position):p.position===slot;
const bench=lineup.bench.filter(p=>p.selected_position==="BN"&&!inactive(p));
const warnings=lineup.starter_warnings.map(p=>({name:p.name,status:p.status,slot:p.selected_position,bye:Number(p.bye_week)===Number(lineup.lineup_week),severity:["O","IR","IR-R","SUSP","PUP"].includes(p.status)?"HIGH":"REVIEW",
 internal_options:bench.filter(b=>slotMatch(b,p.selected_position)).map(b=>({name:b.name,position:b.position,status:b.status}))}));
const qbs=avail.available_players.filter(p=>p.position==="QB"&&["FA","W"].includes(p.availability_status)&&!p.injury_status).map(p=>({name:p.name,player_id:p.player_id,status:p.availability_status,injury_status:p.injury_status??null}));
const actions=[];
if(!safe)actions.push("SOURCE STALE OR MISMATCHED: verify Yahoo roster and available pool before acting.");
for(const w of warnings){
 const replacement=w.internal_options.length?w.internal_options.map(p=>p.name).join(", "):"no verified eligible bench replacement";
 actions.push(`REVIEW ${w.name} (${w.slot}; ${w.bye?"BYE":w.status||"designation unclear"}): ${replacement}. Confirm official status and lineup eligibility before lock.`);
}
if(warnings.some(w=>w.slot==="QB")&&qbs.length)actions.push("QB external research available; compare role, game status, exact roster drop and future value before any add.");
if(!warnings.length)actions.push("No unavailable starters detected in this snapshot; verify injuries and status before kickoff.");
actions.push("Avoid meaningful FAAB spending solely to rescue a short-term matchup unless the pickup improves the roster beyond this week.");
const out={schema:"shivagpt-weekly-lineup-action-review-v1",read_only:true,generated_at:new Date().toISOString(),league_id:"721343",
 season_week:lineup.lineup_week,roster_source_at:lineup.source_at,availability_source_at:avail.retrieved_at,
 source_fresh:safe,starter_warnings:warnings,verified_available_qb_options:safe?qbs:[],
 preferred_short_term_qb_research:null,priority_actions:actions,
 trade_or_waiver_orders_placed:0,lineup_changed:false,
 limits:["No fixed player recommendations: every warning is generated from the current Yahoo snapshot.",
 "Availability is a research lead, not evidence of a startable NFL role or a justified drop.",
 "Do not treat this report as a mathematically optimal lineup or execute any Yahoo change."]};
await fs.mkdir("reports",{recursive:true});
await fs.writeFile("reports/shivagpt-weekly-lineup-action-review.json",JSON.stringify(out,null,2)+"\n");
console.log(JSON.stringify({week:out.season_week,source_fresh:safe,warnings:warnings.length,bench_options:warnings.reduce((n,w)=>n+w.internal_options.length,0),qb_research:qbs.length}));
