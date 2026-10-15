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
