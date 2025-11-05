# Google Sheets 整合實作總結

## ✅ 完成項目

### 1. 套件依賴更新
- ✅ 已在 `package.json` 中新增 `googleapis` 套件（版本 ^131.0.0）
- 📝 **請執行**：`npm install` 來安裝新的依賴套件

### 2. 環境變數設定
- ✅ 建立 `env.example` 範本檔案
- ✅ 包含以下新增的環境變數：
  - `GOOGLE_SERVICE_ACCOUNT_PATH`：Service Account JSON 檔案路徑
  - `GOOGLE_SHEET_ID`：Google Sheet ID
  - `GOOGLE_SHEET_NAME`：工作表名稱（預設：工作表1）

### 3. 表單欄位調整
- ✅ 將「UserID 與 注單編號」拆分為兩個獨立欄位：
  - `userId`：UserID（選填）
  - `betOrderId`：注單編號（選填）
- ✅ 更新 `RecordFormData` 介面
- ✅ 更新 Adaptive Card 表單
- ✅ 更新確認卡片顯示

### 4. Google Sheets 服務層
- ✅ 建立 `src/services/googleSheetService.ts`
- ✅ 實作功能：
  - Service Account 認證
  - Google Sheets API 初始化
  - 資料寫入（append row）
  - 連線測試
  - 錯誤處理

### 5. 資料轉換工具
- ✅ 建立 `src/utils/dataMapper.ts`
- ✅ 實作 `mapFormDataToSheetRow()` 函數
- ✅ 完整對應 13 個欄位（A-M）

### 6. 整合到主流程
- ✅ 在 `src/bot.ts` 中整合 Google Sheets 寫入
- ✅ **改為同步寫入，等待結果後再回應使用者**（2024-11-03 更新）
- ✅ 寫入成功：顯示綠色確認卡片
- ✅ 寫入失敗：顯示紅色錯誤卡片，告知使用者錯誤原因
- ✅ 完整的錯誤處理和日誌記錄

### 7. 文件更新
- ✅ 更新 `README.md` 完整說明
- ✅ 建立 `GOOGLE_SHEETS_SETUP.md` 詳細設定指南
- ✅ 更新專案結構說明
- ✅ 更新開發路線圖

## 📊 欄位對應表

| 欄位 | Google Sheet | Teams 表單 | 填寫方式 | 說明 |
|------|-------------|-----------|---------|------|
| A | 工單編號 | 自動產生 | 自動 | `ISSUE-YYYYMMDD-HHMMSS-RRR` |
| B | 環境/整合商 | environment | 使用者選擇 | pgs-prod, pgs-stage, 1xbet, other |
| C | 產品/遊戲 | product | 使用者選擇 | 老虎機、棋牌、魚機 |
| D | 發生異常時間 | issueDate + issueTime | 自動合併 | 格式：`YYYY-MM-DD HH:MM` |
| E | 發生異常操作 | operation | 使用者輸入 | 必填 |
| F | UserID | userId | 使用者輸入 | 選填 |
| G | 注單編號 | betOrderId | 使用者輸入 | 選填 |
| H | 異常代碼 | - | 預留 | 目前為空 |
| I | 異常嚴重度 | severity | 使用者選擇 | P0/P1/P2/P3 |
| J | 優先級別 | severity | 自動複製 | = 異常嚴重度 |
| K | 對應人員 | - | 預留 | 目前為空 |
| L | 發生原因 | description | 使用者輸入 | 選填 |
| M | 處理方式 | - | 預留 | 目前為空 |

## 🔧 待您完成的設定

### 1. 安裝依賴套件
```bash
# 直接在 WSL 中執行
wsl npm install

# 或者
cd /home/scotthsieh/dev/bot-test && npm install
```

✅ **已完成**：googleapis 套件已成功安裝！

### 2. Google Cloud 設定
請參考 `GOOGLE_SHEETS_SETUP.md` 完成以下步驟：
1. 建立 Google Cloud 專案
2. 啟用 Google Sheets API
3. 建立 Service Account
4. 下載 Service Account JSON 金鑰
5. 設定 Google Sheet 並共用給 Service Account

### 3. 設定環境變數
建立 `.env` 檔案（參考 `env.example`）：

```bash
# Bot Framework
APP_ID=your-microsoft-app-id
APP_PASSWORD=your-microsoft-app-password
PORT=3978

# Google Sheets
GOOGLE_SERVICE_ACCOUNT_PATH=/absolute/path/to/service-account-key.json
GOOGLE_SHEET_ID=your-google-sheet-id
GOOGLE_SHEET_NAME=工作表1
```

### 4. 測試
```bash
# 在 WSL 中啟動開發模式
wsl npm run dev

# 或進入目錄後執行
cd /home/scotthsieh/dev/bot-test && npm run dev
```

檢查日誌確認 Google Sheets 初始化成功：
```
[OK] Google Sheets API 初始化成功
[OK] 成功連接到 Google Sheet: 你的Sheet名稱
```

✅ **編譯測試通過**：`npm run build` 已成功執行！所有新增的檔案都正常編譯。

## 🎯 功能特色

### 優雅降級（Graceful Degradation）
- Google Sheets 功能為**選填**
- 未設定時，Bot 仍正常運作
- 僅在 console 顯示提醒訊息

### 非同步寫入
- 不阻塞使用者回應
- 先回應 Teams，再寫入 Google Sheets
- 使用者體驗優先

### 完整錯誤處理
- 寫入失敗不影響主流程
- 詳細的錯誤日誌
- 自動重試機制（未來可擴充）

### 模組化設計
- 服務層獨立（`googleSheetService.ts`）
- 資料轉換獨立（`dataMapper.ts`）
- 易於測試和維護

## 📁 新增/修改的檔案

### 新增檔案
```
✨ env.example                         # 環境變數範本
✨ src/services/googleSheetService.ts  # Google Sheets 服務層
✨ src/utils/dataMapper.ts             # 資料轉換工具
✨ GOOGLE_SHEETS_SETUP.md              # Google Sheets 設定指南
✨ IMPLEMENTATION_SUMMARY.md           # 本檔案
```

### 修改檔案
```
📝 package.json                        # 新增 googleapis 依賴
📝 src/bot.ts                          # 整合 Google Sheets 功能，拆分表單欄位
📝 README.md                           # 更新說明文件
```

## 🔍 程式碼重點說明

### 1. Service Account 認證
使用 Google 官方推薦的 Service Account 方式：
- 無需使用者授權流程
- 適合伺服器端應用
- 透過 JSON 金鑰檔案認證

### 2. 資料寫入流程
```typescript
// 1. 檢查是否啟用
if (googleSheetService.isEnabled()) {
  // 2. 轉換資料格式
  const sheetRowData = mapFormDataToSheetRow(ticketNumber, recordData);
  
  // 3. 非同步寫入（不等待結果）
  googleSheetService.appendRow(sheetRowData)
    .then(() => console.log('成功'))
    .catch(() => console.error('失敗'));
}
```

### 3. 單例模式
```typescript
export const googleSheetService = new GoogleSheetService();
```
- 全域共用一個實例
- 避免重複初始化
- 減少記憶體使用

## 🚀 部署注意事項

### Docker 部署
需要將 Service Account JSON 檔案掛載到容器中：
```bash
-v /host/path/to/service-account.json:/app/secrets/service-account.json:ro
```

### Zeabur 部署
可以透過環境變數或檔案上傳功能提供 Service Account 金鑰。

### 安全性
⚠️ **絕對不要**將 Service Account JSON 檔案提交到 Git！
建議將以下內容加入 `.gitignore`：
```gitignore
*-service-account*.json
service-account-key.json
google-credentials*.json
```

## 📊 測試檢查清單

- [ ] 執行 `npm install` 成功
- [ ] Bot 可以正常啟動
- [ ] Google Sheets 初始化成功（檢查日誌）
- [ ] 提交表單後 Teams 顯示確認卡片
- [ ] Google Sheet 中出現新的資料列
- [ ] 所有 13 個欄位都正確填入
- [ ] UserID 和注單編號分別在不同欄位
- [ ] 日期和時間正確合併
- [ ] 優先級別等於異常嚴重度

## 🔄 2024-11-03 更新：同步錯誤處理改進

### 問題
原本的實作使用非同步寫入（`.then().catch()`），導致：
- ❌ Google Sheets 寫入失敗時，使用者不會收到通知
- ❌ Teams 會立即顯示「成功」卡片，即使資料未寫入
- ❌ 錯誤只記錄在 console，無法追蹤

### 解決方案
改為同步等待 Google Sheets 寫入結果：

#### 修改內容
1. **`handleRecordSubmit()` 方法**
   - 將非同步 `.then().catch()` 改為 `await` + `try-catch`
   - 根據寫入結果顯示不同卡片

2. **新增 `updateToErrorCard()` 方法**
   - 處理寫入失敗時的卡片更新
   - 與成功卡片使用相同的更新機制

3. **新增 `createErrorCard()` 方法**
   - 建立紅色錯誤警告卡片
   - 顯示完整的工單資訊供使用者參考
   - 顯示錯誤詳情供技術人員排查
   - 提供重試建議

#### 使用者體驗改進
- ✅ **寫入成功**：顯示綠色確認卡片（約 1-2 秒延遲）
- ✅ **寫入失敗**：顯示紅色錯誤卡片，包含：
  - ⚠️ 明確的失敗提示
  - 📋 工單號碼（標示「未寫入」）
  - 📝 完整的填寫資料
  - 🐛 錯誤原因
  - 💡 重試建議

#### 技術細節
```typescript
// 同步等待寫入結果
try {
    await googleSheetService.appendRow(sheetRowData);
    await this.updateToConfirmationCard(context, ticketNumber, recordData);
} catch (sheetError: any) {
    const errorMessage = sheetError?.message || String(sheetError);
    await this.updateToErrorCard(context, ticketNumber, recordData, errorMessage);
}
```

## 💡 未來擴充建議

1. **重試機制**：寫入失敗時自動重試
2. **批次寫入**：累積多筆資料後一次寫入
3. **資料驗證**：寫入前驗證資料格式
4. **異常代碼自動化**：根據錯誤類型自動產生異常代碼
5. **查詢功能**：透過 Bot 查詢歷史工單
6. **統計報表**：自動產生工單統計報表

## 📞 需要協助？

如有任何問題，請：
1. 檢查 `GOOGLE_SHEETS_SETUP.md` 的常見問題排除章節
2. 查看 Bot 的 console 日誌
3. 確認環境變數設定正確
4. 確認 Service Account 有 Sheet 的編輯權限

---

**祝您使用順利！** 🎉

