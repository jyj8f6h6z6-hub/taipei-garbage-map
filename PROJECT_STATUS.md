# Last Updated: 2026-07-14

---

# Project

台北垃圾車收運點查詢

---

# Current Version

**v1.5.0 (Development)**

Status: 🚧 In Progress

---

# Completed

## Core Features

- Leaflet 地圖
- 使用者 GPS 定位
- 即時垃圾車推薦
- 推薦排序最佳化
- 推薦最多 10 個停靠點
- 點擊地圖 Marker 自動捲動至推薦卡

## Recommendation

- 移除車號去重限制
- 改以停靠點為推薦單位
- GPS 與地址搜尋共用推薦流程
- 推薦演算法支援停收日判斷
- 停收日停止推薦垃圾車

## Developer Mode

- DEV_MODE
- DEV_TEST_DATE
- DEV_TEST_TIME
- DEV_TEST_POSITION
- DEV_SHOW_DEBUG
- getCurrentTime()

## Data

- GitHub Actions 每日自動更新 garbage.json

## UI

- UI 美化
- 手機版 RWD
- Google Analytics
- 停收日提示卡片
- 推薦介面優化

## Address Search

- Google Geocoding 地址搜尋
- 搜尋成功重新定位
- 搜尋成功重新推薦垃圾車

## Route Visualization

- 推薦點後續路徑
- Polyline
- 後續停靠點 Marker
- 路徑收合

---

# PWA (In Progress)

## Completed

- package.json
- feature/v1.5-pwa-ios 開發分支
- manifest.webmanifest
- index.html 載入 Manifest
- Service Worker 建立
- Service Worker 註冊完成
- GitHub Pages 相容路徑設定

## Pending

- App Icon
- Apple Touch Icon
- Offline Page
- Cache Strategy
- Install Prompt
- Network Status
- Splash Screen

---

# Notes

目前已完成 PWA 第一階段基礎架構。

Service Worker 已成功註冊，尚未加入正式 Cache Strategy。

下一步將建立離線頁面與 Network First 快取策略（garbage.json）。