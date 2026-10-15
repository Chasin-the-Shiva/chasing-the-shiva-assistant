import fs from "node:fs/promises";
const load=async p=>JSON.parse(await fs.readFile(p,"utf8"));
const [baseline,nfl]=await Promise.all([load("reports/shivagpt-trade-keeper-baseline.json"),load("public/shivagpt-nfl-opportunity.json")]);
if(baseline.schema!=="shivagpt-league-keeper-trade-baseline-v1"||nfl.schema!=="shivagpt-nfl-opportunity-v1"||baseline.teams!==12)throw Error("Unverified 12 team input");
const usage=new Map();
for(const p of nfl.players){
 const id=String(p.yahoo_player_id), v=Number(p.metrics.carries||0)+Number(p.metrics.targets||0);
 if(!usage.has(id))usage.set(id,[]);
 usage.get(id).push({week:p.week,touches:v,targets:Number(p.metrics.targets||0),carries:Number(p.metrics.carries||0)});
}
const teams=baseline.managers.map(team=>{
 const scored=team.players.filter(p=>p.position!=="DEF").map(p=>{
 const rec=(usage.get(String(p.id))||[]).sort((a,b)=>b.week-a.week).slice(0,3);
 const touches3=rec.length===3?Number((rec.reduce((s,x)=>s+x.touches,0)/3).toFixed(1)):null;
 const roleScore=touches3===null?null:Number((touches3+Math.min(10,rec[0].targets||0)*.5).toFixed(1));
 return {...p,recent_three_week_offensive_volume:touches3,research_role_score:roleScore};
 });
 const marked=scored.filter(x=>x.is_yahoo_keeper_marker);
 const surplus=scored.filter(x=>!x.is_yahoo_keeper_marker&&x.research_role_score!==null&&x.research_role_score>=8)
 .sort((a,b)=>b.research_role_score-a.research_role_score).slice(0,8);
 return {team_id:team.team_id,team_name:team.team_name,keeper_limit:3,
  prior_or_current_keeper_markers:marked.map(x=>({name:x.name,position:x.position})),
  projected_2027_keepers:[],
  surplus_research:surplus.map(x=>({name:x.name,position:x.position,role_score:x.research_role_score,
   recent_three_week_offensive_volume:x.recent_three_week_offensive_volume,
   market_value_verified:false,potential_trade:"DISCUSSION_CANDIDATE_ONLY"})),
  interpretation:"Prior keeper markers are not proof of the upcoming keeper selection; role score is not a keeper valuation."};
});
const out={schema:"shivagpt-trade-keeper-research-v1",read_only:true,generated_at:new Date().toISOString(),league_id:"721343",teams,
 keeper_forecasts_finalized:false,draft_pick_valuations_finalized:false,
 risks:["Future keeper values require age, role projections, injury history and comparable league trade evidence.","Three-week touches alone do not determine keeper rankings.","No trades or pick valuations are authorized."]};
await fs.mkdir("reports",{recursive:true});
await fs.writeFile("reports/shivagpt-trade-keeper-research.json",JSON.stringify(out,null,2)+"\n");
console.log(JSON.stringify({teams:teams.length,surplus_targets:teams.reduce((n,t)=>n+t.surplus_research.length,0),keeper_markers:teams.reduce((n,t)=>n+t.prior_or_current_keeper_markers.length,0)}));
