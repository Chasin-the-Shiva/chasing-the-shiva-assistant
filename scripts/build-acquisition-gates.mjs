import fs from "node:fs/promises";
const read=async p=>JSON.parse(await fs.readFile(p,"utf8"));
const [q,market,injury]=await Promise.all([read("reports/shivagpt-waiver-decision-queue.json"),read("reports/shivagpt-faab-market.json"),read("reports/shivagpt-injury-radar.json")]);
if(q.schema!=="shivagpt-waiver-decision-queue-v1"||q.read_only!==true||q.league_id!=="721343")throw Error("Invalid decision queue");
if(market.schema!=="shivagpt-faab-market-v1"||market.read_only!==true)throw Error("Invalid FAAB market");
const now=Date.now(),age=t=>(now-Date.parse(t))/3600000;
const sourceFresh=age(q.source_timestamps.live)<=3&&age(q.source_timestamps.available)<=3&&age(q.generated_at)<=4;
const money=Number(q.verified_faab);
if(!Number.isFinite(money)||money<0||money>100)throw Error("Invalid remaining FAAB");
const injuryById=new Map((injury.active_injury_watch||[]).map(p=>[String(p.player_id),p]));
const protectedPlayers=new Set(["Justin Jefferson","Chris Olave","Chase Brown","De'Von Achane","A.J. Brown"]);
const seen=new Set(),watch=[];
for(const row of [...q.comparisons].sort((a,b)=>b.research_priority-a.research_priority)){
 const id=String(row.add.id);if(seen.has(id))continue;seen.add(id);
 const usage=row.nfl_opportunity?.latest||{};
 const prior=row.nfl_opportunity?.change_vs_previous||{};
 const snap=row.nfl_snaps||{};
 const touches=Number(usage.carries||0)+Number(usage.targets||0);
 const growth=Number(prior.carries||0)+Number(prior.targets||0);
 const snapPct=Number(snap.offense_pct);
 const roleConfirmed=row.nfl_opportunity?.status==="MATCHED"&&snap.status==="MATCHED"&&touches>=6&&Number.isFinite(snapPct)&&snapPct>=.25;
 const exactFA=row.add.status==="FA";
 const statusGood=exactFA||row.add.status==="W";
 const dropSamePosition=!row.cross_position;
 const dropUnprotected=!protectedPlayers.has(row.drop.name);
 const injuryFlag=injuryById.has(id);
 const sufficient=sourceFresh&&roleConfirmed&&statusGood&&dropSamePosition&&dropUnprotected&&!injuryFlag&&money>0;
 const gaps=[];
 if(!sourceFresh)gaps.push("SOURCE_STALE");
 if(!statusGood)gaps.push("AVAILABILITY_NOT_CONFIRMED");
 if(!roleConfirmed)gaps.push("NFL_ROLE_NOT_CONFIRMED");
 if(!dropSamePosition)gaps.push("CROSS_POSITION_REPLACEMENT_NOT_EVALUATED");
 if(!dropUnprotected)gaps.push("PROTECTED_KEEPER_CANNOT_BE_AUTO_DROPPED");
 if(injuryFlag)gaps.push("INJURY_STATUS_NEEDS_VERIFICATION");
 gaps.push("TEAM_DEPTH_CHART_AND_COMPETITION_UNVERIFIED","TRADE_MARKET_UNVERIFIED");
 // Source data alone is insufficient to recommend a paid transaction.
 watch.push({player_id:id,name:row.add.name,position:row.add.position,availability:row.add.status,
  potential_drop:row.drop.name,research_score:row.research_priority,
  recent_carries:usage.carries??null,recent_targets:usage.targets??null,
  opportunity_growth:growth,offensive_snap_pct:Number.isFinite(snapPct)?snapPct:null,
  role_evidence_met:roleConfirmed,possible_same_position_swap:dropSamePosition,protected_drop:!dropUnprotected,
  needs_review:gaps,analyst_candidate:sufficient,
  recommendation:"RESEARCH_ONLY",faab_bid:null,approval_required:true});
 if(watch.length>=15)break;
}
const out={schema:"shivagpt-acquisition-gates-v1",read_only:true,generated_at:new Date().toISOString(),
 league_id:"721343",source_ready:sourceFresh,remaining_faab:money,winning_bid_market:market.by_position,
 decision:"NO_BID_WITHOUT_INDIVIDUAL_ROLE_AND_TRADE_VERIFICATION",
 recommended_transactions:[],watchlist:watch,
 safety_rules:["Source timestamps and exact Yahoo FA/W status required","NFL usage and snap evidence required",
 "Cross-position drop cannot be compared by raw fantasy point averages",
 "Protected keeper-quality roster assets cannot be proposed as automatic drops",
 "No FAAB bid without dated depth-chart, injury, competition and replacement-value review",
 "Historical winning FAAB bids exclude losing bids; they cannot set a player's bid automatically",
 "No writes to Yahoo"]};
await fs.mkdir("reports",{recursive:true});
await fs.writeFile("reports/shivagpt-acquisition-gates.json",JSON.stringify(out,null,2)+"\n");
console.log(JSON.stringify({source_ready:sourceFresh,watchlist:watch.length,role_gate_pass:watch.filter(x=>x.role_evidence_met).length,analyst_candidates:watch.filter(x=>x.analyst_candidate).length,approved_bids:0}));
