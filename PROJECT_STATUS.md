# PROJECT STATUS

Last Updated: 2026-07-09

---

## Project

台北垃圾車即時查詢

---

## Current Version

v1.3.2

Status: 🚧 In Progress（路徑視覺化）

---

## Completed

### Core Features
- Leaflet 地圖
- 使用者 GPS 定位
- 即時垃圾車推薦
- 推薦排序最佳化
- 推薦最多 8 個停靠點
- 點擊地圖 Marker 自動捲動至推薦卡

### Recommendation
- 移除車號去重限制
- 改以停靠點為推薦單位
- GPS 與地址搜尋共用推薦流程

### Developer Mode
- 建立 Developer Mode 架構
- 新增 DEV_MODE
- 新增 DEV_TEST_TIME（假時間）
- 新增 DEV_TEST_POSITION（假座標）
- 新增 getCurrentTime()
- 推薦演算法支援假時間測試
- GPS 可切換為假座標測試

### Data
- GitHub Actions 每日自動更新 garbage.json

### UI
- UI 美化
- 手機版 RWD
- Google Analytics

### Address Search
- 地址搜尋（Google Geocoding）
- 搜尋成功後重新定位
- 搜尋後重新推薦垃圾車
- 地址搜尋與 GPS 共用 recommendCatchableTruck()
- 搜尋提示移至搜尋框下方
- 搜尋介面優化

### Route Visualization
- 點擊推薦 Marker 顯示後續路徑
- Polyline 顯示後續路線
- 後續停靠點顯示 🚛 Marker
- 點擊 🚛 顯示車號、時間、地址
- 路徑僅顯示後續 30 分鐘
- 點擊相同推薦點可收合路徑
- 點擊不同推薦點自動切換路徑

---

## Known Issues

### Recommendation
- 推薦排序仍採目前演算法（等待時間 + 步行時間）
- 尚未建立 Catch Score 排序模型

### Route Visualization
- Polyline 仍採直線連接
- 尚未加入實際道路導航路徑

### Open Data
- 已發現臺北市垃圾車開放資料存在個別座標錯誤案例
- 已確認「臺北市文山區景興路15號前」座標異常，非程式問題

---

## Next Milestone

### v1.3.3（Developer Debug）

- [ ] Debug Mode
- [ ] 顯示推薦分數
- [ ] 顯示淘汰原因
- [ ] 顯示步行時間
- [ ] 顯示等待時間

---

## Future Roadmap

### Developer Mode

- [x] 假時間
- [x] 假座標
- [ ] Debug Mode
- [ ] Catch Score
- [ ] 淘汰原因

### v1.4

- [ ] SEO
- [ ] robots.txt
- [ ] sitemap.xml
- [ ] Google Search Console

### v1.5

- [ ] 收藏站點
- [ ] 分享連結
- [ ] PWA

### v2.0

- [ ] 自訂網域
- [ ] 自有 API
- [ ] 後端
- [ ] 營利模式

---

## Notes

目前推薦已以停靠點為單位。

地址搜尋已改採 Google Geocoding，成功率符合預期，因此地址搜尋功能暫告完成。

路徑視覺化第一階段完成，使用者可查看推薦停靠點後續 30 分鐘的垃圾車行駛路徑與停靠資訊。

下一階段將重心轉向 Developer Debug Mode，提升演算法驗證效率。