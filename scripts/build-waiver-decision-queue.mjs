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
const playerNodes=Object.values(root[1]?.roster?.[0]?.players||{}).filter(n=>n&&Array.isArray(n.player));
const roster=playerNodes.map(n=>{
 const p=Object.assign({},...(n.player?.[0]||[]).flat(2).filter(x=>x&&typeof x==="object"&&!Array.isArray(x)));
 return {player_id:String(p.player_id),name:p.name?.full||null,position:p.primary_position||null,injury_status:p.status||null,
 selected_position:n.player?.[1]?.selected_position?.[1]?.position||null};
});
must(roster.length>=15&&roster.every(x=>/^\d+$/.test(x.player_id)&&x.name),"Roster incomplete");
const statMap=new Map(stats.players.map(p=>[String(p.player_id),p]));
const pool=new Map(avail.available_players.map(p=>[String(p.player_id),p]));
const score=(p,w)=>{const v=p?.weeks?.find(x=>Number(x.week)===w)?.yahoo_fantasy_points;return typeof v==="number"?v:null};
const weeks=[stats.completed_through_week-2,stats.completed_through_week-1,stats.completed_through_week].filter(x=>x>0);
const avg=id=>{const s=statMap.get(String(id));const pts=weeks.map(w=>score(s,w)).filter(v=>v!==null);return pts.length?Number((pts.reduce((a,b)=>a+b,0)/pts.length).toFixed(2)):null};
const nfl=await read("public/shivagpt-nfl-opportunity.json").catch(e=>{if(e.code==="ENOENT")return null;throw e});
const nflUsable=nfl?.schema==="shivagpt-nfl-opportunity-v1"&&nfl.read_only===true&&
 String(nfl.league_id)==="721343"&&nfl.season===2026&&
 Array.isArray(nfl.players)&&nfl.weeks?.includes(stats.completed_through_week);
const opportunity=new Map();
if(nflUsable)for(const p of nfl.players){
 const id=String(p.yahoo_player_id);
 if(!opportunity.has(id))opportunity.set(id,[]);
 opportunity.get(id).push(p);
}
function nflTrend(id){
 if(!nflUsable)return {status:"UNAVAILABLE",reason:"NFL source missing or wrong completed week"};
 const rows=(opportunity.get(String(id))||[]).filter(r=>Number.isInteger(r.week)).sort((a,b)=>a.week-b.week);
 if(!rows.length)return {status:"UNMATCHED",reason:"No verified Yahoo-to-NFL player ID mapping"};
 const latest=rows.findLast(r=>r.week===stats.completed_through_week);
 if(!latest)return {status:"INCOMPLETE",reason:"No record in latest completed NFL week"};
 const prior=rows.findLast(r=>r.week<latest.week);
 const fields=["carries","targets","receptions","attempts","rushing_first_downs","receiving_first_downs","target_share","receiving_air_yards"];
 const latestMetrics=Object.fromEntries(fields.map(k=>[k,latest.metrics?.[k]??null]));
 const changes=Object.fromEntries(fields.map(k=>[k,prior?.metrics?.[k]!=null&&latest.metrics?.[k]!=null?
 Number((latest.metrics[k]-prior.metrics[k]).toFixed(2)):null]));
 return {status:"MATCHED",latest_week:latest.week,latest:latestMetrics,change_vs_previous:changes,source:"nflverse weekly player statistics"};
}
const snaps=await read("public/shivagpt-nfl-snaps.json").catch(e=>{if(e.code==="ENOENT")return null;throw e});
const snapsUsable=snaps?.schema==="shivagpt-nfl-snaps-v1"&&snaps.read_only===true&&
 String(snaps.league_id)==="721343"&&snaps.weeks?.includes(stats.completed_through_week);
const snapMap=new Map();
if(snapsUsable)for(const p of snaps.rows){
 const id=String(p.yahoo_player_id);
 if(!snapMap.has(id))snapMap.set(id,[]);
 snapMap.get(id).push(p);
}
function snapTrend(id){
 if(!snapsUsable)return {status:"UNAVAILABLE"};
 const records=(snapMap.get(String(id))||[]).sort((a,b)=>a.week-b.week);
 const latest=records.findLast(x=>x.week===stats.completed_through_week);
 if(!latest)return {status:"UNMATCHED_OR_NO_CURRENT_WEEK"};
 const before=records.findLast(x=>x.week<latest.week);
 return {status:"MATCHED",week:latest.week,offense_snaps:latest.offense_snaps,
  offense_pct:latest.offense_pct,previous_offense_pct:before?.offense_pct??null,
  change_percentage_points:before?.offense_pct!=null?Number(((latest.offense_pct-before.offense_pct)*100).toFixed(1)):null,
  source:"nflverse weekly snap counts"};
}
const protectedNames=new Set(["Justin Jefferson","Chris Olave","De'Von Achane","Chase Brown","A.J. Brown"]);
const candidates=monitor.monitored.filter(x=>pool.has(String(x.player_id))).slice().sort((a,b)=>b.rank_score-a.rank_score);
const comparisons=[];
for(const target of candidates.slice(0,60)){
 const minimum={QB:1,RB:2,WR:3,TE:1,DEF:1};
 const eligible=roster.filter(p=>{
   if(protectedNames.has(p.name))return false;
   const remaining=roster.filter(q=>q.position===p.position).length-1;
   const incoming=target.position===p.position?1:0;
   return remaining+incoming>=(minimum[p.position]??0);
 });
 const drops=eligible.sort((a,b)=>(avg(a.player_id)??-999)-(avg(b.player_id)??-999)).slice(0,4);
 for(const drop of drops){
  const targetAverage=avg(target.player_id),dropAverage=avg(drop.player_id);
  if(targetAverage===null || dropAverage===null)continue;
  if(target.position===drop.position && targetAverage<=dropAverage)continue;
  const crossPosition=target.position!==drop.position;
  comparisons.push({add:{id:target.player_id,name:target.name,position:target.position,status:pool.get(String(target.player_id))?.availability_status||"unverified",recent_avg:avg(target.player_id)},drop:{id:drop.player_id,name:drop.name,recent_avg:avg(drop.player_id)},signals:target.signals,nfl_opportunity:nflTrend(target.player_id),nfl_snaps:snapTrend(target.player_id),net_recent_points:Number((targetAverage-dropAverage).toFixed(2)),cross_position:crossPosition,comparison_validity:crossPosition?"NOT_COMPARABLE_ACROSS_POSITIONS":"RECENT_POINTS_ONLY",action:"RESEARCH_ONLY",recommended_faab:null,max_faab:null,approval_required:true,evidence_status:"NFL_ROLE_NOT_VERIFIED",research_requirements:["snap_share","routes_or_carries","targets_or_receiving_work","injury_and_teammate_competition","sustainability","trade_market","exact_scoring","current_FA_W_status"],suggested_move:false});
 }
}
must(comparisons.every(x=>(x.cross_position || x.net_recent_points>0) && x.add.status!=="unverified"),"Unsafe comparison detected");
const scoredComparisons=comparisons.map(x=>{
 const o=x.nfl_opportunity;
 const latest=o?.status==="MATCHED"?o.latest:null;
 const delta=o?.status==="MATCHED"?o.change_vs_previous:null;
 const sn=x.nfl_snaps?.status==="MATCHED"?x.nfl_snaps:null;
 const rushGrowth=Math.max(0,delta?.carries||0),targetGrowth=Math.max(0,delta?.targets||0);
 const touches=(latest?.carries||0)+(latest?.targets||0);
 const recentSnap=sn?.offense_pct??null;
 const increasingSnap=Math.max(0,sn?.change_percentage_points||0);
 const positionBonus={RB:12,WR:5,TE:4,QB:0,DEF:0}[x.add.position]??0;
 const lowOpportunityPenalty=touches<4?15:0;
 const qbBackupPenalty=x.add.position==="QB"?15:0;
 const score=positionBonus+3*rushGrowth+3*targetGrowth+
   Math.min(20,touches)*.65+(recentSnap??0)*12+
   Math.min(15,increasingSnap)*.6+
   Math.min(12,Math.max(0,x.net_recent_points))*.08-lowOpportunityPenalty-qbBackupPenalty;
 return {...x,research_priority:Number(score.toFixed(2)),
  priority_basis:o?.status==="MATCHED"&&sn?"NFL_OPPORTUNITY_SNAPS_AND_SCARCITY":"INCOMPLETE_ROLE_EVIDENCE",
  role_research_complete:false};
});
const prioritized=[...scoredComparisons].sort((a,b)=>b.research_priority-a.research_priority);
const distinct=[],used=new Set();
for(const x of prioritized){
 if(used.has(x.add.id))continue;
 used.add(x.add.id);
 distinct.push({player_id:x.add.id,name:x.add.name,position:x.add.position,
  recommended_drop_research:x.drop.name,current_yahoo_status:x.add.status,
  role_evidence_status:x.nfl_opportunity?.status||"UNAVAILABLE",
  nfl_opportunity:x.nfl_opportunity,research_priority:x.research_priority});
 if(distinct.length>=25)break;
}
const result={schema:"shivagpt-waiver-decision-queue-v1",read_only:true,generated_at:new Date().toISOString(),league_id:"721343",team_name:"Chase'n The Shiva",verified_faab:faab,current_roster:roster,source_timestamps:{live:live.retrieved_at,available:avail.retrieved_at,stats:stats.generated_at,monitor:monitor.generated_at,nfl:nflUsable?nfl.generated_at:null,snaps:snapsUsable?snaps.generated_at:null},completed_through_week:stats.completed_through_week,decision_status:"NO_AUTOMATED_ACQUISITION_RECOMMENDATIONS",recommended_moves:[],default_decision:"NO_MOVE_PENDING_EVIDENCE",priority_research_targets:distinct,comparisons:scoredComparisons,limitations:["Cross-position point averages are not direct upgrade evidence; positional requirements and FLEX lineup strength need analysis.","NFL carries, targets and receptions are integrated where ID matched; snaps, routes, injuries, competition and trade appeal still require dated research before any bid.","No automatic claims, roster changes, FAAB recommendations or lineup changes.","Wednesday FA contingencies must be reverified as FA after waiver processing."]};
await fs.mkdir("reports",{recursive:true});await fs.writeFile("reports/shivagpt-waiver-decision-queue.json",JSON.stringify(result));
console.log(JSON.stringify({roster:roster.length,faab,comparisons:comparisons.length,week:stats.completed_through_week}));
