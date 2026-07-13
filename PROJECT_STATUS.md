# Last Updated: 2026-07-13

---

# Project

台北垃圾車即時查詢

---

# Current Version

**v1.3.5**

Status: 🚧 In Progress（Developer Debug）

---

# Completed

## Core Features

* Leaflet 地圖
* 使用者 GPS 定位
* 即時垃圾車推薦
* 推薦排序最佳化
* 推薦最多 5 個停靠點
* 點擊地圖 Marker 自動捲動至推薦卡

## Recommendation

* 移除車號去重限制
* 改以停靠點為推薦單位
* GPS 與地址搜尋共用推薦流程

## Developer Mode

* 建立 Developer Mode 架構
* DEV_MODE
* DEV_TEST_TIME
* DEV_TEST_POSITION
* getCurrentTime()
* 推薦演算法支援假時間測試
* GPS 可切換假座標

## Data

* GitHub Actions 每日自動更新 garbage.json

## UI

* UI 美化
* 手機版 RWD
* Google Analytics

## Address Search

* Google Geocoding 地址搜尋
* 搜尋成功後重新定位
* 搜尋成功後重新推薦垃圾車
* 與 GPS 共用 recommendCatchableTruck()
* 搜尋提示優化
* 搜尋介面優化

## Route Visualization

* 點擊推薦 Marker 顯示後續路徑
* Polyline 顯示後續路線
* 後續停靠點顯示 🚛 Marker
* 點擊 🚛 顯示車號、時間、地址
* 顯示後續 20 分鐘路徑
* 點擊相同推薦點可收合路徑
* 點擊不同推薦點自動切換路徑
* 新增「隱藏路徑」功能
* 路徑顯示時才顯示按鈕
* 點擊後移除 Polyline
* 點擊後移除所有路徑 Marker

---

# Known Issues

## Recommendation

* 推薦排序仍採目前演算法（等待時間 + 步行時間）
* 尚未建立 Catch Score 排序模型
* 尚未納入停收日判斷（週三、週日）

## Route Visualization

* Polyline 仍採直線連接
* 尚未加入道路導航路徑

## Open Data

* 已發現臺北市垃圾車開放資料存在個別座標錯誤案例
* 已確認「臺北市文山區景興路15號前」座標異常，非程式問題

---

# Notes

目前推薦已以停靠點為單位。

地址搜尋已完成，GPS 與地址搜尋共用同一套推薦流程。

路徑視覺化第一階段完成，使用者可查看推薦停靠點後續路徑，並可隨時隱藏路徑。

下一階段將開始納入垃圾停收日判斷，避免於週三、週日仍進行推薦，並持續完善 Developer Debug Mode 與 Catch Score 演算法。
