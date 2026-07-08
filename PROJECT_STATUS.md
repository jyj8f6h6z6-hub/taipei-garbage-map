# PROJECT STATUS

Last Updated: 2026-07-09

---

## Project

台北垃圾車即時查詢

---

## Current Version

v1.3.1

Status: 🚧 In Progress（核心推薦重構）

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
- 地址搜尋（Nominatim）
- 搜尋成功後重新定位
- 搜尋後重新推薦垃圾車
- 地址搜尋與 GPS 共用 recommendCatchableTruck()
- 搜尋提示移至搜尋框下方
- 搜尋介面優化

---

## Known Issues

### Recommendation
- 推薦排序仍採目前演算法（等待時間 + 步行時間）。
- 尚未建立新的 Catch Score 排序模型。

### Address Search
- Nominatim 對部分中文門牌地址成功率仍有限。
- 後續將加入 Fallback Search。

### Open Data
- 已發現臺北市垃圾車開放資料存在個別座標錯誤案例。
- 已確認「臺北市文山區景興路15號前」座標異常，非程式問題。

---

## Next Milestone

### v1.3.2（地址搜尋優化）

- [ ] Enter 鍵搜尋
- [ ] 搜尋按鈕 Loading
- [ ] 搜尋期間停用按鈕
- [ ] Fallback Search（改善地址搜尋成功率）

---

## Future Roadmap

### v1.3.3（路徑視覺化）

- [ ] 推薦垃圾車後續路徑顯示
- [ ] 同車號停靠點以 Polyline 連接
- [ ] 每個停靠點保留 Marker
- [ ] 點擊 Marker 查看推薦資訊
- [ ] 不修改推薦演算法

### Developer Mode

- [x] 假時間
- [x] 假座標
- [ ] Debug 模式
- [ ] 顯示推薦分數
- [ ] 顯示淘汰原因

### v1.4

- [x] Google Analytics
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

目前推薦邏輯已改為以「停靠點」為推薦單位。

經過假時間、假座標與實地測試，目前推薦結果符合預期，因此暫不調整推薦演算法。

Developer Mode 已成為後續演算法與資料驗證的重要工具，可快速重現特定時間與位置。

本次亦利用 Developer Mode 發現臺北市開放資料單筆座標錯誤，證明模擬測試環境具有實際價值。