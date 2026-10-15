import fs from "node:fs/promises";
const read=async p=>JSON.parse(await fs.readFile(p,"utf8"));
const [queue,gates,nfl,snaps]=await Promise.all([read("reports/shivagpt-waiver-decision-queue.json"),read("reports/shivagpt-acquisition-gates.json"),read("public/shivagpt-nfl-opportunity.json"),read("public/shivagpt-nfl-snaps.json")]);
if(nfl.schema!=="shivagpt-nfl-opportunity-v1"||snaps.schema!=="shivagpt-nfl-snaps-v1")throw Error("Invalid NFL data");
const work=new Map(),snapMap=new Map(),workHistory=new Map(),snapHistory=new Map();
for(const x of nfl.players){const key=String(x.yahoo_player_id);if(!workHistory.has(key))workHistory.set(key,[]);workHistory.get(key).push(x);if(!work.has(key)||x.week>work.get(key).week)work.set(key,x);}
for(const x of snaps.rows){const key=String(x.yahoo_player_id);if(!snapHistory.has(key))snapHistory.set(key,[]);snapHistory.get(key).push(x);if(!snapMap.has(key)||x.week>snapMap.get(key).week)snapMap.set(key,x);}
const workload=id=>{
 const key=String(id),w=work.get(key),s=snapMap.get(key);
 const recent=(workHistory.get(key)||[]).filter(x=>x.week<=5).sort((a,b)=>b.week-a.week).slice(0,3);
 const recentSnaps=(snapHistory.get(key)||[]).filter(x=>x.week<=5).sort((a,b)=>b.week-a.week).slice(0,3);
 const weekly=recent.map(x=>({week:x.week,touches:Number(x.metrics.carries||0)+Number(x.metrics.targets||0)}));
 const avg=weekly.length===3?Number((weekly.reduce((sum,x)=>sum+x.touches,0)/3).toFixed(2)):null;
 const snapAvg=recentSnaps.length===3?Number((recentSnaps.reduce((sum,x)=>sum+x.offense_pct,0)/3).toFixed(3)):null;
 return {week:w?.week??null,touches:w?Number(w.metrics.carries||0)+Number(w.metrics.targets||0):null,
  offensive_snap_share:s?.offense_pct??null,snap_week:s?.week??null,
  last_three_weeks:weekly,three_week_average_touches:avg,three_week_snap_share:snapAvg};
};
if(queue.schema!=="shivagpt-waiver-decision-queue-v1"||gates.schema!=="shivagpt-acquisition-gates-v1"||queue.league_id!=="721343"||gates.league_id!=="721343")throw Error("Untrusted input");
const protectedNames=new Set(["Justin Jefferson","Chris Olave","Chase Brown","De'Von Achane","A.J. Brown"]);
const roster=queue.current_roster, byId=new Map(roster.map(x=>[String(x.player_id),x]));
const min={QB:1,RB:2,WR:3,TE:1,DEF:1};
const output=[];
for(const target of gates.watchlist){
 const variants=queue.comparisons.filter(x=>String(x.add.id)===String(target.player_id));
 const drops=[];
 const incomingWorkload=workload(target.player_id);
 for(const row of variants){
  const drop=byId.get(String(row.drop.id));
  if(!drop)continue;
  const remainingAtPosition=roster.filter(x=>x.position===drop.position).length-1+(target.position===drop.position?1:0);
  const protectedAsset=protectedNames.has(drop.name);
  const outgoingWorkload=workload(drop.player_id);
  const comparableWeek=incomingWorkload.week!==null&&incomingWorkload.week===outgoingWorkload.week;
  const comparableSnaps=incomingWorkload.snap_week!==null&&incomingWorkload.snap_week===outgoingWorkload.snap_week;
  const touchDelta=comparableWeek?incomingWorkload.touches-outgoingWorkload.touches:null;
  const threeWeekDelta=incomingWorkload.three_week_average_touches!==null&&outgoingWorkload.three_week_average_touches!==null?Number((incomingWorkload.three_week_average_touches-outgoingWorkload.three_week_average_touches).toFixed(2)):null;
  const snapDelta=comparableSnaps&&incomingWorkload.offensive_snap_share!==null&&outgoingWorkload.offensive_snap_share!==null?Number((incomingWorkload.offensive_snap_share-outgoingWorkload.offensive_snap_share).toFixed(3)):null;
  const viable=remainingAtPosition>=(min[drop.position]||0)&&!protectedAsset;
  drops.push({name:drop.name,position:drop.position,injury_status:drop.injury_status||null,
   recent_yahoo_points_avg:row.drop.recent_avg,
   outgoing_workload:outgoingWorkload,latest_week_touch_delta:touchDelta,three_week_touch_delta:threeWeekDelta,latest_week_snap_share_delta:snapDelta,
   same_position:drop.position===target.position,
   recent_yahoo_points_delta_same_position:row.cross_position?null:row.net_recent_points,
   roster_minimum_satisfied:remainingAtPosition>=(min[drop.position]||0),protected_asset:protectedAsset,
   viability:viable?"NEEDS_REPLACEMENT_VALUE_REVIEW":"DO_NOT_DROP",
   warnings:[...(protectedAsset?["KEEPER_ASSET_PROTECTED"]:[]),
    ...(drop.position!==target.position?["CROSS_POSITION_FLEX_IMPACT_UNVERIFIED"]:[]),
    ...(drop.injury_status?["INJURY_OR_RETURN_VALUE_NEEDS_REVIEW"]:[])]});
 }
 // Do not conflate highest point-gap candidate with the safest or best roster cut.
 drops.sort((a,b)=>Number(a.protected_asset)-Number(b.protected_asset)||
  Number(!a.same_position)-Number(!b.same_position)||
  (a.recent_yahoo_points_avg??Infinity)-(b.recent_yahoo_points_avg??Infinity));
 output.push({player_id:String(target.player_id),player:target.name,position:target.position,
  availability:target.availability,incoming_workload:incomingWorkload,drop_alternatives:drops,
  approved_drop:null,transaction_authorized:false,
  recommendation:"RESEARCH_ONLY",
  unanswered:["Current weekly starter/FLEX impact","Opportunity and depth-chart sustainability","Best realistic trade alternative","Future bye-week/keeper utility"]});
}
const out={schema:"shivagpt-replacement-choices-v1",read_only:true,
 generated_at:new Date().toISOString(),source_queue_at:queue.generated_at,league_id:"721343",
 player_count:roster.length,candidates:output.length,decisions:output,
 limitations:["Some possible drops were not evaluated by the upstream queue's top-four comparison cap.",
 "The same-position average point gap is historical, not a projection of future performance.",
 "Touches combine rushing attempts and targets, not return yards; workload comparisons require matching weeks.",
 "Three-week averages are null unless all three weekly data points exist; these are role signals, not projections.",
 "No roster move, FAAB bid, or actionable drop is approved without a full weekly starter/FLEX review."]};
await fs.writeFile("reports/shivagpt-replacement-choices.json",JSON.stringify(out,null,2)+"\n");
console.log(JSON.stringify({candidates:out.candidates,with_safe_alternatives:output.filter(x=>x.drop_alternatives.some(y=>y.viability!=="DO_NOT_DROP")).length}));
