import fs from "node:fs/promises";
const read=async p=>JSON.parse(await fs.readFile(p,"utf8"));
const [r,g,m]=await Promise.all([read("reports/shivagpt-replacement-choices.json"),read("reports/shivagpt-acquisition-gates.json"),read("reports/shivagpt-faab-market.json")]);
if(r.schema!=="shivagpt-replacement-choices-v1"||g.schema!=="shivagpt-acquisition-gates-v1"||m.schema!=="shivagpt-faab-market-v1")throw Error("Invalid source schema");
const sourceAge=(Date.now()-Date.parse(g.generated_at))/3600000;
const sourceLag=(Date.parse(g.generated_at)-Date.parse(r.generated_at))/60000;
const sourcesFresh=g.source_ready&&sourceAge>=0&&sourceAge<=3&&Number.isFinite(sourceLag)&&sourceLag>=0&&sourceLag<=180;
const gateMap=new Map(g.watchlist.map(x=>[String(x.player_id),x]));
const out=[];
for(const candidate of r.decisions){
 const gate=gateMap.get(String(candidate.player_id));
 if(!gate)continue;
 const viable=candidate.drop_alternatives.filter(x=>x.viability!=="DO_NOT_DROP"&&!x.protected_asset);
 const same=viable.filter(x=>x.same_position);
 const strongRole=candidate.role_classification==="SUSTAINED_USAGE";
 const spike=candidate.role_classification==="RECENT_WORKLOAD_SPIKE_NEEDS_CONFIRMATION";
 const depthNeeded=gate.needs_review.includes("TEAM_DEPTH_CHART_AND_COMPETITION_UNVERIFIED");
 const tradeNeeded=gate.needs_review.includes("TRADE_MARKET_UNVERIFIED");
 const blockers=[...(sourcesFresh?[]:["STALE_SOURCE"]),...(gate.role_evidence_met?[]:["OFFENSIVE_ROLE_INCOMPLETE"]),
  ...(same.length?[]:["NO_SAME_POSITION_REPLACEMENT_CHECKED"]),
  ...(strongRole?[]:[spike?"RECENT_SPIKE_REQUIRES_NEXT_GAME_CONFIRMATION":"INSUFFICIENT_SUSTAINED_USAGE"]),
  ...(depthNeeded?["DEPTH_CHART_UNCONFIRMED"]:[]),...(tradeNeeded?["TRADE_VALUE_UNCONFIRMED"]:[])];
 const market=m.by_position[candidate.position];
 const marketContext=market?{winning_bid_count:market.count,median:market.median,p75:market.p75,max:market.maximum}:null;
 const drops=same.slice(0,3).map(x=>({name:x.name,latest_touch_delta:x.latest_week_touch_delta,
  three_week_touch_delta:x.three_week_touch_delta,latest_snap_share_delta:x.latest_week_snap_share_delta,
  recommendation:"RESEARCH_ONLY"}));
 out.push({name:candidate.player,position:candidate.position,availability:candidate.availability,
  role:candidate.role_classification,three_week_touches:candidate.incoming_workload.three_week_average_touches,
  candidates_to_drop:drops,market_context:marketContext,remaining_faab:g.remaining_faab,
  risk_blockers:blockers,readiness:blockers.length?"HOLD_FOR_RESEARCH":"READY_FOR_INDIVIDUAL_ANALYST_REVIEW",
  recommended_bid:null,approved_add_drop:false});
}
const result={schema:"shivagpt-weekly-acquisition-decision-v1",read_only:true,
 generated_at:new Date().toISOString(),league_id:"721343",source_fresh:sourcesFresh,
 default_decision:"NO_MOVE_UNTIL_EVIDENCE_COMPLETE",recommended_moves:[],candidate_reviews:out,
 limitations:["FAAB market is historical winning bids, not an individual valuation.",
 "Depth charts, injuries, upcoming schedule and trade interest must be verified separately.",
 "No action, bid or drop approved solely by numerical workload growth."]};
await fs.writeFile("reports/shivagpt-weekly-acquisition-decision.json",JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify({reviewed:out.length,ready:out.filter(x=>x.readiness.startsWith("READY")).length,approved:0,stale:!sourcesFresh}));
