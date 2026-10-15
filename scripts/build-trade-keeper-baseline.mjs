import fs from "node:fs/promises";
const read=async p=>JSON.parse(await fs.readFile(p,"utf8"));
const [live,stats]=await Promise.all([read("public/shivagpt-live.json"),read("public/shivagpt-player-stats.json")]);
if(!live.read_only||String(live.league_id)!=="721343"||!stats.collection?.complete)throw Error("Unverified Yahoo inputs");
const teams=Object.values(live.team_rosters||{});
if(teams.length!==12)throw Error("Expected 12 league teams");
const entries=[];
for(const t of teams){
 const players=t.roster?.fantasy_content?.team?.[1]?.roster?.["0"]?.players;
 if(!players)throw Error("Missing "+t.team_name+" roster");
 const roster=Object.values(players).filter(x=>x?.player).map(v=>{
  const attrs=Object.assign({},...(v.player[0]||[]).filter(x=>x&&typeof x==="object"&&!Array.isArray(x)));
  return {id:String(attrs.player_id),name:attrs.name?.full||"Unknown",position:attrs.display_position,
   status:attrs.status||null,is_yahoo_keeper_marker:attrs.is_keeper?.status===true};
 });
 entries.push({team_id:String(t.team_id),team_name:t.team_name,roster_count:roster.length,
  players:roster,keeper_limit:3,projected_keepers:[],
  keeper_projection_status:"UNVERIFIED_REQUIRES_LEAGUE_SCORING_AND_LONG_TERM_VALUE",
  trade_surplus_candidates:[],
  note:"Three best keepers are not automatically current high-scoring players; trade and future draft pick prices need manager assessment."});
}
const out={schema:"shivagpt-league-keeper-trade-baseline-v1",read_only:true,generated_at:new Date().toISOString(),
 league_id:"721343",source_at:live.retrieved_at,teams:entries.length,keep_limit:3,managers:entries,
 trade_recommendations:[],draft_pick_recommendations:[],
 warnings:["No manager keeper forecasts are approved; this is a complete 12-team candidate roster inventory.",
 "Historical weekly Yahoo points do not establish 2027 keeper value.",
 "Never infer every nonkeeper player will be available; contracts, trades and league rules may alter next year's draft pool."]};
await fs.mkdir("reports",{recursive:true});
await fs.writeFile("reports/shivagpt-trade-keeper-baseline.json",JSON.stringify(out,null,2)+"\n");
console.log(JSON.stringify({teams:entries.length,players:entries.reduce((s,x)=>s+x.roster_count,0),unverified:entries.length}));
