import fs from "node:fs/promises";
const d=JSON.parse(await fs.readFile("public/shivagpt-live.json","utf8"));
if(d.schema!=="shivagpt-season-manager-v1"||d.read_only!==true||String(d.league_id)!=="721343")throw Error("Invalid league source");
const root=d.transactions?.fantasy_content?.league?.[1]?.transactions;
if(!root)throw Error("Missing transaction list");
const byPosition={};const bids=[];
for(const item of Object.values(root)){
 const tx=item?.transaction;
 if(!Array.isArray(tx))continue;
 const m=tx[0],raw=m?.faab_bid;
 if(m?.status!=="successful"||raw===undefined||raw===null||!/^\d+(?:\.\d+)?$/.test(String(raw)))continue;
 const bid=Number(raw);
 if(!Number.isFinite(bid)||bid<0||bid>100)continue;
 const players=tx[1]?.players||{};
 const added=Object.values(players).find(p=>p?.player?.[1]?.transaction_data?.[0]?.type==="add"||
  p?.player?.[1]?.transaction_data?.type==="add");
 if(!added)continue;
 const meta=Object.assign({},...(added.player[0]||[]).filter(v=>v&&typeof v==="object"&&!Array.isArray(v)));
 const pos=meta.display_position||meta.primary_position||"UNKNOWN";
 (byPosition[pos]??=[]).push(bid);bids.push(bid);
}
if(bids.length<8)throw Error("Insufficient real waiver bid history");
const percentile=(sorted,q)=>sorted[Math.max(0,Math.ceil(sorted.length*q)-1)];
const describe=values=>{
 const sorted=[...values].sort((a,b)=>a-b);
 return {count:sorted.length,minimum:sorted[0],median:percentile(sorted,.5),
  p75:percentile(sorted,.75),p90:percentile(sorted,.9),maximum:sorted.at(-1),
  over_20:sorted.filter(x=>x>=20).length,over_40:sorted.filter(x=>x>=40).length};
};
const out={schema:"shivagpt-faab-market-v1",read_only:true,league_id:"721343",
 generated_at:new Date().toISOString(),league_snapshot_at:d.retrieved_at,
 total_successful_waiver_bids:bids.length,all_positions:describe(bids),
 by_position:Object.fromEntries(Object.entries(byPosition).map(([k,v])=>[k,describe(v)])),
 limitations:["Only visible successful FAAB transactions included; losing bids are unavailable.",
 "Historical bid distributions do not establish a player's future value or recommended bid.",
 "Market data must be combined with current remaining FAAB, genuine roster improvement, position scarcity and competition."],
 recommended_bids:[]};
await fs.mkdir("reports",{recursive:true});
await fs.writeFile("reports/shivagpt-faab-market.json",JSON.stringify(out,null,2)+"\n");
console.log(JSON.stringify({bids:bids.length,market:out.all_positions,positions:Object.fromEntries(Object.entries(out.by_position).map(([k,v])=>[k,v.count]))}));
