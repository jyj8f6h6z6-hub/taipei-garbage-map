import json
import urllib.request

API_URL = "https://data.taipei/api/v1/dataset/a6e90031-7ec4-4089-afb5-361a4efe7202?scope=resourceAquire&limit=5000"


def to_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


with urllib.request.urlopen(API_URL) as response:
    data = json.loads(response.read().decode("utf-8"))

records = data.get("result", {}).get("results", [])

print(f"Downloaded records: {len(records)}")

if records:
    print("Available fields:")
    print(list(records[0].keys()))

stations = []

for item in records:
    lat = to_float(item.get("緯度"))
    lng = to_float(item.get("經度"))

    if lat is None or lng is None:
        continue

    stations.append({
        "name": item.get("地點", ""),
        "address": item.get("地點", ""),
        "district": item.get("行政區", ""),
        "village": item.get("里別", ""),
        "route": item.get("路線", ""),
        "truck": item.get("車號", ""),
        "time": item.get("抵達時間", ""),
        "leaveTime": item.get("離開時間", ""),
        "lat": lat,
        "lng": lng
    })

with open("garbage.json", "w", encoding="utf-8") as f:
    json.dump(stations, f, ensure_ascii=False, indent=2)

print(f"Updated garbage.json with {len(stations)} valid stations.")