import fs from "node:fs";
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const stats=read("public/shivagpt-player-stats.json"),avail=read("public/shivagpt-available.json");
if(stats.schema!=="shivagpt-player-stats-snapshot-v1"||stats.read_only!==true||avail.read_only!==true||String(avail.league_id)!=="721343"||String(stats.league_id)!=="721343")throw Error("Invalid scoring source");
const pool=new Map(avail.available_players.filter(x=>x.position==="QB"&&["FA","W"].includes(x.availability_status)).map(x=>[String(x.player_id),x]));
const week=Math.min(5,Number(stats.completed_through_week));
const rows=stats.players.filter(p=>pool.has(String(p.player_id))).map(p=>{
 const a=pool.get(String(p.player_id)),weekly=Array.from({length:week},(_,i)=>{const v=p.weeks?.find(x=>Number(x.week)===i+1)?.yahoo_fantasy_points;return typeof v==="number"?v:null});
 const complete=weekly.every(x=>x!==null);
 if(!complete)return {name:p.name,status:a.availability_status,injury:a.injury_status,complete:false,weekly};
 const ordered=[...weekly].sort((a,b)=>b-a),total=weekly.reduce((a,b)=>a+b,0),avg=total/week;
 return {name:p.name,status:a.availability_status,injury:a.injury_status,weekly,avg:+avg.toFixed(2),total:+total.toFixed(2),median:ordered[Math.floor(ordered.length/2)],excluding_best:+((total-ordered[0])/(week-1)).toFixed(2),best:ordered[0],best_two_share:+((ordered[0]+ordered[1])/total*100).toFixed(1),above_72_6:weekly.filter(x=>x>72.6).length,complete:true};
}).sort((a,b)=>(b.avg??-999)-(a.avg??-999));
console.log("SHIVA_QB_AUDIT_START");
console.log(JSON.stringify({stats_at:stats.generated_at,avail_at:avail.retrieved_at,completed:stats.completed_through_week,week_count:week,above:rows.filter(x=>x.avg>72.6),top:rows.slice(0,26)}));
console.log("SHIVA_QB_AUDIT_END");