import fs from "node:fs/promises";
const read=async p=>JSON.parse(await fs.readFile(p,"utf8"));
const [stats,avail,live,pop,inj]=await Promise.all([
 read("public/shivagpt-player-stats.json"),read("public/shivagpt-available.json"),
 read("public/shivagpt-live.json"),read("reports/shivagpt-popularity-radar.json"),
 read("reports/shivagpt-injury-radar.json")
]);
const assert=(v,s)=>{if(!v)throw Error(s)};
assert(stats.schema==="shivagpt-player-stats-snapshot-v1"&&stats.collection?.complete&&String(stats.league_id)==="721343","Invalid scoring pool");
assert(avail.read_only&&live.read_only&&String(avail.league_id)==="721343"&&String(live.league_id)==="721343","Invalid current league");
assert(pop.schema==="shivagpt-popularity-radar-v1"&&pop.source_status==="connected"&&inj.schema==="shivagpt-injury-radar-v1","Radar sources missing");
const date=Date.now();
const age=p=> (date-Date.parse(p))/3600000;
assert(age(avail.retrieved_at)>=-.2&&age(avail.retrieved_at)<=4,"Availability stale");
assert(age(stats.generated_at)>=-.2&&age(stats.generated_at)<=168,"Weekly scoring snapshot stale");
const available=new Map(avail.available_players.map(p=>[String(p.player_id),p]));
const scores=new Map(stats.players.map(p=>[String(p.player_id),p]));
const spike=new Map(pop.spikes.map(p=>[String(p.player_id),p]));
const changed=new Map(inj.changes.map(p=>[String(p.player_id),p]));
const returning=new Set((inj.early_return_research_queue||[]).map(p=>String(p.player_id)));
const priorities={RB:5,WR:4,TE:3,QB:2,DEF:1};
const newest=stats.completed_through_week;
// Explicit offensive participation only. Yards, touchdowns and return stats do not qualify.
const offensiveOpportunity=s=>/(rush(ing)? attempts?|carries|receptions|receiving targets?|pass(ing)? attempts?)/i.test(String(s.name||"")) &&
 !/(return|kick|punt|interception|defen[sc]e)/i.test(String(s.name||"")) && Number(s.value)>0;
const meaningfulOffense=p=>(p.weeks||[]).some(w=>Number(w.week)===newest &&
 (w.statistical_categories||[]).some(offensiveOpportunity));
const rows=stats.players.map(p=>{
 const id=String(p.player_id),a=available.get(id),w=p.weeks?.find(w=>Number(w.week)===newest);
 const recent=typeof w?.yahoo_fantasy_points==="number"?w.yahoo_fantasy_points:null;
 const prev=p.weeks?.find(w=>Number(w.week)===newest-1);
 const diff=recent!==null&&typeof prev?.yahoo_fantasy_points==="number"?recent-prev.yahoo_fantasy_points:null;
 const signals=[];
 if(meaningfulOffense(p))signals.push("offensive_activity");
 if(spike.has(id))signals.push("ownership_spike_research");
 if(changed.has(id))signals.push("injury_designation_change");
 if(returning.has(id))signals.push("IR_return_research_unverified");
 const ranked=!!a;
 let score=(priorities[p.position]||0)*3+(recent||0)*.06+Math.max(0,diff||0)*.12;
 if(signals.includes("offensive_activity"))score+=25;
 if(spike.has(id))score+=14+Math.min(15,Math.abs(spike.get(id).observed_ownership_change_pp||spike.get(id).percent_owned_delta||0));
 if(changed.has(id))score+=20;
 if(returning.has(id))score+=3;
 return {player_id:id,name:p.name,position:p.position,nfl_team:p.nfl_team,availability_status:a?.availability_status||"rostered",
 rank_score:Number(score.toFixed(2)),signals,latest_week_points:recent,latest_week_change:diff};
});
const rostered=rows.filter(x=>!available.has(x.player_id));
assert(rostered.length===195,"Expected all 195 manager rostered players; got "+rostered.length);
const free=rows.filter(x=>available.has(x.player_id)).sort((a,b)=>b.rank_score-a.rank_score||a.player_id.localeCompare(b.player_id));
const selection=[...rostered,...free.slice(0,205)];
assert(selection.length===400,"Expected 400 monitored players");
const overflow=free.slice(205).filter(p=>p.signals.length);
const out={schema:"shivagpt-monitoring-400-v1",read_only:true,generated_at:new Date().toISOString(),
 league_id:"721343",stats_through_week:newest,source_timestamps:{stats:stats.generated_at,availability:avail.retrieved_at,popularity:pop.source_retrieved_at,injury:inj.source_retrieved_at},
 rostered_count:rostered.length,available_count:205,overflow_signal_count:overflow.length,
 monitored:selection,overflow_watch:overflow.map(p=>({player_id:p.player_id,name:p.name,signals:p.signals,availability_status:p.availability_status})),
 limitations:["Scoring and Yahoo statistical categories do not measure routes or snaps; requires current NFL news analysis.","Return eligibility/expected dates unverified until credible dated sources are retrieved.","The 400 places are a detailed-monitoring priority, not an exclusion from full-pool availability and popularity screening."]};
await fs.mkdir("reports",{recursive:true});
await fs.writeFile("reports/shivagpt-monitoring-400.json",JSON.stringify(out));
console.log(JSON.stringify({rostered:out.rostered_count,available:out.available_count,overflow:out.overflow_signal_count,week:newest}));
