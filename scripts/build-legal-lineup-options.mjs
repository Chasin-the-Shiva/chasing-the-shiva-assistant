import fs from "node:fs/promises";
const [lineup,live,available]=await Promise.all(["reports/shivagpt-lineup-safety.json","public/shivagpt-live.json","public/shivagpt-available.json"].map(p=>fs.readFile(p,"utf8").then(JSON.parse)));
if(lineup.schema!=="shivagpt-live-lineup-check-v1"||live.schema!=="shivagpt-season-manager-v1"||available.schema!=="shivagpt-season-manager-v1")throw Error("Unverified source");
const week=Number(lineup.lineup_week);
const weekBye=p=>Number(p.bye_week)===week;
const inactive=p=>["O","IR","IR-R","D","SUSP","PUP","NA"].includes(p.status||"")||weekBye(p);
const starters=lineup.selected_starters;
const eligibleFromBench=lineup.bench.filter(p=>p.selected_position==="BN"&&!inactive(p));
const warnings=starters.filter(inactive);
const eligible=(player,slot)=>slot==="W/R/T"?["RB","WR","TE"].includes(player.position):player.position===slot;
const remedies=warnings.map(p=>({
 starter:p.name,slot:p.selected_position,status:p.status,bye:weekBye(p),
 internal_options:eligibleFromBench.filter(x=>eligible(x,p.selected_position)).map(x=>({name:x.name,position:x.position,status:x.status})),
 external_research:available.available_players.filter(x=>x.availability_status==="FA"&&!x.injury_status&&eligible(x,p.selected_position)).slice(0,20).map(x=>({name:x.name,position:x.position,player_id:x.player_id})),
 action:"REVIEW_ONLY"
}));
const out={schema:"shivagpt-legal-lineup-options-v1",read_only:true,generated_at:new Date().toISOString(),league_id:"721343",week,
 yahoo_snapshot_at:live.retrieved_at,starter_count:starters.length,bench_eligible_count:eligibleFromBench.length,
 unavailable_starters:warnings.length,remedies,
 automatic_lineup_changes:[],complete_optimal_lineup:null,
 missing_inputs:["Projected game-by-game points under exact Yahoo scoring and remaining game schedule","External player add/drop cost and remaining roster slot limits"],
 note:"Only players actually on roster can be an internal substitution. FA choices are research leads requiring an add/drop. Doubtful and designated-to-return players treated as unavailable until cleared."};
await fs.mkdir("reports",{recursive:true});await fs.writeFile("reports/shivagpt-legal-lineup-options.json",JSON.stringify(out,null,2)+"\n");
console.log(JSON.stringify({week,warnings:warnings.length,eligibleBench:eligibleFromBench.length,internalFixes:remedies.reduce((s,x)=>s+x.internal_options.length,0)}));
