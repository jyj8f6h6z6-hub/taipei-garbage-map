# Last Updated: 2026-10-13

---

# Project

台北垃圾車即時查詢

---

# Current Version

**v1.4.0**

Status: ✅ Released（推薦演算法與資料品質大改版）

---

# Completed

## Core Features

* Leaflet 地圖（鎖定 1.9.4 版）
* 使用者 GPS 定位
* 即時垃圾車推薦
* 推薦最多 10 個停靠點
* 點擊地圖 Marker 自動捲動至推薦卡
* 點選的推薦卡會標亮顯示

## Recommendation

* 以停靠點為推薦單位
* 同一地點只保留最佳一班，避免重複推薦
* GPS 與地址搜尋共用推薦流程
* 新排序模型（Catch Score 第一版）：依「最快幾分鐘後可以丟垃圾」排序，距離為次要條件
* 顯示到達後需等待時間
* 時間緊迫時顯示 ⚠️ 提醒
* 步行／騎車模式切換
  * 步行：每分鐘 75 公尺，搜尋 1 公里內
  * 騎車：每分鐘 275 公尺，搜尋 3 公里內
  * 選擇會記憶在瀏覽器（localStorage）
  * Google Maps 導航模式跟著切換

## Collection Day

* 建立 getCollectionStatus()
* 週三、週日停收判斷
* 停收日顯示下一次收運日（明天／後天＋星期）
* 停收日清除推薦 Marker 與路徑
* 支援特定星期收運的站點（解析地點名稱中的「週一、週四收運」「週二、週五無收運」「每星期一、四收運」）

## Overnight Schedule

* 支援跨午夜班次（例如 2410 = 凌晨 00:10）
* 「收運日」概念：凌晨 5 點前視為前一天的收運班次
* 時間顯示自動轉換（2410 → 00:10）

## Developer Mode

* DEV_MODE
* DEV_TEST_DATE
* DEV_TEST_TIME
* DEV_TEST_POSITION
* getCurrentTime()
* 推薦演算法支援假日期＋假時間測試

## Data

* GitHub Actions 每日自動更新 garbage.json
* 自動修正經緯度對調的座標
* 自動剔除臺北市範圍外的錯誤座標（Python 與網頁端雙重檢查）
* 時間格式統一為 4 位數
* 移除重複的 name 欄位，壓縮輸出 JSON（檔案約減半）
* API 異常時不覆蓋舊資料（少於 100 筆即中止）
* meta 新增修正／剔除筆數統計

## UI

* UI 美化
* 手機版 RWD（改用 100dvh，修正 iPhone 底部被擋住）
* 推薦點改為編號標記（1、2、3…），最佳推薦為綠色
* 定位圖示錨點修正（圖釘尖端對準實際位置）
* 輸入框字級 16px，避免 iPhone 自動放大
* Google Analytics

## Address Search

* Google Geocoding 地址搜尋
* 搜尋成功後重新定位並推薦
* 與 GPS 共用 recommendCatchableTruck()
* Google Maps 尚未載入時顯示提示，不再直接失敗
* 支援 loading=async 的 importLibrary 載入方式
* 搜尋結果不在臺北市時顯示提示
* 注音輸入選字時按 Enter 不會誤觸搜尋

## Route Visualization

* 點擊推薦 Marker 顯示後續 40 分鐘路徑
* Polyline 顯示後續路線
* 後續停靠點顯示 🚛 Marker（含車號、時間、地址）
* 點擊相同推薦點可收合路徑
* 點擊不同推薦點自動切換路徑
* 「隱藏路徑」按鈕（路徑顯示時才出現）
* 路徑同樣套用特定星期收運規則與跨午夜時間

## Security / Maintenance

* 所有動態內容皆經過 escapeHtml()
* 移除未使用的變數與函式
* 設定值與文件說明一致化

---

# Known Issues

## Recommendation

* 移動時間以直線距離估算，未考慮實際道路與紅綠燈
* 國定假日（如春節）停收規則尚未納入

## Route Visualization

* Polyline 仍採直線連接
* 尚未加入道路導航路徑

## Open Data

* 臺北市垃圾車開放資料存在個別座標錯誤，目前已自動修正或剔除
* 位於臺北市範圍內、但位置不正確的座標（如「文山區景興路15號前」）仍無法自動偵測

## Security

* Google Maps API Key 需在 Google Cloud Console 設定 HTTP 參照網址限制（待確認是否已設定）

---

# Notes

v1.4.0 完成推薦演算法大改版：排序改以「最快可丟垃圾時間」為主，並加入步行／騎車模式。

停收日判斷、特定星期收運站點、跨午夜班次皆已正式納入推薦與路徑流程。

資料端加入座標自動修正與異常防護，網頁端也做雙重檢查。

下一階段可考慮：Developer Debug Mode（顯示推薦分數與淘汰原因）、國定假日停收、SEO 與 PWA。