import fs from "node:fs/promises";
const data=JSON.parse(await fs.readFile("public/shivagpt-live.json","utf8"));
if(data.schema!=="shivagpt-season-manager-v1"||String(data.league_id)!=="721343"||data.read_only!==true)throw Error("Untrusted snapshot");
const team=data.roster?.fantasy_content?.team?.[1];
if(!team?.roster?.["0"]?.players)throw Error("Joe's selected lineup unavailable");
const details=Object.values(team.roster["0"].players).filter(x=>x?.player).map(raw=>{
 const pieces=Object.assign({},...(raw.player[0]||[]).filter(x=>x&&typeof x==="object"&&!Array.isArray(x)));
 const selected=Object.assign({},...(raw.player[1]?.selected_position||[]).filter(x=>x&&typeof x==="object"));
 return {id:String(pieces.player_id),name:pieces.name?.full??"Unknown",position:pieces.display_position,
  selected_position:selected.position??"UNVERIFIED",status:pieces.status??null,status_full:pieces.status_full??null,
  injury_note:pieces.injury_note??null,bye_week:pieces.bye_weeks?.week??null};
});
const actual=details.filter(p=>!["BN","IR","IL","NA"].includes(p.selected_position));
const flagged=actual.filter(p=>["O","IR","IR-R","D","NA","SUSP","PUP"].includes(p.status||"") ||
  String(p.bye_week)===String(data.settings?.fantasy_content?.league?.[0]?.current_week));
const counts={};for(const p of actual)counts[p.selected_position]=(counts[p.selected_position]||0)+1;
const out={schema:"shivagpt-live-lineup-check-v1",read_only:true,generated_at:new Date().toISOString(),source_at:data.retrieved_at,
 league_id:"721343",lineup_week:data.settings?.fantasy_content?.league?.[0]?.current_week,
 verified_roster_count:details.length,selected_starters:actual,bench:details.filter(p=>!actual.includes(p)),
 positions:counts,starter_warnings:flagged,
 recommended_lineup_changes:[],
 limits:["Injury flag is not a confirmed game designation until Yahoo is refreshed and official NFL status checked",
 "No mathematical lineup optimization is inferred from positional counts alone",
 "A starter on a bye or with Out/IR designation requires manual review, not automatic substitution"]};
await fs.mkdir("reports",{recursive:true});
await fs.writeFile("reports/shivagpt-lineup-safety.json",JSON.stringify(out,null,2)+"\n");
console.log(JSON.stringify({week:out.lineup_week,starters:actual.length,bench:out.bench.length,warnings:flagged.map(x=>({name:x.name,status:x.status,position:x.selected_position}))}));
