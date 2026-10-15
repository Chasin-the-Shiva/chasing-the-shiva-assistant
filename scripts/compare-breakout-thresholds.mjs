import fs from "node:fs/promises";
const [nfl,snaps]=await Promise.all(["public/shivagpt-nfl-opportunity.json","public/shivagpt-nfl-snaps.json"].map(p=>fs.readFile(p,"utf8").then(JSON.parse)));
if(nfl.schema!=="shivagpt-nfl-opportunity-v1"||snaps.schema!=="shivagpt-nfl-snaps-v1")throw Error("Invalid NFL records");
const roles=new Map(),snapIndex=new Map();
for(const r of nfl.players){const id=String(r.yahoo_player_id);if(!roles.has(id))roles.set(id,new Map());roles.get(id).set(r.week,r.metrics)}
for(const r of snaps.rows)snapIndex.set(String(r.yahoo_player_id)+":"+r.week,r.offense_pct);
const tests=[];
for(const week of [3,4]){
 for(const [id,series] of roles){
  const prev=series.get(week-1),cur=series.get(week),next=series.get(week+1);
  if(!prev||!cur||!next)continue;
  const volume=x=>Number(x.carries||0)+Number(x.targets||0);
  const prior=volume(prev),now=volume(cur),future=volume(next);
  const snap=snapIndex.get(id+":"+week),snapBefore=snapIndex.get(id+":"+(week-1));
  const observed=snap!=null&&snapBefore!=null;
  const criteria={
   raw:now>=6&&now-prior>=4,
   meaningful:now>=8&&now-prior>=4,
   sustained:now>=8&&prior>=5&&now-prior>=2,
   snaps_and_volume:observed&&now>=8&&now-prior>=4&&snap>=.35&&snap-snapBefore>=.08,
   meaningful_snaps:observed&&now>=10&&snap>=.5&&snap-snapBefore>=.1
  };
  const outcome=future>=10&&future>=now*.8;
  tests.push({id,week,prior,now,future,outcome,criteria});
 }
}
const metrics={};
for(const name of Object.keys(tests[0]?.criteria||{})){const positives=tests.filter(x=>x.criteria[name]);const hits=positives.filter(x=>x.outcome);const actual=tests.filter(x=>x.outcome);metrics[name]={signals:positives.length,hits:hits.length,precision:positives.length?Number((hits.length/positives.length).toFixed(3)):null,recall:actual.length?Number((hits.length/actual.length).toFixed(3)):null};}
const out={schema:"shivagpt-breakout-threshold-comparison-v1",generated_at:new Date().toISOString(),read_only:true,league_id:"721343",weeks:[3,4],evaluated_player_weeks:tests.length,success_definition:"Next week's carries plus targets >=10 and at least 80% of signal week's volume",variants:metrics,interpretation:"Exploratory in-sample threshold comparison. Selection of a winner here would overfit; retain prospective forecasting for validation.",no_yahoo_availability_reconstruction:true};
await fs.mkdir("reports",{recursive:true});await fs.writeFile("reports/shivagpt-breakout-threshold-comparison.json",JSON.stringify(out,null,2)+"\n");
console.log(JSON.stringify({tested:tests.length,variants:metrics}));
