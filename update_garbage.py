"""
下載臺北市垃圾車開放資料，整理成 garbage.json

改進項目：
- 自動修正經緯度對調的座標
- 剔除不在臺北市範圍內的錯誤座標
- 整理時間格式（統一成 4 位數，例如 930 -> 0930）
- 移除與 address 重複的 name 欄位，並壓縮輸出，檔案更小
- 抓不到資料時不會覆蓋舊檔案
"""

import json
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone

DATASET_ID = "a6e90031-7ec4-4089-afb5-361a4efe7202"
BASE_URL = f"https://data.taipei/api/v1/dataset/{DATASET_ID}"
PAGE_LIMIT = 1000
OUTPUT_FILE = "garbage.json"

# 臺北市大致範圍（與 script.js 一致）
TAIPEI_BOUNDS = {
    "min_lat": 24.95,
    "max_lat": 25.22,
    "min_lng": 121.45,
    "max_lng": 121.67,
}


def to_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def in_taipei(lat, lng):
    if lat is None or lng is None:
        return False
    return (
        TAIPEI_BOUNDS["min_lat"] <= lat <= TAIPEI_BOUNDS["max_lat"]
        and TAIPEI_BOUNDS["min_lng"] <= lng <= TAIPEI_BOUNDS["max_lng"]
    )


def fix_coordinates(lat, lng):
    """回傳 (lat, lng, 狀態)，狀態為 'ok'、'swapped' 或 None（無法修正）"""
    if in_taipei(lat, lng):
        return lat, lng, "ok"
    if in_taipei(lng, lat):
        return lng, lat, "swapped"
    return lat, lng, None


def clean_time(value):
    """把 '16:30'、'930'、'1630' 統一成 4 位數字字串，格式不對回傳空字串"""
    text = str(value or "").strip().replace(":", "").replace("：", "")
    if text.isdigit() and len(text) in (3, 4):
        return text.zfill(4)
    return ""


def fetch_page(offset):
    params = {
        "scope": "resourceAquire",
        "limit": PAGE_LIMIT,
        "offset": offset,
    }
    url = BASE_URL + "?" + urllib.parse.urlencode(params)
    print(f"Fetching: {url}")

    with urllib.request.urlopen(url, timeout=30) as response:
        data = json.loads(response.read().decode("utf-8"))

    # 新格式：直接回傳陣列
    if isinstance(data, list):
        return data

    # 舊格式
    if isinstance(data, dict):
        result = data.get("result", {})
        if isinstance(result, dict):
            records = result.get("results", [])
            if isinstance(records, list):
                return records

        records = data.get("results", [])
        if isinstance(records, list):
            return records

    raise ValueError(f"Unexpected API response format: {type(data).__name__}")


def fetch_all_records():
    all_records = []
    offset = 0
    previous_records = None

    while True:
        records = fetch_page(offset)
        print(f"Offset {offset}: downloaded {len(records)} records")

        if not records:
            break

        # 防止 API 不支援 offset，一直回傳同一頁
        if previous_records is not None and records == previous_records:
            print("API returned the same page again. Stopping pagination.")
            break

        all_records.extend(records)
        previous_records = records

        if len(records) < PAGE_LIMIT:
            break

        offset += PAGE_LIMIT

    return all_records


def build_stations(records):
    stations = []
    seen = set()
    stats = {"swapped": 0, "bad_coord": 0, "bad_time": 0, "duplicate": 0}

    for item in records:
        address = (item.get("地點") or "").strip()
        lat, lng, status = fix_coordinates(to_float(item.get("緯度")), to_float(item.get("經度")))

        if status is None:
            stats["bad_coord"] += 1
            print(f"⚠️ 座標異常，已略過：{address} ({item.get('緯度')}, {item.get('經度')})")
            continue

        if status == "swapped":
            stats["swapped"] += 1
            print(f"🔁 經緯度對調，已修正：{address}")

        time = clean_time(item.get("抵達時間"))
        leave_time = clean_time(item.get("離開時間")) or time

        if not time:
            stats["bad_time"] += 1
            print(f"⚠️ 時間格式異常，已略過：{address} ({item.get('抵達時間')})")
            continue

        station = {
            "address": address,
            "district": item.get("行政區", ""),
            "village": item.get("里別", ""),
            "route": item.get("路線", ""),
            "truck": item.get("車號", ""),
            "time": time,
            "leaveTime": leave_time,
            "lat": round(lat, 7),
            "lng": round(lng, 7),
        }

        key = (
            station["route"],
            station["truck"],
            station["time"],
            station["leaveTime"],
            station["lat"],
            station["lng"],
            station["address"],
        )

        if key in seen:
            stats["duplicate"] += 1
            continue

        seen.add(key)
        stations.append(station)

    return stations, stats


def main():
    records = fetch_all_records()
    print(f"Total downloaded records: {len(records)}")

    if records:
        print("Available fields:", list(records[0].keys()))

    stations, stats = build_stations(records)

    # 安全機制：資料太少代表 API 可能出問題，不要覆蓋舊檔
    if len(stations) < 100:
        print(f"❌ 只取得 {len(stations)} 筆有效資料，疑似 API 異常，保留舊的 {OUTPUT_FILE}。")
        sys.exit(1)

    output = {
        "meta": {
            "source": "Taipei Open Data",
            "datasetId": DATASET_ID,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
            "totalDownloaded": len(records),
            "totalValid": len(stations),
            "coordinateSwapped": stats["swapped"],
            "coordinateRemoved": stats["bad_coord"],
            "timeRemoved": stats["bad_time"],
        },
        "stations": stations,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        # separators 讓輸出不含多餘空白，檔案更小
        json.dump(output, f, ensure_ascii=False, separators=(",", ":"))

    print(
        f"✅ 已更新 {OUTPUT_FILE}：{len(stations)} 筆有效站點"
        f"（修正對調 {stats['swapped']}、剔除座標 {stats['bad_coord']}、"
        f"剔除時間 {stats['bad_time']}、重複 {stats['duplicate']}）"
    )


if __name__ == "__main__":
    main()