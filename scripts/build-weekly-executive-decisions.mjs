import fs from "node:fs/promises";
const read=async p=>JSON.parse(await fs.readFile(p,"utf8"));
const [decisions,market,replacements,external]=await Promise.all([
 read("reports/shivagpt-weekly-acquisition-decision.json"),
 read("reports/shivagpt-faab-market.json"),
 read("reports/shivagpt-replacement-choices.json"),
 read("reports/shivagpt-external-role-evidence.json")
]);
if(decisions.schema!=="shivagpt-weekly-acquisition-decision-v1"||market.schema!=="shivagpt-faab-market-v1"||replacements.schema!=="shivagpt-replacement-choices-v1")throw Error("Invalid review input");
const hours=t=>(Date.now()-Date.parse(t))/3600000;
const validTimes=[decisions.generated_at,market.generated_at,replacements.generated_at].every(t=>Number.isFinite(hours(t))&&hours(t)>=-.1&&hours(t)<48);
const fresh=decisions.source_fresh&&validTimes&&hours(decisions.generated_at)<4;
const reserve=Number(decisions.candidate_reviews[0]?.remaining_faab??0);
const byName=new Map(replacements.decisions.map(x=>[x.player,x]));
const roles=new Map((external.schema==="shivagpt-external-role-evidence-v1"?external.players:[]).map(p=>[p.name,p]));
const rows=[];
for(const x of decisions.candidate_reviews){
 const value=byName.get(x.name);
 const externalRole=roles.get(x.name);
 const consistent=value?.role_classification==="SUSTAINED_USAGE";
 const spike=value?.role_classification==="RECENT_WORKLOAD_SPIKE_NEEDS_CONFIRMATION";
 const historical=value?.incoming_workload?.three_week_average_touches??null;
 const avail=["FA","W"].includes(x.availability);
 const same=x.candidates_to_drop.filter(d=>d.three_week_touch_delta!==null);
 const meaningful=same.filter(d=>d.three_week_touch_delta>=4&&d.latest_touch_delta>=3);
 const supporting=consistent&&historical>=9&&meaningful.length>0;
 let tier="PASS_OR_WATCH";
 if(avail&&spike&&value?.incoming_workload?.touches>=10)tier="INVESTIGATE_BEFORE_WAIVERS";
 if(avail&&supporting)tier="ROLE_BACKED_ACQUISITION_REVIEW";
 const blockers=[...new Set([...x.risk_blockers, ...(!fresh?["STALE_OR_INCONSISTENT_INPUTS"]:[]),...(externalRole&&!externalRole.independent_verification?["EXTERNAL_ROLE_NOT_CONFIRMED"]:[])])];
 const actionable=fresh&&supporting&&blockers.length===0;
 // Market reference only, no blind bids. Must have individually verified opportunity,
 // depth, injury news, positional replacement, opponent FAAB and trade value.
 rows.push({player:x.name,position:x.position,status:x.availability,priority_tier:tier,
  observed_three_week_touches:historical,role:value?.role_classification,
  better_three_week_replacement_candidates:meaningful.map(d=>d.name),
  first_look_drop:x.candidates_to_drop[0]?.name??null,
  blocked_reasons:blockers,external_role_status:externalRole?.depth_status??"NOT_RESEARCHED",
  evidence_links:externalRole?.source_urls??[],individual_bid:null,
  pricing_reference:market.by_position[x.position]?{winning_bid_median:market.by_position[x.position].median,winning_bid_p75:market.by_position[x.position].p75}:null,
  action:actionable?"REQUIRES_ANALYST_SIGNOFF":"NO_TRANSACTION_RECOMMENDED"});
}
const result={schema:"shivagpt-weekly-executive-decisions-v1",read_only:true,generated_at:new Date().toISOString(),league_id:"721343",
 verified_inputs_fresh:fresh,remaining_faab:reserve,
 decision:rows.some(x=>x.action==="REQUIRES_ANALYST_SIGNOFF")?"CANDIDATE_NEEDS_HUMAN_VERIFICATION":"HOLD_FAAB_NO_MOVE",
 automatic_transactions_enabled:false,approved_moves:[],
 ranked_research:rows.sort((a,b)=>({ROLE_BACKED_ACQUISITION_REVIEW:0,INVESTIGATE_BEFORE_WAIVERS:1,PASS_OR_WATCH:2}[a.priority_tier]-{ROLE_BACKED_ACQUISITION_REVIEW:0,INVESTIGATE_BEFORE_WAIVERS:1,PASS_OR_WATCH:2}[b.priority_tier])),
 faab_policy:{low_value:"$0-$3 only after real upgrade verified",medium_value:"$4-$19 only after role/competition verification",difference_maker:"$20+ only with unusually high expected return, scarcity and verified current FAAB",hard_spend_cap:reserve,source:"League historical winning bids, not recommended individual prices"},
 caveats:["No current depth-chart or medical-status verification is established by internal metrics alone.","Return yards alone do not count as sustainable trade appeal.","No automated Yahoo transactions, bids, roster changes or keeper decisions."]};
await fs.mkdir("reports",{recursive:true});
await fs.writeFile("reports/shivagpt-weekly-executive-decisions.json",JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify({fresh,decision:result.decision,reviewed:rows.length,first:result.ranked_research.slice(0,4).map(x=>[x.player,x.priority_tier])}));
