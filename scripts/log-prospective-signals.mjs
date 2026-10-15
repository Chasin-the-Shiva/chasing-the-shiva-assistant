import fs from "node:fs/promises";
const read=async p=>JSON.parse(await fs.readFile(p,"utf8"));
const [q,r,g]=await Promise.all([
 read("reports/shivagpt-waiver-decision-queue.json"),
 read("reports/shivagpt-replacement-choices.json"),
 read("reports/shivagpt-acquisition-gates.json")
]);
if(q.schema!=="shivagpt-waiver-decision-queue-v1"||r.schema!=="shivagpt-replacement-choices-v1"||g.schema!=="shivagpt-acquisition-gates-v1")throw Error("Unverified weekly sources");
const week=Number(q.completed_through_week);
if(!Number.isInteger(week)||week<1||week>17)throw Error("Invalid completed week");
if(!g.source_ready)throw Error("Current Yahoo evidence not fresh; don't publish forecast");
const byId=new Map(g.watchlist.map(x=>[String(x.player_id),x]));
const candidates=r.decisions.map(x=>{
 const gate=byId.get(String(x.player_id));
 const w=x.incoming_workload;
 return {player_id:x.player_id,position:x.position,week,
  forecast_signal:x.role_classification,
  touches_last_week:w.touches,
  touches_3wk_avg:w.three_week_average_touches,
  snap_share_last_week:w.offensive_snap_share,
  forecast_higher_opportunity_next_week:x.role_classification==="RECENT_WORKLOAD_SPIKE_NEEDS_CONFIRMATION",
  projected_fantasy_points:null,expected_trade_value:null,waiver_bid:null,
  current_availability:gate?.availability??"UNVERIFIED"};
});
const out={schema:"shivagpt-prospective-signal-log-v1",read_only:true,league_id:"721343",
 recorded_at:new Date().toISOString(),completed_week:week,
 source_at:q.generated_at,candidates,
 evaluation_rule:"Record the forecast BEFORE the next NFL week; evaluate touches, snap rates and actual Yahoo fantasy points AFTER the next completed week. Never retroactively change forecast entries.",
 warning:"Research predictions only, not fantasy point projections or authorized acquisitions"};
await fs.mkdir("reports/prospective",{recursive:true});
const dest=`reports/prospective/shivagpt-week-${String(week).padStart(2,"0")}-signals.json`;
try{await fs.access(dest);throw Error("Forecast already exists; never overwrite retrospective targets")}catch(e){if(e.code!=="ENOENT")throw e}
await fs.writeFile(dest,JSON.stringify(out,null,2)+"\n");
console.log(JSON.stringify({week,forecast_count:candidates.length,output:dest}));
