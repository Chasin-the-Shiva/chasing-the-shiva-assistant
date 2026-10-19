import fs from "node:fs/promises";
const now=Date.now();
const specs=[
 ["live","public/shivagpt-live.json",3,"retrieved_at"],
 ["availability","public/shivagpt-available.json",3,"retrieved_at"],
 ["scoring","public/shivagpt-scoring.json",48,"retrieved_at"],
 ["player_stats","public/shivagpt-player-stats.json",168,"generated_at"],
 ["nfl_opportunity","public/shivagpt-nfl-opportunity.json",36,"generated_at"],
 ["nfl_snaps","public/shivagpt-nfl-snaps.json",36,"generated_at"],
 ["popularity","reports/shivagpt-popularity-radar.json",4,"source_retrieved_at"],
 ["injury","reports/shivagpt-injury-radar.json",4,"source_retrieved_at"],
 ["nfl_headlines","reports/shivagpt-nfl-news-headlines.json",4,"generated_at"]
];
const sources={};
for(const [key,path,maxAge,field] of specs){
 try{
  const d=JSON.parse(await fs.readFile(path,"utf8"));
  const timestamp=d[field]|| (key==="scoring"?d.generated_at:null);
  const age=(now-Date.parse(timestamp))/3600000;
  const leagueOk=key==="nfl_headlines" ? d.schema==="shivagpt-nfl-news-headlines-v1" : String(d.league_id)==="721343";
  const valid=d.read_only===true&&leagueOk&&Number.isFinite(age);
  sources[key]={status:!valid?"INVALID":age>maxAge?"STALE":age<-.2?"FUTURE":"FRESH",age_hours:Number(age.toFixed(2)),timestamp};
  // The Yahoo collector can report a fresh timestamp while silently truncating
  // waiver players. Preserve the injury monitor's roughly 1,100-player coverage
  // expectation (about 200 rostered plus at least 900 available).
  if(key==="availability"){
    const players=Array.isArray(d.available_players)?d.available_players:[];
    const ids=new Set(players.map(p=>String(p?.player_id||"")).filter(Boolean));
    sources[key].player_count=players.length;
    sources[key].unique_player_count=ids.size;
    if(sources[key].status==="FRESH" && (ids.size<900||ids.size!==players.length)){
      sources[key].status="INCOMPLETE";
      sources[key].reason="Yahoo availability does not contain at least 900 distinct players; possibly truncated pagination";
    }
  }
 }catch(e){sources[key]={status:"MISSING_OR_UNREADABLE"}}
}
const blocking=["live","availability","player_stats"].filter(k=>sources[k].status!=="FRESH");
const out={schema:"shivagpt-pipeline-preflight-v1",read_only:true,checked_at:new Date().toISOString(),
 league_id:"721343",sources,blocking_sources:blocking,
 ready_for_scouting:blocking.length===0,
 evidence_ready_for_recommendations:blocking.length===0&&["nfl_opportunity","nfl_snaps","injury","nfl_headlines"].every(k=>sources[k].status==="FRESH"),
 note:"Diagnostic only. Green preflight execution does not mean the main report has published or that NFL role research is complete."};
await fs.mkdir("reports",{recursive:true});
await fs.writeFile("reports/shivagpt-pipeline-preflight.json",JSON.stringify(out,null,2)+"\n");
console.log(JSON.stringify({scouting_ready:out.ready_for_scouting,recommendation_evidence_ready:out.evidence_ready_for_recommendations,blocking,states:Object.fromEntries(Object.entries(sources).map(([k,v])=>[k,v.status]))}));
