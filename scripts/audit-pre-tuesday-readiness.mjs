import fs from "node:fs/promises";
const json=async p=>JSON.parse(await fs.readFile(p,"utf8"));
const checks=[
 ["Yahoo league","public/shivagpt-live.json","shivagpt-season-manager-v1"],
 ["Availability","public/shivagpt-available.json","shivagpt-season-manager-v1"],
 ["Monitoring","reports/shivagpt-monitoring-400.json","shivagpt-monitoring-400-v1"],
 ["Waiver queue","reports/shivagpt-waiver-decision-queue.json","shivagpt-waiver-decision-queue-v1"],
 ["Executive decision","reports/shivagpt-weekly-executive-decisions.json","shivagpt-weekly-executive-decisions-v1"],
 ["Wednesday contingencies","reports/shivagpt-wednesday-fa.json","shivagpt-wednesday-fa-contingencies-v1"],
 ["Prospective tracker","reports/prospective/shivagpt-week-05-signals.json","shivagpt-prospective-signal-log-v1"],
 ["Lineup safety","reports/shivagpt-lineup-safety.json","shivagpt-live-lineup-check-v1"],
 ["Lineup alternatives","reports/shivagpt-legal-lineup-options.json","shivagpt-legal-lineup-options-v1"],
 ["Keeper research","reports/shivagpt-trade-keeper-research.json","shivagpt-trade-keeper-research-v1"],
 ["Breakout backtest","reports/shivagpt-breakout-threshold-comparison.json","shivagpt-breakout-threshold-comparison-v1"],
 ["Trade research","reports/shivagpt-trade-keeper-research.json","shivagpt-trade-keeper-research-v1"],
 ["Keeper scoring","reports/shivagpt-keeper-production-screen.json","shivagpt-keeper-production-screen-v1"],
 ["Prospective lineup options","reports/shivagpt-legal-lineup-options.json","shivagpt-legal-lineup-options-v1"],
];
const report=[];
for(const [name,path,schema] of checks){
 try{const d=await json(path);report.push({name,status:d.schema===schema&&d.read_only===true?"PASS":"FAIL",timestamp:d.retrieved_at||d.generated_at||d.recorded_at||null});}
 catch(e){report.push({name,status:"MISSING",error:e.code||"PARSE"})}
}
const workflows=[
 [".github/workflows/refresh-yahoo-snapshot.yml","17 * * * *"],
 [".github/workflows/shivagpt-tuesday-brief.yml","0 7 * * 2"],
 [".github/workflows/shivagpt-wednesday-fa.yml","30 7 * * 3"],
 [".github/workflows/shivagpt-yahoo-freshness-watch.yml","47 * * * *"],
 [".github/workflows/shivagpt-executive-waiver-decision.yml","42 7 * * 2"],
 [".github/workflows/shivagpt-prospective-breakout.yml","49 7 * * 2"],
];
for(const [path,cron] of workflows){
 const c=await fs.readFile(path,"utf8");report.push({name:path.split("/").at(-1),status:c.includes('cron: "'+cron+'"')?"PASS":"FAIL"});
}
const failures=report.filter(x=>x.status!=="PASS");
const result={schema:"shivagpt-pre-tuesday-readiness-v1",read_only:true,generated_at:new Date().toISOString(),league_id:"721343",
 checks:report,pass_count:report.length-failures.length,fail_count:failures.length,
 status:failures.length?"BLOCKED":"CONFIGURATION_PASS_SCHEDULED_RUNTIME_PENDING",
 limitations:["Report presence and workflow syntax do not prove future cron delivery.",
 "Roster/availability freshness must be checked again Tuesday morning.",
 "No automated ChatGPT message delivery or Yahoo roster transactions are provided by this audit.",
 "Trade/keeper research list does not constitute reliable player valuation.",
 "Breakout thresholds were compared in-sample, not proven prospectively."]};
await fs.mkdir("reports",{recursive:true});await fs.writeFile("reports/shivagpt-pre-tuesday-readiness.json",JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify({status:result.status,passed:result.pass_count,failed:result.fail_count,failed_items:failures}));
if(failures.length)process.exit(1);
