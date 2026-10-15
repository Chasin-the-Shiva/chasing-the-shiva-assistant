import fs from "node:fs/promises";
const read = async p => JSON.parse(await fs.readFile(p,"utf8"));
const [stats,live,available] = await Promise.all([
  read("public/shivagpt-player-stats.json"),
  read("public/shivagpt-live.json"),
  read("public/shivagpt-available.json")
]);
function check(ok,msg){if(!ok)throw new Error(msg)}
check(stats.schema==="shivagpt-player-stats-snapshot-v1" && stats.read_only && stats.collection?.complete===true,"Player statistics incomplete");
check(String(stats.league_id)==="721343" && String(live.league_id)==="721343" && String(available.league_id)==="721343","League mismatch");
check(live.read_only===true && available.read_only===true,"Invalid league snapshots");
const expected=Number(live.settings?.fantasy_content?.league?.[0]?.current_week)-1;
check(Number.isInteger(expected)&&expected>=1&&expected<=17,"Current league week not available");
check(stats.completed_through_week>=expected,`Stats stale: through Week ${stats.completed_through_week}, expected Week ${expected}`);
const age=(Date.now()-Date.parse(stats.generated_at))/3600000;
check(age>=-0.2&&age<=8,`Player statistics scan is ${age.toFixed(1)} hours old`);
const pool=available.available_players;
check(Array.isArray(pool)&&pool.length>0,"FA/W availability missing");
const byId=new Map(pool.map(p=>[String(p.player_id),p]));
const point=(p,w)=>{const x=p.weeks?.find(t=>Number(t.week)===w);return typeof x?.yahoo_fantasy_points==="number"?x.yahoo_fantasy_points:null};
const recentWeek=stats.completed_through_week;
const entries=stats.players.filter(p=>p.position && !["K","DEF"].includes(p.position)).map(p=>{
  const values=[recentWeek-2,recentWeek-1,recentWeek].map(w=>w>0?point(p,w):null);
  const latest=values[2],previous=values[1], prior=values[0];
  const recentAvg=[latest,previous].filter(v=>v!==null);
  const baseline=[previous,prior].filter(v=>v!==null);
  const change=latest!==null&&baseline.length?latest-baseline.reduce((a,b)=>a+b,0)/baseline.length:null;
  const status=byId.get(String(p.player_id));
  return {id:String(p.player_id),name:p.name||"Unknown",position:p.position,team:p.nfl_team||"",status:status?.status||status?.availability_status||p.availability_status||"unverified",latest,previous,change,season:p.season_yahoo_fantasy_points,weekly_count:(p.weeks||[]).filter(x=>typeof x.yahoo_fantasy_points==="number").length};
});
const fa=entries.filter(p=>byId.has(p.id)).sort((a,b)=>(b.change??-999)-(a.change??-999)|| (b.latest??-999)-(a.latest??-999));
const rostered=entries.filter(p=>!byId.has(p.id)).length;
const radar=await read("reports/shivagpt-popularity-radar.json").catch(e=>{if(e.code==="ENOENT")return null;throw e});
let radarState="unavailable", radarCandidates=[];
if(radar?.schema==="shivagpt-popularity-radar-v1" && radar.read_only===true &&
   String(radar.league_id)==="721343" && radar.source_status==="connected" &&
   Array.isArray(radar.spikes) && radar.spikes.length<=radar.candidate_count) {
  const hours=(Date.now()-Date.parse(radar.source_retrieved_at))/3600000;
  if(Number.isFinite(hours)&&hours>=-0.1&&hours<=6) {
    radarState="verified";
    radarCandidates=radar.spikes.filter(x=>byId.has(String(x.player_id))).map(x=>({
      ...x,current_status:byId.get(String(x.player_id))?.availability_status||"unverified"
    }));
  }else radarState="stale";
}else if(radar) radarState="invalid_or_not_connected";
const monitor=await read("reports/shivagpt-monitoring-400.json").catch(e=>{if(e.code==="ENOENT")return null;throw e});
const monitoringValid=monitor?.schema==="shivagpt-monitoring-400-v1"&&monitor.read_only===true&&
 String(monitor.league_id)==="721343"&&monitor.stats_through_week===recentWeek&&
 monitor.monitored?.length===400&&monitor.rostered_count===195&&monitor.available_count===205&&
 Number.isFinite(Date.parse(monitor.generated_at)) &&
 Date.now()-Date.parse(monitor.generated_at)<6*3600000;
const decision=await read("reports/shivagpt-waiver-decision-queue.json");
check(decision.schema==="shivagpt-waiver-decision-queue-v1"&&decision.read_only===true&&
 String(decision.league_id)==="721343"&&decision.comparisons?.length>0,
 "Missing or invalid ADD/DROP queue");
const news=await read("reports/shivagpt-nfl-news-headlines.json").catch(e=>{if(e.code==="ENOENT")return null;throw e});
const newsFresh=news?.schema==="shivagpt-nfl-news-headlines-v1"&&news.read_only===true&&
 Array.isArray(news.matched_articles)&&Number.isFinite(Date.parse(news.generated_at))&&
 Date.now()-Date.parse(news.generated_at)<6*3600000;
const articleSignals=newsFresh?news.matched_articles:[];
const fmt=x=>typeof x==="number"?x.toFixed(1):"N/A";
const lines=[
 "# ShivaGPT — Tuesday scouting data brief",
 "",
 `Generated: ${new Date().toISOString()} | Yahoo stats through Week ${recentWeek}`,
 `League snapshot: ${live.retrieved_at} | Availability snapshot: ${available.retrieved_at}`,
 "",
 "## Data coverage",
 `- Player-statistics entries: ${stats.players.length}; available entries in current snapshot: ${pool.length}; other player entries: ${rostered}.`,
 `- Complete scopes: ${Object.entries(stats.collection.scopes||{}).map(([s,v])=>s+" "+v.count).join(", ")}.`,
 "",
 "## Potential offensive breakout screening — available players",
 "This is a statistical *screening list*, not a recommendation to add/drop or spend FAAB. Confirm current Yahoo status, offensive role, injury changes and trade value with reliable NFL evidence before proposing any claim.",
 "",
 "| Player | Position | Recent week | Previous week | Change vs prior two | Yahoo status (snapshot) |",
 "|---|---|---:|---:|---:|---|",
 ...fa.slice(0,40).map(p=>`| ${p.name.replaceAll("|","/")} | ${p.position} | ${fmt(p.latest)} | ${fmt(p.previous)} | ${fmt(p.change)} | ${p.status} |`),
 "",
 "## Yahoo-wide popularity research triggers",
 `- Radar status: ${radarState}; ${radarCandidates.length} available-player signals (not acquisition recommendations).`,
 "- Yahoo's ownership delta represents a fantasy-week change, not verified 24-hour add counts. Observed between-snapshot movement is a separate percentage-point measure.",
 "",
 "| Player | FA/W | Yahoo weekly ownership change (pp) | Observed snapshot change (pp) |",
 "|---|---|---:|---:|",
 ...radarCandidates.slice(0,35).map(x=>`| ${String(x.name||"Unknown").replaceAll("|","/")} | ${x.current_status} | ${fmt(x.percent_owned_delta)} | ${fmt(x.observed_ownership_change_pp)} |`),
 "",
 "Every popularity trigger requires NFL role and injury research, exact Shiva scoring and comparison with Joe's drop candidate before an ADD recommendation.",
 "",
 "## Rolling 400-player research priorities",
 `- Monitor status: ${monitoringValid?"verified":"missing or stale — do not infer complete monitoring"}.`,
 `- Monitoring pool: ${monitoringValid?monitor.rostered_count+" rostered + "+monitor.available_count+" available":"unverified"}.`,
 `- Overflow opportunity signals: ${monitoringValid?monitor.overflow_signal_count:"unverified"}.`,
 "",
 "| Player | Position | FA/W | Screening triggers |",
 "|---|---|---|---|",
 ...(monitoringValid?monitor.monitored.filter(p=>p.availability_status!=="rostered").slice(0,35).map(p=>`| ${String(p.name||"Unknown").replaceAll("|","/")} | ${p.position} | ${p.availability_status} | ${p.signals.join(", ")||"score opportunity screen"} |`):[]),
 "",
 "Rankings are provisional screening priorities. Check current injuries, role, NFL news, exact Joe drop candidate and league scoring before recommending acquisitions.",
 "",
 "## ADD/DROP research comparisons (not approved moves)",
 `- Verified snapshot FAAB: ${decision.verified_faab}. ${decision.comparisons.length} candidate comparisons awaiting NFL-role and trade-value research.`,
 "",
 "| Add candidate | Yahoo status | Potential drop | Recent scoring difference |",
 "|---|---|---|---:|",
 ...decision.comparisons.slice(0,30).map(x=>`| ${x.add.name} | ${x.add.status} | ${x.drop.name} | ${fmt(x.net_recent_points)} |`),
 "",
 "## Verified NFL opportunity metrics (where Yahoo IDs match)",
 "These are week-over-week NFL workload observations, not Yahoo fantasy point calculations or forecasts.",
 "",
 "| Player | Targets | Carries | Receptions | Target change | Carry change | Evidence |",
 "|---|---:|---:|---:|---:|---:|---|",
 ...decision.comparisons.filter(x=>x.nfl_opportunity?.status==="MATCHED").slice(0,25).map(x=>{
   const m=x.nfl_opportunity.latest,delta=x.nfl_opportunity.change_vs_previous;
   return `| ${x.add.name} | ${fmt(m.targets)} | ${fmt(m.carries)} | ${fmt(m.receptions)} | ${fmt(delta.targets)} | ${fmt(delta.carries)} | nflverse Week ${x.nfl_opportunity.latest_week} |`;
 }),
 "",
 "## Verified NFL snap participation",
 "Use the snap-share trend alongside carries, targets and injury context; it is not sufficient by itself to recommend a transaction.",
 "",
 "| Player | Offensive snaps | Snap share | Change vs prior week (pp) |",
 "|---|---:|---:|---:|",
 ...decision.comparisons.filter(x=>x.nfl_snaps?.status==="MATCHED").slice(0,25).map(x=>
   `| ${x.add.name} | ${x.nfl_snaps.offense_snaps} | ${fmt(x.nfl_snaps.offense_pct*100)}% | ${fmt(x.nfl_snaps.change_percentage_points)} |`),
 "",
 "No FAAB bids are generated without external NFL research and a defensible improvement over the exact drop candidate.",
 "",
 "## Current sourced NFL headline research",
 `- News feed: ${newsFresh?"available":"missing or stale"}; ${articleSignals.length} matched player headlines in the latest four-day window.`,
 "- Headlines are research leads, not verified full-article conclusions. Confirm the linked reporting before forecasting return dates or approving a bid.",
 "",
 ...articleSignals.slice(0,20).map(x=>`- ${x.published_at} — ${x.publisher}: [${x.title.replaceAll("[","(").replaceAll("]",")")}](${x.url})`),
 "",
 "## Required analyst review",
 "- Validate exact Joe roster and remaining FAAB from the current league snapshot.",
 "- Compare candidates directly with the exact Joe player to be dropped.",
 "- Research snaps, routes, targets, carries, red-zone roles, injuries, transactions and team context with reliable current NFL reporting.",
 "- Prioritize tradeable offensive opportunities and scarce RBs. Do not recommend return-only specialists.",
 "- Confirm FA/W status and bid amounts at decision time; prepare Wednesday morning zero-FAAB contingencies.",
 "- Suppress unsupported recommendations if source scoring or availability is stale.",
 "",
 "The automated script prepares this factual scouting brief. It does not conduct live NFL news research or independently send messages into a ChatGPT conversation."
];
await fs.mkdir("reports",{recursive:true});
await fs.writeFile("reports/shivagpt-tuesday-latest.md",lines.join("\n")+"\n");
console.log(JSON.stringify({generated:true,week:recentWeek,pool:pool.length,candidates:fa.length,shortlist:Math.min(fa.length,40)}));
