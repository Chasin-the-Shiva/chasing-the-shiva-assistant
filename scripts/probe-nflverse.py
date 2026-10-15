import csv, json, urllib.request, datetime, io
from pathlib import Path
url="https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_2026.csv"
request=urllib.request.Request(url,headers={"User-Agent":"ShivaGPT-readonly-validation/1.0"})
with urllib.request.urlopen(request,timeout=90) as response:
    content=response.read(35_000_000)
    modified=response.headers.get("Last-Modified")
text=content.decode("utf-8-sig")
reader=csv.DictReader(io.StringIO(text))
columns=reader.fieldnames or []
needed=["season","week","player_id","player_name"]
missing=[c for c in needed if c not in columns]
if missing: raise ValueError("Missing required weekly NFL columns: "+str(missing))
weeks=set(); rows=0; identities=set(); examples=[]
for row in reader:
    if row.get("season")!="2026": continue
    rows+=1
    week=int(row["week"]);weeks.add(week)
    if row["player_id"]:identities.add(row["player_id"])
    if len(examples)<3:examples.append({"week":week,"player":row["player_name"],"team":row.get("team")})
if rows<500 or len(identities)<150 or max(weeks)<3:
    raise ValueError(f"Incomplete 2026 NFL stats: rows={rows} players={len(identities)} weeks={sorted(weeks)}")
fields=[x for x in columns if any(k in x.lower() for k in ["target","reception","carry","attempt","rush","air_yard","first_down","red_zone","route","snap"])]
report={"schema":"shivagpt-nfl-source-probe-v1","read_only":True,"retrieved_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"source_url":url,"last_modified":modified,"season":2026,"rows":rows,"unique_player_ids":len(identities),"weeks":sorted(weeks),"opportunity_fields":fields,"join_status":"YAHOO_PLAYER_ID_CROSSWALK_REQUIRED","note":"NFL player stats are external evidence, not replacements for Yahoo league-scored fantasy points."}
Path("reports").mkdir(exist_ok=True)
Path("reports/shivagpt-nfl-source-probe.json").write_text(json.dumps(report,indent=2))
print(json.dumps({k:report[k] for k in ["rows","unique_player_ids","weeks","opportunity_fields","join_status"]}))
