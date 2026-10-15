import fs from "node:fs/promises";
const read=async p=>JSON.parse(await fs.readFile(p,"utf8"));
const now=new Date().toISOString();
const avail=await read("public/shivagpt-available.json");
const live=await read("public/shivagpt-live.json");
if(avail.read_only!==true||live.read_only!==true||String(avail.league_id)!=="721343"||String(live.league_id)!=="721343")throw Error("Invalid snapshots");
const players=new Map();
function collect(v){
 if(!v||typeof v!=="object")return;
 if(Array.isArray(v)){for(const a of v)collect(a);return}
 if(Array.isArray(v.player)){
   const metadata=Object.assign({},...v.player.flat(2).filter(x=>x&&typeof x==="object"&&!Array.isArray(x)));
   if(metadata.player_id&&metadata.name?.full){
     players.set(String(metadata.player_id),{
       player_id:String(metadata.player_id),name:metadata.name.full,
       position:metadata.primary_position||metadata.display_position||null,
       injury_status:metadata.status||metadata.injury_status||null,
       availability_status:"rostered"
     });
   }
 }
 for(const x of Object.values(v))collect(x);
}
collect(live.roster);
for(const t of live.team_rosters||[])collect(t.roster);
for(const p of avail.available_players||[])players.set(String(p.player_id),{player_id:String(p.player_id),name:p.name,position:p.position,injury_status:p.injury_status||null,availability_status:p.availability_status});
const previousPath="public/shivagpt-injury-state.json";
let previous=null;try{previous=await read(previousPath)}catch(e){if(e.code!=="ENOENT")throw e}
if(previous && (previous.schema!=="shivagpt-injury-state-v1"||String(previous.league_id)!=="721343"))throw Error("Invalid prior injury baseline");
const older=new Map((previous?.players||[]).map(x=>[x.player_id,x]));
const tracked=[...players.values()].sort((a,b)=>a.player_id.localeCompare(b.player_id));
const rosteredCount=tracked.filter(x=>x.availability_status==="rostered").length;
console.log(JSON.stringify({rostered:rosteredCount,available:avail.available_players.length,total:tracked.length}));
if(tracked.length<1100 || rosteredCount<190)throw Error("Incomplete injury player coverage");
const meaningful=new Set(["IR","PUP","NFI","O","D","Q","SUS","SUSP","OUT","DNR"]);
const isMeaningful=s=>meaningful.has(String(s||"").toUpperCase());
const ageHours=(Date.now()-Date.parse(avail.retrieved_at))/3600000;
if(!Number.isFinite(ageHours)||ageHours<-.1||ageHours>3)throw Error("Injury source snapshot stale; preserving last valid baseline");
const changes=[];
for(const p of tracked){let o=older.get(p.player_id);if(!o)continue;if(o.injury_status!==p.injury_status && (isMeaningful(o.injury_status)||isMeaningful(p.injury_status))){
changes.push({player_id:p.player_id,name:p.name,position:p.position,availability_status:p.availability_status,previous_status:o.injury_status,current_status:p.injury_status,signal:"injury_designation_change",research_required:true,return_date:null,return_confidence:"unverified"});}
}
const injuries=tracked.filter(p=>isMeaningful(p.injury_status));
const state={schema:"shivagpt-injury-state-v1",read_only:true,retrieved_at:avail.retrieved_at,generated_at:now,league_id:"721343",players:tracked};
const report={schema:"shivagpt-injury-radar-v1",read_only:true,generated_at:now,league_id:"721343",source_retrieved_at:avail.retrieved_at,baseline_available:!!previous,designation_filter:[...meaningful],player_count:tracked.length,injured_player_count:injuries.length,changes,active_injury_watch:injuries.map(x=>({...x,return_date:null,earliest_eligible_date:null,practice_window:null,source_verified:false,research_required:true})),limitations:["Yahoo injury code does not establish IR entry date, return eligibility, practice-window status or medically expected return. Validate via team/NFL reporting.","This is a designation-change radar, not an independently verified injury-news feed. Do not recommend adds based only on this file.","IR/PUP eligibility, practice windows, injury timeline and early return candidates require dated official NFL or credible reporter evidence."]};
await fs.writeFile("public/shivagpt-injury-state.json",JSON.stringify(state));
await fs.mkdir("reports",{recursive:true});
await fs.writeFile("reports/shivagpt-injury-radar.json",JSON.stringify(report));
console.log(JSON.stringify({players:tracked.length,injured:injuries.length,changes:changes.length,baseline:!!previous}));
