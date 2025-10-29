# SRE 工單記錄 Bot - Microsoft Bot Framework

使用 TypeScript 和官方 Bot Framework SDK 開發的 SRE 工單記錄系統。

## 功能

- ✅ **混合模式觸發**：Tag Bot + 關鍵字自動顯示表單
- ✅ **Adaptive Card 互動式表單**：美觀且易用的工單填寫介面
- ✅ **Command 指令支援**：`/record`, `/help` 等指令
- ✅ 支援 Microsoft Teams
- ✅ 完整的錯誤處理
- ✅ Docker 支援
- ✅ 健康檢查端點
- 🚧 Google Sheet 整合（開發中）

## 技術棧

- **Runtime**: Node.js 20
- **語言**: TypeScript
- **框架**: Bot Framework SDK v4
- **Web Server**: Fastify
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
- **產品/遊戲** *（必填）*：例如「老虎機」
- **發現異常時間** *（必填）*：例如「2025-10-29 10:00」
- **發生異常操作** *（必填）*：描述操作
- **UserID 與 注單編號**（選填）
- **異常分級** *（必填）*：P0(緊急), P1(高), P2(中), P3(低)
- **異常狀況說明**（選填）：詳細描述

## 本地開發

### 1. 安裝依賴

```bash
npm install
```

### 2. 設定環境變數

複製 `.env.example` 為 `.env` 並填入你的設定：

```bash
APP_ID=your-app-id
APP_PASSWORD=your-app-password
PORT=3978
```

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

## API 端點

- `POST /api/messages` - Bot 訊息處理端點
- `GET /api/ping` - 健康檢查端點（回應 "pong"）

## 專案結構

```
.
├── src/
│   ├── index.ts                  # 主程式進入點
│   ├── bot.ts                    # Bot 邏輯（混合模式 + Adaptive Card）
│   └── plugins/
│       └── bot-framework.ts      # Fastify Plugin（Bot Framework 整合）
├── dist/                         # 編譯後的 JavaScript (自動生成)
├── Dockerfile                    # Docker 配置
├── package.json                  # Node.js 依賴
├── tsconfig.json                 # TypeScript 設定
└── README.md                     # 專案說明
```

## 開發路線圖

- [x] Phase 1: 混合模式觸發機制
- [x] Phase 1: Adaptive Card 表單設計
- [x] Phase 1: Command 指令系統
- [ ] Phase 2: 表單提交處理
- [ ] Phase 3: Google Sheet API 整合
- [ ] Phase 4: 資料驗證與錯誤處理
- [ ] Phase 5: 查詢與統計功能

## License

MIT

