import fs from "node:fs/promises";
const live=JSON.parse(await fs.readFile("public/shivagpt-live.json","utf8"));
const available=JSON.parse(await fs.readFile("public/shivagpt-available.json","utf8"));
function valid(d){return d?.schema==="shivagpt-season-manager-v1"&&d?.read_only===true&&String(d.league_id)==="721343"&&Number.isFinite(Date.parse(d.retrieved_at));}
if(!valid(live)||!valid(available))throw Error("Invalid league snapshots; do not recover from untrusted contents");
const ages=[live,available].map(d=>(Date.now()-Date.parse(d.retrieved_at))/60000);
const stale=ages.some(x=>x>120||x< -5);
const isSchedule=process.env.GITHUB_EVENT_NAME==="schedule";
let result="fresh";
if(stale){
  result="stale";
  if(isSchedule){
    const token=process.env.GITHUB_TOKEN;
    const repo=process.env.GITHUB_REPOSITORY;
    if(!token||!repo)throw Error("Recovery dispatch credentials missing");
    const response=await fetch(`https://api.github.com/repos/${repo}/actions/workflows/refresh-yahoo-snapshot.yml/dispatches`,{
      method:"POST",
      headers:{Authorization:`Bearer ${token}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","User-Agent":"ShivaGPT-health-watch"},
      body:JSON.stringify({ref:"main",inputs:{rebuild_history:"false"}})
    });
    if(response.status!==204)throw Error(`Recovery dispatch failed HTTP ${response.status}`);
    result="recovery_dispatched";
  }
}
console.log(JSON.stringify({schema:"shivagpt-refresh-health-v1",checked_at:new Date().toISOString(),
 snapshot_age_minutes:ages.map(x=>Math.round(x)),status:result,automatic_dispatch:isSchedule&&stale,
 note:"Recovery requested does not prove successful completion; verify next published retrieved_at."}));
