import csv,io,json,urllib.request,datetime
from pathlib import Path

STATS="https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_2026.csv"
IDS="https://raw.githubusercontent.com/dynastyprocess/data/master/files/db_playerids.csv"
def fetch(url,limit):
 req=urllib.request.Request(url,headers={"User-Agent":"ShivaGPT-readonly/1.0"})
 with urllib.request.urlopen(req,timeout=100) as r:
  body=r.read(limit+1)
 if len(body)>limit:raise ValueError("Source exceeds safe size")
 return list(csv.DictReader(io.StringIO(body.decode("utf-8-sig"))))
stats=fetch(STATS,35000000)
cross=fetch(IDS,12000000)
required={"yahoo_id","gsis_id"}
if not required.issubset(cross[0]):raise ValueError("Crosswalk fields missing")
yahoo={}
ambiguous=set()
for p in cross:
 y=str(p.get("yahoo_id") or "").strip()
 g=str(p.get("gsis_id") or "").strip()
 if not y.isdecimal() or not g:continue
 if y in yahoo and yahoo[y]!=g:ambiguous.add(y)
 yahoo[y]=g
for y in ambiguous:yahoo.pop(y,None)
bygsis={}
for row in stats:
 if row.get("season")!="2026":continue
 key=row.get("player_id")
 if key:bygsis.setdefault(key,[]).append(row)
snapshot=json.loads(Path("public/shivagpt-available.json").read_text())
if not snapshot.get("read_only") or str(snapshot.get("league_id"))!="721343":raise ValueError("Invalid Yahoo availability")
yids={str(p["player_id"]) for p in snapshot["available_players"]}
matches={y:yahoo[y] for y in yids if y in yahoo and yahoo[y] in bygsis}
if len(matches)<120:raise ValueError("Insufficient verifiable Yahoo-to-NFL matching: "+str(len(matches)))
fields=["attempts","completions","passing_yards","carries","rushing_yards","rushing_first_downs","receptions","targets","receiving_yards","receiving_air_yards","receiving_first_downs","target_share","air_yards_share"]
known=[f for f in fields if f in stats[0]]
out=[]
for y,g in matches.items():
 for row in bygsis[g]:
  week=int(row["week"])
  metrics={}
  for field in known:
   raw=row.get(field)
   if raw in ("",None):metrics[field]=None
   else:
    try:metrics[field]=float(raw)
    except (ValueError,TypeError):metrics[field]=None
  out.append({"yahoo_player_id":y,"nflverse_player_id":g,"week":week,"nfl_team":row.get("team"),"metrics":metrics})
result={"schema":"shivagpt-nfl-opportunity-v1","read_only":True,"generated_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"sources":{"weekly_stats":STATS,"crosswalk":IDS},"season":2026,"league_id":"721343","matched_available_players":len(matches),"available_pool":len(yids),"matched_player_weeks":len(out),"weeks":sorted({r["week"] for r in out}),"verified_fields":known,"players":out,"limitations":["Only unambiguous Yahoo ID to GSIS ID matches accepted","No route or snap stats in this source","Missing numbers are null, not zero","Yahoo fantasy scoring remains authoritative"]}
Path("public/shivagpt-nfl-opportunity.json").write_text(json.dumps(result,separators=(",",":")))
print(json.dumps({k:result[k] for k in ["matched_available_players","available_pool","matched_player_weeks","weeks","verified_fields"]}))
