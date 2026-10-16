import fs from "node:fs";
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const live=read("public/shivagpt-live.json"),stats=read("public/shivagpt-player-stats.json");
if(live.read_only!==true||stats.read_only!==true||String(live.league_id)!=="721343"||String(stats.league_id)!=="721343"||!stats.collection?.complete)throw Error("Invalid sources");
const byId=new Map(stats.players.map(p=>[String(p.player_id),p]));
const obj=a=>Object.assign({},...(a||[]).filter(z=>z&&typeof z==="object"&&!Array.isArray(z)));
const weeks=Array.from({length:Math.min(5,stats.completed_through_week)},(_,i)=>i+1);
const teamData=live.team_rosters.map(team=>{
 const nodes=Object.values(team.roster.fantasy_content.team[1].roster["0"].players).filter(z=>z.player);
 const players=nodes.map(n=>{const p=obj(n.player[0]),s=byId.get(String(p.player_id));const weekpts=weeks.map(w=>{const v=s?.weeks?.find(x=>Number(x.week)===w)?.yahoo_fantasy_points;return typeof v==="number"?v:null});const values=weekpts.filter(v=>typeof v==="number");
 return {name:p.name?.full,position:p.display_position,injury:p.status||null,bye:Number(p.bye_weeks?.week)||null,slot:n.player?.[1]?.selected_position?.[1]?.position||null,weekly:weekpts,avg:values.length?Number((values.reduce((a,b)=>a+b,0)/values.length).toFixed(1)):null,peak:values.length?Math.max(...values):null,week5:weekpts[4]??null};});
 return {team_id:String(team.team_id),team:team.team_name,players};
});
const match=Object.values(live.matchups.fantasy_content.team[1].matchups).map(o=>o.matchup).filter(Boolean).map(m=>({week:Number(m.week),opponent:(Object.values(m["0"].teams).filter(x=>x.team).map(x=>({id:String(obj(x.team[0]).team_id),name:obj(x.team[0]).name})).find(x=>x.id!=="7")||{}).name}));
const out={source_at:live.retrieved_at,stats_through_week:stats.completed_through_week,week_totals:[],matchups:match.filter(x=>x.week>=6&&x.week<=14),teams:teamData};
for(let w=1;w<=5;w++){const item=Object.values(live.scoreboard.fantasy_content.league[1].scoreboard[0].matchups||{});/* weekly total is from team matchups instead */ }
console.log("SHIVA_MATCHUP_ACTUALS_START");
console.log(JSON.stringify(out));
console.log("SHIVA_MATCHUP_ACTUALS_END");
