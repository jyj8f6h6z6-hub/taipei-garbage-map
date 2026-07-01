import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone

DATASET_ID = "a6e90031-7ec4-4089-afb5-361a4efe7202"
BASE_URL = f"https://data.taipei/api/v1/dataset/{DATASET_ID}"

PAGE_LIMIT = 1000


def to_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def fetch_page(offset):
    params = {
        "scope": "resourceAquire",
        "limit": PAGE_LIMIT,
        "offset": offset,
    }

    url = BASE_URL + "?" + urllib.parse.urlencode(params)

    with urllib.request.urlopen(url) as response:
        data = json.loads(response.read().decode("utf-8"))

    return data.get("result", {}).get("results", [])


all_records = []
offset = 0

while True:
    records = fetch_page(offset)

    print(f"Offset {offset}: downloaded {len(records)} records")

    if not records:
        break

    all_records.extend(records)

    if len(records) < PAGE_LIMIT:
        break

    offset += PAGE_LIMIT


print(f"Total downloaded records: {len(all_records)}")

if all_records:
    print("Available fields:")
    print(list(all_records[0].keys()))


stations = []
seen = set()

for item in all_records:
    lat = to_float(item.get("緯度"))
    lng = to_float(item.get("經度"))

    if lat is None or lng is None:
        continue

    station = {
        "name": item.get("地點", ""),
        "address": item.get("地點", ""),
        "district": item.get("行政區", ""),
        "village": item.get("里別", ""),
        "route": item.get("路線", ""),
        "truck": item.get("車號", ""),
        "time": item.get("抵達時間", ""),
        "leaveTime": item.get("離開時間", ""),
        "lat": lat,
        "lng": lng,
    }

    key = (
        station["district"],
        station["village"],
        station["route"],
        station["truck"],
        station["time"],
        station["leaveTime"],
        station["lat"],
        station["lng"],
        station["address"],
    )

    if key in seen:
        continue

    seen.add(key)
    stations.append(station)


output = {
    "meta": {
        "source": "Taipei Open Data",
        "datasetId": DATASET_ID,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "totalDownloaded": len(all_records),
        "totalValid": len(stations),
    },
    "stations": stations,
}


with open("garbage.json", "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)


print(f"Updated garbage.json with {len(stations)} valid unique stations.")