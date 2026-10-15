import fs from "node:fs/promises";
const read = async path => JSON.parse(await fs.readFile(path,"utf8"));
const check = (condition, message) => { if (!condition) throw new Error(message); };
const sourcePath = process.argv[2] || "public/shivagpt-popularity-source.json";
const outputPath = process.argv[3] || "reports/shivagpt-popularity-radar.json";
const league = await read("public/shivagpt-available.json");
check(league.read_only === true && String(league.league_id) === "721343", "Availability snapshot invalid");
const current = new Map(league.available_players.map(p => [String(p.player_id), p]));
let source;
try { source = await read(sourcePath); } catch(error) {
  if(error.code !== "ENOENT") throw error;
  source = null;
}
const report = {schema:"shivagpt-popularity-radar-v1",read_only:true,generated_at:new Date().toISOString(),
  source_status:"not_connected",source_retrieved_at:null,league_id:"721343",
  candidate_count:0,spikes:[],message:"Yahoo-wide ownership/add-drop source not connected. No popularity conclusions can be drawn."};
if(source) {
  check(source.schema==="shivagpt-popularity-source-v1" && source.read_only===true,"Popularity source schema invalid");
  check(String(source.league_id)==="721343" && Array.isArray(source.players),"Popularity source league/players invalid");
  const age=Date.now()-Date.parse(source.retrieved_at);
  check(Number.isFinite(age)&&age>=-300000&&age<=6*3600000,"Popularity data stale");
  const entries=source.players.map(p=>{
    const id=String(p.player_id||"");
    check(/^\d+$/.test(id),"Invalid player ID");
    const delta=typeof p.percent_owned_delta==="number"?p.percent_owned_delta:null;
    const adds=typeof p.adds_24h==="number"?p.adds_24h:null;
    const drops=typeof p.drops_24h==="number"?p.drops_24h:null;
    check(delta===null||Number.isFinite(delta),"Invalid ownership delta");
    check(adds===null||(Number.isInteger(adds)&&adds>=0),"Invalid add count");
    check(drops===null||(Number.isInteger(drops)&&drops>=0),"Invalid drop count");
    return {player_id:id,name:p.name||current.get(id)?.name||null,availability_status:current.get(id)?.availability_status||"rostered_or_unknown",
      percent_owned:typeof p.percent_owned==="number"?p.percent_owned:null,
      percent_owned_delta:delta,adds_24h:adds,drops_24h:drops};
  });
  const addBase=entries.map(x=>x.adds_24h).filter(x=>x!==null&&x>0).sort((a,b)=>a-b);
  const baseline=addBase.length?addBase[Math.floor(addBase.length/2)]:null;
  report.source_status="connected";
  report.source_retrieved_at=source.retrieved_at;
  report.candidate_count=entries.length;
  report.spikes=entries.filter(x=>
    (x.adds_24h!==null && baseline!==null && x.adds_24h>=Math.max(100,baseline*10)) ||
    (x.percent_owned_delta!==null && x.percent_owned_delta>=5) ||
    (x.drops_24h!==null && baseline!==null && x.drops_24h>=Math.max(100,baseline*10))
  ).sort((a,b)=>(b.adds_24h||0)-(a.adds_24h||0)|| (b.percent_owned_delta||0)-(a.percent_owned_delta||0));
  report.message="Signals only. Verify NFL news, offensive roles, Shiva league scoring, current availability and exact drop candidate before recommending action.";
}
await fs.mkdir("reports",{recursive:true});
await fs.writeFile(outputPath,JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({status:report.source_status,candidates:report.candidate_count,spikes:report.spikes.length}));
