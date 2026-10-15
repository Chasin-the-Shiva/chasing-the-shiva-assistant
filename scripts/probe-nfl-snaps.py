import csv,io,json,urllib.request,datetime
from pathlib import Path
url="https://github.com/nflverse/nflverse-data/releases/download/snap_counts/snap_counts_2026.csv"
req=urllib.request.Request(url,headers={"User-Agent":"ShivaGPT-readonly-nfl-probe/1.0"})
with urllib.request.urlopen(req,timeout=90) as resp:
 content=resp.read(16000000)
 last_modified=resp.headers.get("Last-Modified")
rows=list(csv.DictReader(io.StringIO(content.decode("utf-8-sig"))))
if len(rows)<500:raise RuntimeError("Snap data unexpectedly small")
fields=list(rows[0])
seasonkey=next((x for x in ["season","year"] if x in fields),None)
weekkey=next((x for x in ["week","game_week"] if x in fields),None)
if not weekkey:raise RuntimeError("No week field")
weeks=set()
for row in rows:
 try:
  if seasonkey and row[seasonkey] not in ("2026",""):continue
  weeks.add(int(row[weekkey]))
 except (ValueError,TypeError):pass
if not weeks or max(weeks)<3:raise RuntimeError("No current NFL weekly snaps")
out={"schema":"shivagpt-nfl-snaps-probe-v1","read_only":True,"generated_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"source_url":url,"last_modified":last_modified,"rows":len(rows),"weeks":sorted(weeks),"columns":fields,"example_identifiers":{k:rows[0][k] for k in fields if "id" in k.lower()},"integration_status":"PROBE_ONLY"}
Path("reports").mkdir(exist_ok=True)
Path("reports/shivagpt-nfl-snaps-probe.json").write_text(json.dumps(out,indent=2))
print(json.dumps({"rows":len(rows),"weeks":sorted(weeks),"columns":fields,"identifiers":out["example_identifiers"]}))
