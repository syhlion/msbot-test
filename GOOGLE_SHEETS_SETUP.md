# Google Sheets 設定指南

本文件提供 Google Sheets 整合的詳細設定步驟。

## 📋 前置需求

- Google 帳號
- 已建立的 Google Sheet（或準備建立新的）
- Bot 已部署並正常運作

## 🚀 快速設定步驟

### 1. 建立 Google Cloud 專案

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 點擊上方的專案選擇器，然後點擊「新增專案」
3. 輸入專案名稱（例如：`sre-bot-integration`）
4. 點擊「建立」

### 2. 啟用 Google Sheets API

1. 在專案控制台中，點擊左側選單「API 和服務」→「已啟用的 API 和服務」
2. 點擊「+ 啟用 API 和服務」
3. 搜尋「Google Sheets API」
4. 點擊進入後，點擊「啟用」按鈕

### 3. 建立 Service Account

1. 在左側選單選擇「API 和服務」→「憑證」
2. 點擊上方「+ 建立憑證」→「服務帳戶」
3. 填寫資訊：
   - **服務帳戶名稱**：`sre-bot-sheets-writer`
   - **服務帳戶 ID**：會自動產生（例如：`sre-bot-sheets-writer@project-id.iam.gserviceaccount.com`）
   - **說明**：`SRE Bot 用於寫入 Google Sheets 的服務帳戶`
4. 點擊「建立並繼續」
5. **授予服務帳戶存取權**：可以跳過此步驟，點擊「繼續」
6. **授予使用者存取此服務帳戶的權限**：跳過此步驟，點擊「完成」

**重要**：記下 Service Account Email（格式：`xxx@xxx.iam.gserviceaccount.com`），稍後會用到！

### 4. 建立並下載金鑰

1. 在「憑證」頁面，找到剛建立的服務帳戶
2. 點擊服務帳戶的名稱進入詳細資訊頁面
3. 切換到「金鑰」分頁
4. 點擊「新增金鑰」→「建立新的金鑰」
5. 選擇金鑰類型：**JSON**
6. 點擊「建立」

金鑰會自動下載到您的電腦（檔名類似：`project-id-xxxxxxxxxxxx.json`）

⚠️ **安全提醒**：
- 妥善保管此 JSON 檔案，不要上傳到 Git repository
- 不要分享給任何人
- 建議將檔案移到專案目錄外的安全位置

### 5. 準備 Google Sheet

#### 選項 A：建立新的 Google Sheet

1. 前往 [Google Sheets](https://sheets.google.com/)
2. 點擊「+」建立新試算表
3. 將試算表命名為「SRE 工單記錄」或您喜歡的名稱
4. 在第一列（A1-M1）設定表頭：

| A | B | C | D | E | F | G | H | I | J | K | L | M |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 工單編號 | 環境/整合商 | 產品/遊戲 | 發生異常時間 | 發生異常操作 | UserID | 注單編號 | 異常代碼 | 異常嚴重度 | 優先級別 | 對應人員 | 發生原因 | 處理方式 |

#### 選項 B：使用現有的 Google Sheet

確保您的 Sheet 有對應的欄位結構。

### 6. 共用 Sheet 給 Service Account

這是**最關鍵的步驟**！

1. 在 Google Sheet 中，點擊右上角「共用」按鈕
2. 在「新增使用者和群組」欄位中，貼上之前記下的 **Service Account Email**
   ```
   sre-bot-sheets-writer@project-id.iam.gserviceaccount.com
   ```
3. 設定權限為「編輯者」
4. **取消勾選**「通知使用者」（因為這是機器人帳戶）
5. 點擊「共用」或「傳送」

### 7. 取得 Google Sheet ID

從 Google Sheet 的 URL 複製 Sheet ID：

```
https://docs.google.com/spreadsheets/d/1ABC123xyz456DEF789GHI/edit#gid=0
                                     ^^^^^^^^^^^^^^^^^^^^^^^^
                                     這就是 Sheet ID
```

### 8. 設定環境變數

根據您的部署方式設定環境變數：

#### 本地開發

建立或編輯 `.env` 檔案：

```bash
# Bot Framework
APP_ID=your-app-id
APP_PASSWORD=your-app-password
PORT=3978

# Google Sheets
GOOGLE_SERVICE_ACCOUNT_PATH=/absolute/path/to/your-service-account-key.json
GOOGLE_SHEET_ID=1ABC123xyz456DEF789GHI
GOOGLE_SHEET_NAME=工作表1
```

**注意**：
- `GOOGLE_SERVICE_ACCOUNT_PATH` 必須是**絕對路徑**
- Windows 範例：`C:/Users/YourName/secrets/service-account-key.json`
- Linux/Mac 範例：`/home/yourname/secrets/service-account-key.json`

#### Docker 部署

```bash
docker run -p 3978:3978 \
  -e APP_ID=your-app-id \
  -e APP_PASSWORD=your-app-password \
  -e GOOGLE_SERVICE_ACCOUNT_PATH=/app/secrets/service-account-key.json \
  -e GOOGLE_SHEET_ID=1ABC123xyz456DEF789GHI \
  -e GOOGLE_SHEET_NAME=工作表1 \
  -v /path/to/your/service-account-key.json:/app/secrets/service-account-key.json:ro \
  bot-test
```

#### Zeabur / 雲端部署

在平台的環境變數設定中新增：

```
GOOGLE_SERVICE_ACCOUNT_PATH=/app/secrets/service-account-key.json
GOOGLE_SHEET_ID=1ABC123xyz456DEF789GHI
GOOGLE_SHEET_NAME=工作表1
```

然後將 Service Account JSON 檔案內容設定為 secret 或透過檔案上傳功能提供。

## ✅ 測試設定

### 方法 1：檢查啟動日誌

啟動 Bot 後，檢查 console 輸出：

**成功的日誌：**
```
[OK] Google Sheets API 初始化成功
[OK] 成功連接到 Google Sheet: SRE 工單記錄
```

**失敗的日誌：**
```
[WARN] GOOGLE_SHEET_ID 未設定，Google Sheets 功能將被停用
```
或
```
[ERROR] Service Account 檔案不存在: /path/to/file.json
```

### 方法 2：提交測試表單

1. 在 Teams 中觸發 Bot 表單
2. 填寫並提交表單
3. 檢查 Google Sheet 是否有新的一列資料
4. 檢查 console 日誌：
   ```
   [INFO] 開始寫入 Google Sheets...
   [OK] Google Sheets 寫入成功: ISSUE-20251103-143022-456
   [INFO] 更新範圍: 工作表1!A2:M2
   ```

## 🔧 常見問題排除

### 問題 1：Bot 啟動時顯示「GOOGLE_SHEET_ID 未設定」

**原因**：環境變數未正確載入

**解決方法**：
- 確認 `.env` 檔案存在且格式正確
- 確認環境變數名稱拼寫正確
- 重新啟動 Bot

### 問題 2：「Service Account 檔案不存在」

**原因**：檔案路徑不正確

**解決方法**：
- 使用**絕對路徑**而非相對路徑
- 確認檔案確實存在於該路徑
- Windows 使用者注意路徑分隔符號（使用 `/` 或 `\\`）

### 問題 3：「Error: The caller does not have permission」

**原因**：Service Account 沒有 Sheet 的編輯權限

**解決方法**：
- 確認已將 Service Account Email 加入 Sheet 的共用清單
- 確認權限設定為「編輯者」而非「檢視者」
- 等待幾分鐘讓權限生效

### 問題 4：「Error: Requested entity was not found」

**原因**：Sheet ID 不正確或 Sheet 不存在

**解決方法**：
- 重新檢查 `GOOGLE_SHEET_ID` 是否正確
- 確認 Sheet 沒有被刪除
- 確認 Sheet 的 URL 可以正常存取

### 問題 5：寫入錯誤但 Bot 仍正常運作

**設計行為**：為了不影響主要功能，Google Sheets 寫入失敗不會導致 Bot 崩潰

**處理方式**：
- 檢查錯誤日誌找出原因
- 修復問題後，之前失敗的記錄需要手動補登

## 📊 欄位說明

### 自動填寫欄位

- **A: 工單編號**：自動產生，格式 `ISSUE-YYYYMMDD-HHMMSS-RRR`
- **D: 發生異常時間**：由表單的日期和時間欄位自動合併
- **J: 優先級別**：自動複製異常嚴重度的值

### 表單填寫欄位

- **B: 環境/整合商**
- **C: 產品/遊戲**
- **E: 發生異常操作**
- **F: UserID**（選填）
- **G: 注單編號**（選填）
- **I: 異常嚴重度**（P0/P1/P2/P3）
- **L: 發生原因**（選填）

### 預留欄位（目前為空）

- **H: 異常代碼**：預留給未來功能
- **K: 對應人員**：需要後續手動填寫
- **M: 處理方式**：需要後續手動填寫

## 🔒 安全最佳實踐

1. **絕對不要**將 Service Account JSON 檔案提交到版本控制
2. 將 `*.json` 加入 `.gitignore`（除了 `package.json`）
3. 定期輪換 Service Account 金鑰
4. 只授予 Service Account 必要的最小權限
5. 使用環境變數或 secret 管理工具儲存敏感資訊
6. 在不同環境（開發/測試/生產）使用不同的 Service Account

## 📝 建議的 .gitignore 設定

```gitignore
# 環境變數檔案
.env
.env.local
.env.*.local

# Google Service Account 金鑰
*-service-account*.json
service-account-key.json
google-credentials*.json

# 保留 package.json（不被忽略）
!package.json
!package-lock.json
```

## 🎯 下一步

設定完成後：

1. 測試表單提交並確認資料正確寫入
2. 檢查欄位格式是否符合預期
3. 根據需求調整 Sheet 的欄位寬度和格式
4. 設定 Sheet 的資料驗證和條件格式（選填）
5. 定期備份 Google Sheet 資料

## 💡 提示

- Google Sheets 整合是**選填功能**，即使未設定，Bot 仍可正常在 Teams 中顯示確認訊息
- 建議先在測試 Sheet 上驗證設定，確認無誤後再切換到正式 Sheet
- 可以使用 Google Sheets 的篩選和樞紐分析功能進行資料分析
- 考慮設定 Google Sheets 的通知規則，在有新工單時發送提醒

---

如有任何問題，請檢查 Bot 的 console 日誌以取得更多錯誤資訊。

