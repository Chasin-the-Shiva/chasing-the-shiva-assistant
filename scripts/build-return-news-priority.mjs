import fs from "node:fs/promises";
const read=async p=>JSON.parse(await fs.readFile(p,"utf8"));
const [injury,news,avail]=await Promise.all([
 read("reports/shivagpt-injury-radar.json"),
 read("reports/shivagpt-nfl-news-headlines.json"),
 read("public/shivagpt-available.json")]);
const check=(x,m)=>{if(!x)throw Error(m)};
check(injury.schema==="shivagpt-injury-radar-v1"&&news.schema==="shivagpt-nfl-news-headlines-v1"&&String(injury.league_id)==="721343"&&avail.read_only&&String(avail.league_id)==="721343","Invalid sources");
const old=(Date.now()-Date.parse(news.generated_at))/3600000;
check(Number.isFinite(old)&&old<=6&&old>=-.2,"News feed stale");
const availability=new Map(avail.available_players.map(p=>[String(p.player_id),p.availability_status]));
const byId=new Map();
for(const item of news.matched_articles||[])for(const match of item.matches||[]){
  const id=String(match.player_id);
  if(!byId.has(id))byId.set(id,[]);
  byId.get(id).push({published_at:item.published_at,headline:item.title,source:item.publisher,url:item.url});
}
const triggers=/(return|practice window|activated|designated to return|cleared|injury update|expected back|out for season|season.end)/i;
const candidates=new Map();
for(const p of injury.active_injury_watch||[])candidates.set(String(p.player_id),{...p,designation:p.injury_status,kind:"INJURY"});
for(const p of injury.early_return_research_queue||[])candidates.set(String(p.player_id),{...p,designation:p.designation,kind:"RESERVE"});
const queue=[...candidates.values()].map(p=>{
 const articles=(byId.get(String(p.player_id))||[]).filter(a=>triggers.test(a.headline));
 const kind=articles.some(a=>/out for season|season.end/i.test(a.headline))?"POSSIBLY_SEASON_ENDING_NEEDS_CONFIRMATION":
    articles.length?"RETURN_NEWS_RESEARCH":p.kind==="RESERVE"?"IR_PUP_ELIGIBILITY_RESEARCH":"ACTIVE_INJURY_RESEARCH";
 const status=availability.get(String(p.player_id))||p.availability_status;
 return {player_id:String(p.player_id),name:p.name,position:p.position,injury_status:p.designation,injury_category:p.kind,
  availability_status:status,priority:kind==="RETURN_NEWS_RESEARCH"&&status==="FA"?"HIGH":
    kind==="RETURN_NEWS_RESEARCH"?"MEDIUM":"LOW",
  news_signal:kind,related_articles:articles.slice(0,4),
  expected_return_date:null,confirmed_eligibility:null,research_verified:false,add_recommendation:false};
}).sort((a,b)=>({HIGH:0,MEDIUM:1,LOW:2}[a.priority]-{HIGH:0,MEDIUM:1,LOW:2}[b.priority]));
const result={schema:"shivagpt-return-news-priority-v1",read_only:true,generated_at:new Date().toISOString(),
 source_timestamps:{injury:injury.generated_at,news:news.generated_at,availability:avail.retrieved_at},
 total_candidates:queue.length,reserve_candidates:queue.filter(p=>p.injury_category==="RESERVE").length,return_news_candidates:queue.filter(p=>p.news_signal==="RETURN_NEWS_RESEARCH").length,
 queue,limitations:["Headline classification is not proof of health, return eligibility or activation.",
 "Verify linked NFL reporting and team transactions before predicting return timing.",
 "Any free-agent pickup requires exact Yahoo status, roster/drop and fantasy-scoring verification."]};
await fs.mkdir("reports",{recursive:true});
await fs.writeFile("reports/shivagpt-return-news-priority.json",JSON.stringify(result));
console.log(JSON.stringify({candidates:queue.length,return_news:result.return_news_candidates,high_priority:queue.filter(p=>p.priority==="HIGH").length}));
