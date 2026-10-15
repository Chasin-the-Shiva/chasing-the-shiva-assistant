import csv,io,json,urllib.request,datetime
from pathlib import Path
SNAPS="https://github.com/nflverse/nflverse-data/releases/download/snap_counts/snap_counts_2026.csv"
IDS="https://raw.githubusercontent.com/dynastyprocess/data/master/files/db_playerids.csv"
def load(url,limit):
 req=urllib.request.Request(url,headers={"User-Agent":"ShivaGPT-readonly-snap-join/1.0"})
 with urllib.request.urlopen(req,timeout=90) as response:
  body=response.read(limit+1)
 if len(body)>limit:raise RuntimeError("Source size exceeds limit")
 return list(csv.DictReader(io.StringIO(body.decode("utf-8-sig"))))
snaps=load(SNAPS,16000000)
cross=load(IDS,12000000)
if not {"yahoo_id","pfr_id"}.issubset(cross[0]):raise RuntimeError("Required player IDs absent")
mapping={};ambiguous=set()
for r in cross:
 y=(r.get("yahoo_id") or "").strip();p=(r.get("pfr_id") or "").strip()
 if not y.isdecimal() or not p:continue
 if y in mapping and mapping[y]!=p:ambiguous.add(y)
 mapping[y]=p
for x in ambiguous:mapping.pop(x,None)
pool=json.loads(Path("public/shivagpt-player-stats.json").read_text())
if pool.get("schema")!="shivagpt-player-stats-snapshot-v1" or not pool.get("collection",{}).get("complete"):raise RuntimeError("Yahoo roster source invalid")
ids={str(x["player_id"]) for x in pool["players"]}
by_pfr={}
for x in snaps:
 if x.get("season")!="2026":continue
 p=x.get("pfr_player_id")
 if p:by_pfr.setdefault(p,[]).append(x)
out=[];matches=set()
for y in ids:
 p=mapping.get(y)
 if not p or p not in by_pfr:continue
 matches.add(y)
 for r in by_pfr[p]:
  try:
   w=int(r["week"]);off=int(r["offense_snaps"]);pct=float(r["offense_pct"])
   if pct>1:pct=pct/100
   if not 0<=pct<=1:raise ValueError()
  except (ValueError,TypeError):continue
  out.append({"yahoo_player_id":y,"pfr_player_id":p,"week":w,"team":r.get("team"),"offense_snaps":off,"offense_pct":pct})
if len(matches)<150:raise RuntimeError("Too few reliable NFL snap/Yahoo matches: "+str(len(matches)))
result={"schema":"shivagpt-nfl-snaps-v1","read_only":True,"league_id":"721343","season":2026,"generated_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"source_urls":{"snaps":SNAPS,"crosswalk":IDS},"full_yahoo_pool":len(ids),"matched_yahoo_players":len(matches),"rows":out,"weeks":sorted({r["week"] for r in out}),"limitations":["Player IDs matched via Yahoo-to-PFR crosswalk; ambiguous IDs excluded","NFL snap data is independent from Yahoo fantasy-scoring points","Player route counts are not available from this source"]}
Path("public/shivagpt-nfl-snaps.json").write_text(json.dumps(result,separators=(",",":")))
print(json.dumps({"matched":len(matches),"rows":len(out),"weeks":result["weeks"]}))
