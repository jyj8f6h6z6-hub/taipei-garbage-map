# NEXT STEP

Last Updated: 2026-07-09

---

# Current Milestone

v1.3.3 — Developer Debug Mode

---

## Goal

建立完整的演算法除錯工具。

讓所有推薦結果都能在模擬環境下快速驗證，而不用每次都到現場測試。

---

## Todo

### Debug Mode

- [ ] DEV_DEBUG
- [ ] 顯示 Catch Score
- [ ] 顯示等待時間
- [ ] 顯示步行時間
- [ ] 顯示推薦排序依據

### Candidate Debug

- [ ] 顯示所有候選停靠點
- [ ] 顯示淘汰原因
- [ ] 顯示淘汰時間差
- [ ] 顯示步行距離
- [ ] 顯示是否可追上

### UI

- [ ] Debug Panel
- [ ] 一鍵開關 Debug
- [ ] 顯示演算法計算結果

---

## Development Strategy

1. 修正核心推薦
2. 建立 Developer Mode
3. 建立 Debug 工具
4. 模擬測試
5. 現場驗證

---

## Long-term

完成 Debug Mode 後，再開始規劃 Catch Score 演算法重構。