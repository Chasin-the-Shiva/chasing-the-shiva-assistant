import fs from "node:fs/promises";

const live=JSON.parse(await fs.readFile("public/shivagpt-live.json","utf8"));
const history=JSON.parse(await fs.readFile("public/shivagpt-manager-history.json","utf8"));
const available=JSON.parse(await fs.readFile("public/shivagpt-available.json","utf8"));
if(!live.read_only||!available.read_only||history.schema!=="shivagpt-manager-history-v3"||
  [live.league_id,available.league_id].some(x=>String(x)!=="721343"))
 throw Error("Manager scouting source validation failed");
const normalize=s=>String(s||"").normalize("NFKD").replace(/[’']/g,"").replace(/[^a-zA-Z0-9]+/g," ").trim().toLowerCase();
const watched=new Map([["manager_john","John Fitzgerald"],["manager_dom","Dom"]]);
const lookup=history.manager_lookup?.by_team_name||{};
const pool=new Map((available.available_players||[]).map(p=>[String(p.player_id),p]));
const transactions=live.transactions?.fantasy_content?.league?.[1]?.transactions||{};
const signals=[];
const unresolved=[];
for(const entry of Object.values(transactions)){
 const data=entry?.transaction;
 if(!Array.isArray(data))continue;
 const meta=data[0]||{};
 if(meta.status!=="successful"||!["add","add/drop"].includes(meta.type))continue;
 const players=data[1]?.players||{};
 for(const record of Object.values(players)){
  const player=record?.player;
  if(!Array.isArray(player))continue;
  const details=player[1]?.transaction_data;
  const acts=Array.isArray(details)?details:[details];
  for(const act of acts){
   if(act?.type!=="add"||act.destination_type!=="team")continue;
   const id=lookup[normalize(act.destination_team_name)];
   if(!watched.has(id)){
     if(/stud.?monkey|infinity.*bij/i.test(act.destination_team_name||""))unresolved.push(act.destination_team_name);
     continue;
   }
   const facts=Object.assign({},...player[0].filter(x=>x&&typeof x==="object"&&!Array.isArray(x)));
   const pid=String(facts.player_id||"");
   const current=pool.get(pid);
   signals.push({
     manager_id:id,manager_label:watched.get(id),team_at_transaction:act.destination_team_name,
     transaction_id:meta.transaction_id||null,transaction_timestamp:meta.timestamp?new Date(Number(meta.timestamp)*1000).toISOString():null,
     player_id:pid,player_name:facts.name?.full||"Unidentified player",position:facts.display_position||null,
     faab_bid:meta.faab_bid===undefined?null:Number(meta.faab_bid),
     acquisition_source:act.source_type||null,
     current_availability:current?.availability_status||"NOT_IN_AVAILABLE_POOL",
     research_signal:"RESPECTED_MANAGER_ACQUISITION_REVIEW",
     requires:["Confirm injury/return history","Confirm draft pedigree","Compare NFL snap share, routes, targets, carries and red zone with previous games","Verify competing starters and role durability","Check current Yahoo FA/W status and exact drop","Assess keeper/trade value, cost and hindsight outcomes"],
     acquisition_recommendation:false
   });
  }
 }
}
signals.sort((a,b)=>String(b.transaction_timestamp).localeCompare(String(a.transaction_timestamp)));
const result={
 schema:"shivagpt-manager-acquisition-scouting-v1",read_only:true,generated_at:new Date().toISOString(),
 source_timestamps:{live:live.retrieved_at,available:available.retrieved_at,manager_history:history.generated_at},
 watched_managers:[...watched].map(([manager_id,name])=>({manager_id,name,assessment:"User-identified strong competitor; not statistically validated predictive skill"})),
 manager_history_available:history.manager_profiles?.filter(p=>watched.has(p.manager_id)).map(p=>({manager_id:p.manager_id,seasons:Object.keys(p.seasons||{}),continuity_status:p.continuity_status}))||[],
 acquisition_signals:signals.slice(0,100),
 unresolved_manager_aliases:[...new Set(unresolved)],
 strategy:{priority:"Find promising rookie/second-year injury returns BEFORE increased opportunity becomes a public breakout",
  filters:["Draft capital and role","IR/practice/activation timing","Offensive snap/route/target/carry trends","Depth chart opening","Keeper/trade upside","Comparable drop cost"],
  warning:"Acquisitions by successful opponents are research leads, not proof of player value or permission to copy transactions. Do not infer motives or record failed bids from successful transactions."},
 automatic_transactions_enabled:false
};
await fs.mkdir("reports",{recursive:true});
await fs.writeFile("reports/shivagpt-manager-acquisition-scouting.json",JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify({signals:signals.length,watched:result.watched_managers.length,unresolved:result.unresolved_manager_aliases}));
