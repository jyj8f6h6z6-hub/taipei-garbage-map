# PROJECT STATUS

## Version

Current Version: v1.3.0

---

## Done

- 使用 Leaflet 顯示地圖
- 使用瀏覽器 GPS 定位
- 顯示垃圾車停靠點
- 根據步行時間推薦可追上的垃圾車
- 每條路線只保留最佳停靠點
- 顯示前五名推薦結果
- 推薦卡與地圖 Marker 可互相對應
- 新增地址搜尋（Nominatim）
- 地址搜尋可重新定位並重新推薦垃圾車

---

## Next Milestone

v1.3.1

- 改善地址搜尋成功率
- 加入搜尋 fallback（自動嘗試不同地址格式）
- 按 Enter 可直接搜尋
- 搜尋期間停用按鈕避免重複送出

---

## Known Issues

- Nominatim 可搜尋大部分地標（如台北車站、台北101、松山機場）。
- 部分中文門牌地址可能查不到，例如「台北市中山區松江路100號」。
- 相同地址使用不同輸入格式時，定位可能略有誤差。

---

## Data Structure

garbage.json

- route
- truck
- stopName
- time
- leaveTime
- lat
- lng

---

## Development Rules

- 一次只做一個功能。
- 每完成一個功能立即測試。
- 測試成功再 Commit。
- 不同時修改 UI 與推薦演算法。
- 修改程式以前，以目前專案程式碼為準，不臆測不存在的函式或結構。