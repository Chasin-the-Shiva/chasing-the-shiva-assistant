import fs from "node:fs";
const data=JSON.parse(fs.readFileSync("public/shivagpt-player-stats.json","utf8"));
if(data.schema!=="shivagpt-player-stats-snapshot-v1"||data.read_only!==true||String(data.league_id)!=="721343")throw Error("Untrusted stats file");
const references=[
 {id:"40029",name:"Bryce Young",expected:{"1":103.1,"2":80.9,"3":72.1,"4":86.5},bye:5},
 {id:"32723",name:"Jalen Hurts",expected:{"1":70.5,"2":78.6,"3":51.3,"4":34.9,"5":58.4},bye:10}
];
let ok=true;
for(const r of references){
 const p=data.players.find(x=>String(x.player_id)===r.id);
 if(!p){console.error("MISSING_PLAYER",r.name,r.id);ok=false;continue;}
 const results=Object.entries(r.expected).map(([week,expected])=>{
  const x=p.weeks.find(x=>Number(x.week)===Number(week));
  const actual=x?.yahoo_fantasy_points??null;
  const valid=typeof actual==="number"&&Math.abs(actual-expected)<0.011;
  if(!valid)ok=false;
  return {week:Number(week),expected,actual,match:valid,data_status:x?.data_status??null};
 });
 const bye=p.weeks.find(x=>Number(x.week)===r.bye);
 const byeValue=bye?.yahoo_fantasy_points??null;
 if(r.name==="Bryce Young"&&byeValue!==0){console.error("BYE_NOT_ZERO",byeValue);ok=false;}
 const expectedSeason=Object.values(r.expected).reduce((a,b)=>a+b,0);
 if(typeof p.season_yahoo_fantasy_points!=="number"||Math.abs(p.season_yahoo_fantasy_points-expectedSeason)>0.011){console.error("SEASON_TOTAL_MISMATCH",r.name);ok=false;}
 console.log(JSON.stringify({player:r.name,id:r.id,weeks:results,bye_week:r.bye,bye_value:byeValue,season_field:p.season_yahoo_fantasy_points,snapshot_completed_through:data.completed_through_week}));
}
if(!ok)throw Error("Yahoo snapshot mismatch with actual game log screenshots: do not trust downstream rankings until fixed");
console.log("REFERENCE_GAME_LOG_CHECK_PASSED");
