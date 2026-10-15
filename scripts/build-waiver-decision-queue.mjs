import fs from "node:fs/promises";
const read=async p=>JSON.parse(await fs.readFile(p,"utf8"));
const [live,avail,stats,monitor]=await Promise.all(["public/shivagpt-live.json","public/shivagpt-available.json","public/shivagpt-player-stats.json","reports/shivagpt-monitoring-400.json"].map(read));
const must=(ok,msg)=>{if(!ok)throw Error(msg)};
must(live.read_only&&avail.read_only&&stats.read_only&&monitor.read_only,"Invalid read-only source");
must([live,avail,stats,monitor].every(x=>String(x.league_id)==="721343"),"League mismatch");
must(stats.collection?.complete&&monitor.monitored?.length===400,"Incomplete statistics or monitoring");
const hours=t=>(Date.now()-Date.parse(t))/3600000;
must(hours(live.retrieved_at)>=-.2&&hours(live.retrieved_at)<4,"Live snapshot stale");
must(hours(avail.retrieved_at)>=-.2&&hours(avail.retrieved_at)<4,"Availability stale");
must(hours(stats.generated_at)>=-.2&&hours(stats.generated_at)<168,"Stats stale");
const root=live.roster?.fantasy_content?.team;
must(Array.isArray(root),"Joe roster missing");
const meta=Object.assign({},...root[0].filter(x=>x&&typeof x==="object"&&!Array.isArray(x)));
const faab=Number(meta.faab_balance);
must(Number.isFinite(faab)&&faab>=0,"FAAB not verified");
const playerNodes=Object.values(root[1]?.roster?.[0]?.players||{});
const roster=playerNodes.map(n=>{
 const p=Object.assign({},...(n.player?.[0]||[]).filter(x=>x&&typeof x==="object"&&!Array.isArray(x)));
 return {player_id:String(p.player_id),name:p.name?.full||null,position:p.primary_position||null,injury_status:p.status||null,
 selected_position:n.player?.[1]?.selected_position?.[1]?.position||null};
});
must(roster.length>=15&&roster.every(x=>/^\d+$/.test(x.player_id)&&x.name),"Roster incomplete");
const statMap=new Map(stats.players.map(p=>[String(p.player_id),p]));
const pool=new Map(avail.available_players.map(p=>[String(p.player_id),p]));
const score=(p,w)=>{const v=p?.weeks?.find(x=>Number(x.week)===w)?.yahoo_fantasy_points;return typeof v==="number"?v:null};
const weeks=[stats.completed_through_week-2,stats.completed_through_week-1,stats.completed_through_week].filter(x=>x>0);
const avg=id=>{const s=statMap.get(String(id));const pts=weeks.map(w=>score(s,w)).filter(v=>v!==null);return pts.length?Number((pts.reduce((a,b)=>a+b,0)/pts.length).toFixed(2)):null};
const protectedNames=new Set(["Justin Jefferson","Chris Olave","De'Von Achane","Chase Brown","A.J. Brown"]);
const candidates=monitor.monitored.filter(x=>pool.has(String(x.player_id))).slice().sort((a,b)=>b.rank_score-a.rank_score);
const comparisons=[];
for(const target of candidates.slice(0,60)){
 const same=roster.filter(p=>p.position===target.position&&!protectedNames.has(p.name));
 const drops=same.sort((a,b)=>(avg(a.player_id)??-999)-(avg(b.player_id)??-999)).slice(0,2);
 for(const drop of drops)comparisons.push({add:{id:target.player_id,name:target.name,position:target.position,status:pool.get(String(target.player_id))?.availability_status||"unverified",recent_avg:avg(target.player_id)},drop:{id:drop.player_id,name:drop.name,recent_avg:avg(drop.player_id)},signals:target.signals,net_recent_points:avg(target.player_id)!==null&&avg(drop.player_id)!==null?Number((avg(target.player_id)-avg(drop.player_id)).toFixed(2)):null,action:"RESEARCH_ONLY",recommended_faab:null,max_faab:null,approval_required:true});
}
const result={schema:"shivagpt-waiver-decision-queue-v1",read_only:true,generated_at:new Date().toISOString(),league_id:"721343",team_name:"Chase'n The Shiva",verified_faab:faab,current_roster:roster,source_timestamps:{live:live.retrieved_at,available:avail.retrieved_at,stats:stats.generated_at,monitor:monitor.generated_at},completed_through_week:stats.completed_through_week,comparisons,limitations:["Comparisons reflect recent Yahoo point averages only, not full opportunity or future outcomes.","Targets require verified current NFL injury, snaps, routes, targets, carries, competition, trade appeal and roster context before any bid.","No automatic claims, roster changes, FAAB recommendations or lineup changes.","Wednesday FA contingencies must be reverified as FA after waiver processing."]};
await fs.mkdir("reports",{recursive:true});await fs.writeFile("reports/shivagpt-waiver-decision-queue.json",JSON.stringify(result));
console.log(JSON.stringify({roster:roster.length,faab,comparisons:comparisons.length,week:stats.completed_through_week}));
