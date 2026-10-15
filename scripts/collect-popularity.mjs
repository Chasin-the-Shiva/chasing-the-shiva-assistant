import fs from "node:fs/promises";
const root="https://shivagpt-yahoo-api.redmoosejoe.chatgpt.site/season-manager-popularity";
const scopes=["rostered","FA","W"];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function ensure(ok,msg){if(!ok)throw new Error(msg)}
const players=[], ids=new Set(), summary={};
let week=null, firstTime=null;
for(const scope of scopes){
 let start=0,pages=0;
 while(true){
  ensure(++pages<=100,"Pagination limit exceeded: "+scope);
  const url=new URL(root);
  for(const [k,v] of Object.entries({scope,start,count:25}))url.searchParams.set(k,String(v));
  let response;
  for(let n=0;n<5;n++){
   try{response=await fetch(url,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(90000)});
    if(response.ok)break;
    if(![429,500,502,503,504].includes(response.status))throw Error("Nonretryable HTTP "+response.status);
    if(n===4)throw Error("HTTP "+response.status+" after retries for "+scope+"/"+start);
   }catch(e){if(n===4||String(e).includes("Nonretryable"))throw e}
   console.warn("Retrying "+scope+" page "+start+" after transient failure");
   await sleep([3000,8000,18000,30000][n]);
  }
  ensure(response?.ok,"No valid response");
  const d=await response.json();
  ensure(d.schema==="shivagpt-popularity-source-v1"&&d.read_only===true&&!d.error,"Bad schema or error");
  ensure(String(d.league_id)==="721343"&&Array.isArray(d.players),"Wrong league or player list");
  ensure(d.pagination?.start===start&&d.pagination?.count===25,"Invalid pagination offset/count");
  ensure(d.players.length===d.pagination.returned&&d.players.length<=25,"Invalid returned count");
  const stamp=Date.parse(d.retrieved_at);
  ensure(Number.isFinite(stamp)&&Math.abs(Date.now()-stamp)<30*60*1000,"Stale timestamp");
  if(!firstTime)firstTime=d.retrieved_at;
  const sourceWeek=d.players.find(p=>p.percent_owned_delta_period?.week)?.percent_owned_delta_period?.week;
  if(sourceWeek!=null){if(week===null)week=sourceWeek;else ensure(week===sourceWeek,"Week changed during crawl")}
  for(const p of d.players){
   const id=String(p.player_id);
   ensure(/^\d+$/.test(id)&&!ids.has(id),"Invalid or duplicate player ID: "+id);
   ids.add(id);
   const own=typeof p.percent_owned==="number"?p.percent_owned:null;
   const delta=typeof p.percent_owned_delta==="number"?p.percent_owned_delta:null;
   ensure(own===null||(Number.isFinite(own)&&own>=0&&own<=100),"Invalid ownership percent");
   ensure(delta===null||Number.isFinite(delta),"Invalid delta");
   players.push({player_id:id,name:p.name??null,position:p.position??null,nfl_team:p.nfl_team??null,
    availability_status:p.availability_status??null,percent_owned:own,percent_owned_delta:delta,
    percent_owned_delta_period:p.percent_owned_delta_period??null,
    adds_24h:null,drops_24h:null,yahoo_trend_rank:null});
  }
  if(!d.pagination.has_more){
   ensure(d.pagination.complete_for_scope===true&&d.pagination.next_start==null,"Incomplete final page");
   break;
  }
  ensure(Number.isInteger(d.pagination.next_start)&&d.pagination.next_start>start,"Pagination did not advance");
  start=d.pagination.next_start;
  await sleep(350);
 }
 summary[scope]={complete_for_scope:true,pages,count:players.filter(p=>scope==="rostered"?p.availability_status==="rostered":p.availability_status===scope).length};
 console.log(scope+" completed: "+summary[scope].count);
}
ensure(summary.rostered.count>=190&&players.length>400,"Unexpectedly small pool");
const out={schema:"shivagpt-popularity-source-v1",read_only:true,league_id:"721343",
 retrieved_at:firstTime,collected_at:new Date().toISOString(),
 source_availability:{percent_owned:"verified",percent_owned_delta:"verified_weekly",adds_24h:"not_provided",drops_24h:"not_provided"},
 collection:{complete:true,scopes:summary,total_players:players.length},
 players};
await fs.mkdir("public",{recursive:true});
await fs.writeFile("public/shivagpt-popularity-source.json",JSON.stringify(out));
console.log(JSON.stringify({total:players.length,week,scopes:summary}));
