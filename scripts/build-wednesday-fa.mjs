import fs from "node:fs/promises";
const read=async p=>JSON.parse(await fs.readFile(p,"utf8"));
const [live,available,monitor,stats]=await Promise.all([
"public/shivagpt-live.json","public/shivagpt-available.json",
"reports/shivagpt-monitoring-400.json","public/shivagpt-player-stats.json"].map(read));
function assert(x,msg){if(!x)throw Error(msg)}
assert([live,available,monitor,stats].every(x=>x.read_only===true&&String(x.league_id)==="721343"),"Source invalid");
assert(monitor.schema==="shivagpt-monitoring-400-v1"&&monitor.monitored?.length===400,"Incomplete monitor");
assert(stats.collection?.complete,"Incomplete player stats");
const age=t=>(Date.now()-Date.parse(t))/3600000;
assert(age(live.retrieved_at)>=-.2&&age(live.retrieved_at)<=4,"League data stale");
assert(age(available.retrieved_at)>=-.2&&age(available.retrieved_at)<=4,"Availability data stale");
const byId=new Map(available.available_players.map(p=>[String(p.player_id),p]));
const candidates=[...monitor.monitored,...monitor.overflow_watch].filter(p=>
byId.get(String(p.player_id))?.availability_status==="FA");
const uniq=new Map(candidates.map(p=>[String(p.player_id),p]));
const ranked=[...uniq.values()].sort((a,b)=>(b.rank_score??0)-(a.rank_score??0));
const result={
 schema:"shivagpt-wednesday-fa-contingencies-v1",read_only:true,
 league_id:"721343",generated_at:new Date().toISOString(),
 status:"RESEARCH_ONLY",source_timestamps:{league:live.retrieved_at,availability:available.retrieved_at,monitor:monitor.generated_at},
 fa_candidates:ranked.slice(0,60).map(p=>({player_id:p.player_id,name:p.name,position:p.position,availability_status:"FA",
 signals:p.signals??[],priority_score:p.rank_score??null,faab_cost_if_free:0,
 action:"REVERIFY_LIVE_FA_AND_COMPARE_DROP",drop_candidate:null})),
 limitations:["This report checks the currently published FA list, not that Yahoo's Wednesday processing completed.","No waiver results or actual manager bids are inferred.","A player must be confirmed FA again immediately before any $0 transaction.","Future offensive role, NFL news, exact drop candidate and likely tradeability must be researched before recommending any move."]
};
await fs.mkdir("reports",{recursive:true});
await fs.writeFile("reports/shivagpt-wednesday-fa.json",JSON.stringify(result));
console.log(JSON.stringify({candidates:result.fa_candidates.length,source_age_hours:Number(age(available.retrieved_at).toFixed(2)),status:result.status}));
