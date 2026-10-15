import fs from "node:fs/promises";
const read=async p=>JSON.parse(await fs.readFile(p,"utf8"));
const [baseline,stats,nfl]=await Promise.all([read("reports/shivagpt-trade-keeper-baseline.json"),read("public/shivagpt-player-stats.json"),read("public/shivagpt-nfl-opportunity.json")]);
if(baseline.teams!==12||!stats.collection?.complete||nfl.schema!=="shivagpt-nfl-opportunity-v1")throw Error("Untrusted keeper inputs");
const week=Number(stats.completed_through_week);
const statMap=new Map(stats.players.map(p=>[String(p.player_id),p]));
const touches=new Map();
for(const p of nfl.players){const id=String(p.yahoo_player_id);if(!touches.has(id))touches.set(id,[]);touches.get(id).push(p)}
const score=id=>{const p=statMap.get(String(id));const w=[week-2,week-1,week].map(n=>p?.weeks?.find(x=>Number(x.week)===n)?.yahoo_fantasy_points);return w.every(x=>typeof x==="number")?Number((w.reduce((a,b)=>a+b,0)/3).toFixed(1)):null};
const volume=id=>{const rows=(touches.get(String(id))||[]);const vals=[week-2,week-1,week].map(w=>rows.find(x=>x.week===w));return vals.every(Boolean)?Number((vals.reduce((a,x)=>a+Number(x.metrics.carries||0)+Number(x.metrics.targets||0),0)/3).toFixed(1)):null};
const result=baseline.managers.map(t=>{
 const ranked=t.players.filter(p=>p.position!=="DEF").map(p=>({...p,three_week_yahoo_points:score(p.id),three_week_rush_plus_targets:volume(p.id),
  candidate_research_score:score(p.id)!=null?Number((score(p.id)+Math.min(20,volume(p.id)||0)*.2).toFixed(2)):null}))
 .sort((a,b)=>(b.candidate_research_score??-999)-(a.candidate_research_score??-999));
 return {team_id:t.team_id,team_name:t.team_name,ranked_player_research:ranked,
  top_three_production_only:ranked.slice(0,3).map(p=>p.name),
  actual_projected_keepers:[],
  keeper_scarcity_notes:"Yahoo three-week points and role only; future keeper value requires age, injuries, opportunity and market context."};
});
const out={schema:"shivagpt-keeper-production-screen-v1",read_only:true,generated_at:new Date().toISOString(),league_id:"721343",completed_week:week,
 teams:result,not_an_actual_keeper_forecast:true,trade_orders:[],pick_orders:[],
 limitations:["Top-three production screen is not projected keeper choice.","Actual keepers require future season expectations and league-specific draft position mapping.","A low recent three-week score does not imply a star is expendable."]};
await fs.mkdir("reports",{recursive:true});await fs.writeFile("reports/shivagpt-keeper-production-screen.json",JSON.stringify(out,null,2)+"\n");
console.log(JSON.stringify({teams:result.length,scored:result.reduce((n,t)=>n+t.ranked_player_research.filter(p=>p.candidate_research_score!==null).length,0)}));
