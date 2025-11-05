# SRE 工單記錄 Bot - Microsoft Bot Framework

使用 TypeScript 和官方 Bot Framework SDK 開發的 SRE 工單記錄系統。

## 功能

- ✅ **混合模式觸發**：Tag Bot + 關鍵字自動顯示表單
- ✅ **Adaptive Card 互動式表單**：美觀且易用的工單填寫介面
- ✅ **Command 指令支援**：`/record`, `/help` 等指令
- ✅ **表單提交處理**：自動產生工單號碼並回應確認訊息
- ✅ **工單號碼產生器**：格式 `SRE-YYYYMMDD-HHMMSS-RRR`（並發安全）
- ✅ 支援 Microsoft Teams
- ✅ 完整的錯誤處理
- ✅ Docker 支援
- ✅ 健康檢查端點
- ✅ Google Sheets 自動寫入整合

## 技術棧

- **Runtime**: Node.js 20
- **語言**: TypeScript
- **框架**: Bot Framework SDK v4
- **Web Server**: Fastify
- **資料整合**: Google Sheets API
- **部署**: Docker + Zeabur

## 使用方式

### 方式 1：自動觸發（推薦）

在 Teams 中 Tag Bot 並提到「遊戲商系統 SRE」：

```
@SRE Bot 遊戲商系統 SRE 需要記錄工單
```

Bot 會自動顯示 Adaptive Card 表單。

### 方式 2：指令模式

直接使用指令：

- `/record` - 開啟工單記錄表單
- `/help` - 顯示使用說明

### 表單欄位

- **環境/整合商** *（必填）*：pgs-prod, pgs-stage, 1xbet, other
- **產品/遊戲** *（必填）*：老虎機、棋牌、魚機
- **發現異常日期** *（必填）*：選擇日期
- **發現異常時間** *（必填）*：選擇時間
- **發生異常操作** *（必填）*：描述操作
- **UserID**（選填）：使用者 ID
- **注單編號**（選填）：遊戲注單編號
- **異常分級** *（必填）*：P0(緊急), P1(高), P2(中), P3(低)
- **異常狀況說明**（選填）：詳細描述

### 提交後的回應

提交表單後，**原本的表單會自動替換成精美的確認卡片**，包含：

- ✅ 綠色成功標題「工單記錄已提交」
- 📋 自動產生的工單號碼（格式：`SRE-20251030-163045-123`）
  - 包含日期、時間、隨機數，確保唯一性
  - **並發安全**：多人同時提交不會重複
- 👤 提交人名稱（自動從 Teams 擷取）
- 📊 使用 FactSet 清晰呈現所有關鍵資訊
- 📝 詳細的操作說明和備註
- 🎨 現代化的 Adaptive Card 設計

**特色**：
- 🔄 表單自動收起，畫面清爽
- 📱 響應式設計，支援各種螢幕尺寸
- 🎯 關鍵資訊一目了然
- 🔒 工單號碼唯一性保證

## 本地開發

### 1. 安裝依賴

```bash
npm install
```

### 2. 設定環境變數

複製 `env.example` 為 `.env` 並填入你的設定：

```bash
# Bot Framework
APP_ID=your-app-id
APP_PASSWORD=your-app-password
PORT=3978

# Google Sheets（選填）
GOOGLE_SERVICE_ACCOUNT_PATH=/path/to/service-account-key.json
GOOGLE_SHEET_ID=your-google-sheet-id
GOOGLE_SHEET_NAME=工作表1
```

**注意**：Google Sheets 設定為選填，若未設定則僅在 Teams 中顯示確認訊息，不會寫入 Google Sheets。

### 3. 開發模式

```bash
npm run dev
```

### 4. 建置

```bash
npm run build
npm start
```

## Docker 部署

### 建置映像檔

```bash
docker build -t bot-test .
```

### 執行容器

```bash
docker run -p 3978:3978 \
  -e APP_ID=your-app-id \
  -e APP_PASSWORD=your-app-password \
  bot-test
```

## Zeabur 部署

1. 推送代碼到 Git repository
2. 在 Zeabur 連接你的 repository
3. 設定環境變數：
   - `APP_ID`: 你的 Microsoft App ID
   - `APP_PASSWORD`: 你的 App Password
4. Zeabur 會自動偵測 Dockerfile 並建置部署

## Azure Bot Service 設定

1. 在 Azure Portal 建立 Bot Resource
2. 設定 **Messaging Endpoint**: `https://your-domain.zeabur.app/api/messages`
3. 複製 **Microsoft App ID** 和建立 **Client Secret**
4. 將這些值設定到 Zeabur 的環境變數中

## Google Sheets 設定（選填）

### 步驟 1：建立 Google Cloud 專案並啟用 Sheets API

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立新專案或選擇現有專案
3. 啟用 **Google Sheets API**：
   - 在左側選單選擇「API 和服務」>「資料庫」
   - 搜尋「Google Sheets API」並啟用

### 步驟 2：建立 Service Account

1. 在 Google Cloud Console 選擇「API 和服務」>「憑證」
2. 點擊「建立憑證」>「服務帳戶」
3. 填寫服務帳戶資訊：
   - 名稱：`sre-bot-sheets-writer`
   - 描述：`SRE Bot Google Sheets Writer`
4. 點擊「建立並繼續」
5. 跳過權限設定，點擊「完成」

### 步驟 3：下載 Service Account 金鑰

1. 在「憑證」頁面，找到剛建立的服務帳戶
2. 點擊服務帳戶進入詳細資料頁面
3. 選擇「金鑰」分頁
4. 點擊「新增金鑰」>「建立新的金鑰」
5. 選擇 **JSON** 格式
6. 下載 JSON 檔案並妥善保管（不要提交到版本控制！）

### 步驟 4：設定 Google Sheet

1. 建立新的 Google Sheet 或開啟現有的 Sheet
2. 設定第一列為表頭（與圖片中的欄位對應）：
   ```
   工單編號 | 環境/整合商 | 產品/遊戲 | 發生異常時間 | 發生異常操作 | UserID | 注單編號 | 異常代碼 | 異常嚴重度 | 優先級別 | 對應人員 | 發生原因 | 處理方式
   ```
3. 從 URL 複製 **Sheet ID**：
   ```
   https://docs.google.com/spreadsheets/d/[這裡是 SHEET_ID]/edit
   ```
4. 點擊右上角「共用」按鈕
5. 將剛才建立的 **Service Account Email**（格式：`xxx@xxx.iam.gserviceaccount.com`）加入共用清單
6. 設定權限為「編輯者」

### 步驟 5：設定環境變數

將 Service Account JSON 檔案放到安全的位置（例如專案根目錄外），然後設定 `.env`：

```bash
GOOGLE_SERVICE_ACCOUNT_PATH=/absolute/path/to/service-account-key.json
GOOGLE_SHEET_ID=你的Google_Sheet_ID
GOOGLE_SHEET_NAME=工作表1
```

### 欄位對應說明

Bot 會自動將表單資料對應到以下欄位：

| Google Sheet 欄位 | 來源 | 說明 |
|------------------|------|------|
| A: 工單編號 | 自動產生 | 格式：`ISSUE-YYYYMMDD-HHMMSS-RRR` |
| B: 環境/整合商 | 表單 | 使用者選擇的環境 |
| C: 產品/遊戲 | 表單 | 使用者選擇的產品 |
| D: 發生異常時間 | 表單 | 日期 + 時間合併 |
| E: 發生異常操作 | 表單 | 使用者輸入的操作描述 |
| F: UserID | 表單 | 使用者 ID（選填） |
| G: 注單編號 | 表單 | 遊戲注單編號（選填） |
| H: 異常代碼 | 預留 | 目前留空，未來可擴充 |
| I: 異常嚴重度 | 表單 | P0/P1/P2/P3 |
| J: 優先級別 | 自動 | 等同於異常嚴重度 |
| K: 對應人員 | 預留 | 目前留空，後續手動填寫 |
| L: 發生原因 | 表單 | 異常狀況說明（選填） |
| M: 處理方式 | 預留 | 目前留空，後續手動填寫 |

### 測試連線

Bot 啟動後會自動檢測 Google Sheets 設定，檢查 logs：

```
[OK] Google Sheets API 初始化成功
[OK] 成功連接到 Google Sheet: 你的Sheet名稱
```

## API 端點

- `POST /api/messages` - Bot 訊息處理端點
- `GET /api/ping` - 健康檢查端點（回應 "pong"）

## 專案結構

```
.
├── src/
│   ├── index.ts                     # 主程式進入點
│   ├── bot.ts                       # Bot 邏輯（混合模式 + Adaptive Card）
│   ├── services/
│   │   └── googleSheetService.ts    # Google Sheets API 服務層
│   ├── utils/
│   │   ├── ticketGenerator.ts       # 工單號碼產生器
│   │   └── dataMapper.ts            # 資料格式轉換工具
│   └── plugins/
│       └── bot-framework.ts         # Fastify Plugin（Bot Framework 整合）
├── dist/                            # 編譯後的 JavaScript (自動生成)
├── env.example                      # 環境變數範本
├── Dockerfile                       # Docker 配置
├── package.json                     # Node.js 依賴
├── tsconfig.json                    # TypeScript 設定
└── README.md                        # 專案說明
```

## 開發路線圖

- [x] Phase 1: 混合模式觸發機制
- [x] Phase 2: Adaptive Card 表單設計
- [x] Phase 3: Command 指令系統
- [x] Phase 4: 表單提交處理與工單號碼產生
- [x] Phase 5: Google Sheets API 整合
- [x] Phase 6: 資料驗證與錯誤處理
- [ ] Phase 7: 查詢與統計功能（未來規劃）
- [ ] Phase 8: 異常代碼自動化（未來規劃）

## License

MIT

