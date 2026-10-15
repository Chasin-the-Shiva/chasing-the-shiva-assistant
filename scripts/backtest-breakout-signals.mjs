import fs from "node:fs/promises";
const read=async p=>JSON.parse(await fs.readFile(p,"utf8"));
const nfl=await read("public/shivagpt-nfl-opportunity.json");
if(nfl.schema!=="shivagpt-nfl-opportunity-v1"||String(nfl.league_id)!=="721343")throw Error("Missing verified NFL evidence");
const groups=new Map();
for(const r of nfl.players){
 const id=String(r.yahoo_player_id);
 if(!groups.has(id))groups.set(id,[]);
 groups.get(id).push(r);
}
const touch=r=>Number(r.metrics.carries||0)+Number(r.metrics.targets||0);
let observed=0,earlyHit=0,earlyFalse=0,late=0,missed=0;
const cases=[];
for(const [id,records] of groups){
 const byWeek=new Map(records.map(x=>[x.week,x]));
 // Historical Week 3 -> Week 4 -> Week 5 transitions. Absolutely no Yahoo availability inference.
 for(const week of [3,4]){
  const p=byWeek.get(week-1),current=byWeek.get(week),next=byWeek.get(week+1);
  if(!p||!current||!next)continue;
  const prior=touch(p),now=touch(current),after=touch(next);
  const earlySignal=now>=6 && now-prior>=4;
  const futureExpansion=after>=10 && after>=now+3;
  if(earlySignal){observed++;if(futureExpansion)earlyHit++;else earlyFalse++}
  if(futureExpansion&&!earlySignal)missed++;
  if(!earlySignal&&after>=10&&now>=6)late++;
  if(earlySignal||futureExpansion)cases.push({player_id:id,signal_week:week,
    previous_touches:prior,signal_touches:now,next_week_touches:after,
    signaled_early:earlySignal,next_week_expanded:futureExpansion});
 }
}
const out={schema:"shivagpt-historical-opportunity-backtest-v1",read_only:true,
 generated_at:new Date().toISOString(),league_id:"721343",weeks_tested:[3,4],
 definition:"An early signal has >=6 current rushing attempts plus targets and an increase of >=4 over previous week. A follow-on expansion has >=10 next-week attempts plus targets and >=3 greater than signal week.",
 early_signals:observed,signals_confirmed_next_week:earlyHit,signals_not_confirmed_next_week:earlyFalse,
 next_week_expansions_without_signal:missed,unflagged_existing_opportunities:late,
 precision_on_definition:observed?Number((earlyHit/observed).toFixed(3)):null,
 research_examples:cases.slice(0,40),
 warnings:["This is a proof-of-pipeline backtest, not validated predictive performance or Yahoo scoring return.",
 "No historical FA/W ownership status, competing waivers, injuries, or keeper eligibility was reconstructed.",
 "Single NFL role metric alone cannot establish future trade value or a justified FAAB bid.",
 "Only players with complete records for three consecutive weeks are evaluated."]};
await fs.mkdir("reports",{recursive:true});
await fs.writeFile("reports/shivagpt-historical-breakout-test.json",JSON.stringify(out,null,2)+"\n");
console.log(JSON.stringify({signals:observed,confirmed:earlyHit,falseAlerts:earlyFalse,missed,precision:out.precision_on_definition}));
