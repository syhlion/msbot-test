# Bot Test - Microsoft Bot Framework Echo Bot

使用 TypeScript 和官方 Bot Framework SDK 開發的 Echo Bot。

## 功能

- ✅ 回應使用者訊息（Echo）
- ✅ 支援 Microsoft Teams
- ✅ 正確處理各種 Activity 類型
- ✅ 完整的錯誤處理
- ✅ Docker 支援
- ✅ 健康檢查端點

## 技術棧

- **Runtime**: Node.js 20
- **語言**: TypeScript
- **框架**: Bot Framework SDK v4
- **Web Server**: Restify
- **部署**: Docker + Zeabur

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
│   ├── index.ts    # 主程式進入點
│   └── bot.ts      # Bot 邏輯
├── dist/           # 編譯後的 JavaScript (自動生成)
├── Dockerfile      # Docker 配置
├── package.json    # Node.js 依賴
├── tsconfig.json   # TypeScript 設定
└── README.md       # 專案說明
```

## License

MIT

