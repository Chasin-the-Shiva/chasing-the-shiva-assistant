import json,urllib.request,datetime,xml.etree.ElementTree as ET,email.utils,re
from pathlib import Path
feeds=[
 ("CBS NFL","https://www.cbssports.com/rss/headlines/nfl/"),
 ("ESPN NFL","https://www.espn.com/espn/rss/nfl/news")
]
def read(p):return json.loads(Path(p).read_text())
monitor=read("reports/shivagpt-monitoring-400.json")
injury=read("reports/shivagpt-injury-radar.json")
if monitor.get("schema")!="shivagpt-monitoring-400-v1" or injury.get("schema")!="shivagpt-injury-radar-v1":raise ValueError("Missing research priorities")
names={p.get("name","").lower():str(p["player_id"]) for p in monitor.get("monitored",[]) if p.get("name")}
names.update({p.get("name","").lower():str(p["player_id"]) for p in injury.get("early_return_research_queue",[]) if p.get("name")})
items=[];sources=[];cutoff=datetime.datetime.now(datetime.timezone.utc)-datetime.timedelta(days=4)
for publisher,url in feeds:
 try:
  req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 ShivaGPT read-only RSS/1.0","Accept":"application/rss+xml,application/xml,text/xml,*/*"})
  with urllib.request.urlopen(req,timeout=24) as response:
   payload=response.read(2500000)
  root=ET.fromstring(payload)
  hits=0
  for node in root.findall(".//item")[:125]:
   title=" ".join((node.findtext("title") or "").split())[:240]
   link=(node.findtext("link") or "").strip()
   date=node.findtext("pubDate") or ""
   if not title or not link.startswith("https://"):continue
   try:published=email.utils.parsedate_to_datetime(date).astimezone(datetime.timezone.utc)
   except Exception:continue
   if published<cutoff:continue
   recognized=[]
   norm=title.lower()
   for name,id in names.items():
    if len(name)>5 and re.search(r"(?<![a-z])"+re.escape(name)+r"(?![a-z])",norm):recognized.append({"player_id":id,"name":name})
   if not recognized:continue
   items.append({"publisher":publisher,"title":title,"url":link,"published_at":published.isoformat(),"matches":recognized[:10],"status":"HEADLINE_RESEARCH_ONLY"})
   hits+=1
  sources.append({"name":publisher,"status":"retrieved","matched_headlines":hits})
 except Exception as exc:
  sources.append({"name":publisher,"status":"unavailable","error_type":type(exc).__name__})
if not any(x["status"]=="retrieved" for x in sources):raise RuntimeError("No verifiable NFL news feed accessible")
out={"schema":"shivagpt-nfl-news-headlines-v1","read_only":True,"generated_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"lookback_days":4,"sources":sources,"matched_articles":items,"limitations":["RSS headlines only, not verified detailed article content","Full-name matching may miss relevant unnamed-player or surname-only reports","Return dates, recovery forecasts and depth-chart claims require reading and confirming the actual linked article","No automatic Yahoo transaction or acquisition recommendations"]}
Path("reports").mkdir(exist_ok=True)
Path("reports/shivagpt-nfl-news-headlines.json").write_text(json.dumps(out,separators=(",",":")))
print(json.dumps({"sources":sources,"matched_articles":len(items),"player_names_considered":len(names)}))
