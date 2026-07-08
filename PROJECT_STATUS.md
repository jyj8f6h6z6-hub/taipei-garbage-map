````markdown
# PROJECT STATUS

Last Updated: 2026-07-08

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

### Data
- GitHub Actions 每日自動更新 garbage.json

### UI
- UI 美化
- 手機版 RWD
- Google Analytics

### Address Search
- 新增地址搜尋（Nominatim）
- 搜尋成功後移動地圖
- 顯示使用者 Marker
- 地址搜尋與 GPS 共用 recommendCatchableTruck()
- 搜尋提示移至搜尋框下方
- 改善搜尋介面（Placeholder、提示位置）

### Developer Mode
- 建立 Developer Mode 架構
- 新增 DEV_MODE
- 新增 DEV_TEST_TIME
- 新增 getCurrentTime()
- 推薦演算法支援假時間測試

---

## Known Issues

### Recommendation
- 推薦排序仍採用目前演算法（等待時間 + 步行時間）。
- 尚未重新定義「最容易追到垃圾車」的排序模型。
- 同一台垃圾車可能連續出現在推薦結果，後續需重新設計排序規則。

### Address Search
- Nominatim 可正常搜尋大部分地標（例如：台北車站、台北101、松山機場）。
- 部分中文門牌地址搜尋成功率較低，例如：
  - 台北市中山區松江路100號
  - 松江路100號 台北市
- 不同輸入格式可能造成定位略有差異。

---

## Next Milestone

### v1.3.1（核心推薦重構）

- [ ] 重新設計推薦演算法
- [ ] 重新定義推薦排序規則
- [ ] 解決垃圾車移動造成的推薦失真
- [ ] 建立更符合實際使用情境的推薦機制

### Developer Mode

- [ ] 假座標測試（DEV_TEST_POSITION）
- [ ] Debug 模式
- [ ] 顯示推薦分數
- [ ] 顯示淘汰原因

---

## Future Roadmap

### v1.3.2（地址搜尋優化）

- [ ] Enter 鍵搜尋
- [ ] 搜尋按鈕 Loading
- [ ] 搜尋期間停用按鈕
- [ ] Fallback Search（改善地址搜尋成功率）

### v1.3.3（路徑視覺化）

- [ ] 推薦垃圾車後續路徑顯示
- [ ] 同車號停靠點以 Polyline 連接
- [ ] 每個停靠點保留 Marker
- [ ] 點擊 Marker 查看推薦資訊
- [ ] 不修改推薦演算法

### v1.4

- [x] Google Analytics
- [ ] SEO
- [ ] robots.txt
- [ ] sitemap.xml
- [ ] Google Search Console

### v1.5

- [ ] 收藏站點
- [ ] 分享連結
- [ ] PWA（可安裝至手機）

### v2.0

- [ ] 自訂網域
- [ ] 自有 API
- [ ] 後端服務
- [ ] 營利模式

---

## Data Structure

### garbage.json

```json
{
  "route": "",
  "truck": "",
  "stopName": "",
  "time": "",
  "leaveTime": "",
  "lat": 0,
  "lng": 0
}
```

---

## Development Rules

- 一次只做一個功能。
- 完成後立即測試。
- 測試成功再 Commit。
- Commit 後 Push GitHub。
- 不同時修改 UI 與推薦演算法。
- 不臆測不存在的函式或專案結構，以目前程式碼為準。

---

## Recent Changes

### v1.3.1

- 移除車號去重限制
- 改以停靠點為推薦單位
- 保持最多 8 筆推薦
- GPS 與地址搜尋共用推薦流程
- 建立 Developer Mode
- 新增 DEV_TEST_TIME
- 新增 getCurrentTime()
- 推薦演算法支援假時間測試

---

## Notes

目前推薦單位已由「垃圾車」改為「停靠點」。

實地測試發現，垃圾車會持續移動，因此同一台車後續停靠點可能比目前推薦點更容易追上。未來將重新設計推薦排序模型，以提升推薦結果與實際使用情境的一致性。

Developer Mode 已建立第一階段架構，可利用假時間測試推薦演算法。下一步將加入假座標（DEV_TEST_POSITION），建立完整的模擬測試環境，方便演算法調整與實地驗證。
````
