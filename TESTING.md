# 測試指南

## 本機測試步驟

### 1. 啟動 Bot

```bash
npm run dev
```

應該看到：
```
Bot is running on port 3978
Bot endpoint: http://localhost:3978/api/messages
```

### 2. 使用 Bot Framework Emulator 測試

下載：https://github.com/microsoft/BotFramework-Emulator/releases

#### 測試情境 A：自動觸發模式

1. 連接到 `http://localhost:3978/api/messages`
2. 發送訊息：`@Bot 遊戲商系統 SRE 需要記錄工單`
3. ✅ 應該顯示 Adaptive Card 表單

> **注意**：Bot Framework Emulator 可能不完全支援 mention 功能，建議直接部署到 Teams 測試。

#### 測試情境 B：指令模式

1. 發送：`/record`
2. ✅ 應該顯示 Adaptive Card 表單

3. 發送：`/help`
4. ✅ 應該顯示使用說明

5. 發送：`/unknown`
6. ✅ 應該顯示「未知指令」錯誤

#### 測試情境 C：Echo 模式（預設）

1. 發送：`Hello World`
2. ✅ 應該回應：`Echo: Hello World`

---

## Teams 測試步驟

### 1. 部署到 Azure/Zeabur

確保環境變數設定正確：
- `APP_ID`
- `APP_PASSWORD`
- `APP_TENANT_ID`

### 2. 在 Teams 中測試

#### 測試自動觸發

發送訊息：
```
@SRE Bot 遊戲商系統 SRE 有問題需要記錄
```

**預期結果**：
- 顯示 Adaptive Card 表單
- 包含所有欄位（環境、產品、時間等）
- 有「提交記錄」和「取消」按鈕

#### 測試指令模式

發送：
```
/record
```

**預期結果**：
- 與自動觸發相同的表單

#### 測試關鍵字變化

測試以下變化是否都能觸發：

✅ 應該觸發：
- `@Bot 遊戲商系統 SRE 工單`
- `@Bot 這是 遊戲商系統 的 SRE 問題`

❌ 不應該觸發：
- `@Bot 遊戲商系統` （缺少 SRE）
- `@Bot SRE` （缺少 遊戲商系統）
- `遊戲商系統 SRE` （沒有 tag Bot）

---

## 除錯技巧

### 查看日誌

Bot 會在 console 輸出詳細日誌：

```
處理訊息: @Bot 遊戲商系統 SRE
Mentions: [...]
✅ 觸發 Adaptive Card 表單
```

### 檢查 Adaptive Card 格式

使用 Adaptive Card Designer 預覽：
https://adaptivecards.io/designer/

複製 `bot.ts` 中的 `cardPayload` 物件貼上測試。

---

#### 測試表單提交

1. 在表單中填寫所有必填欄位
2. 點擊「提交記錄」按鈕

**預期結果**：
- ✅ 表單提交成功，不會顯示紅色錯誤訊息
- Bot 回應文字訊息（非卡片）
- 包含自動產生的工單號碼（格式：`SRE-20251030-001`）
- 顯示所有填寫的資訊供確認

**範例回應**：
```
✅ 工單記錄已提交

📋 工單號碼： SRE-20251030-001
👤 提交人： 張小明

📝 工單資訊：

環境/整合商： pgs-prod
產品/遊戲： 老虎機
發現異常時間： 2025-10-30 14:30
發生異常操作： test
UserID 與 注單編號： test
異常分級： P2
異常狀況說明： test

---

請確認以上資訊是否正確。
```

3. 點擊「取消」按鈕

**預期結果**：
- ✅ 取消成功，不會顯示紅色錯誤訊息
- Bot 回應：「已取消工單記錄。」

---

## 已知限制

1. **Bot Framework Emulator**：不完全支援 Teams 特有功能（mention, adaptive card actions）
2. **Google Sheet**：尚未整合（Phase 3）

---

## 下一步開發

✅ **已完成 - Phase 2**：
- ✅ 監聽 `Action.Submit` 事件
- ✅ 解析表單資料
- ✅ 產生工單號碼
- ✅ 回應確認訊息（文字格式）

🚧 **Phase 3 - Google Sheet 整合**：
- 設定 Google API 認證
- 實作寫入功能
- 在表單提交時同步寫入 Google Sheet
- 實作查詢功能

📋 **Phase 4 - 進階功能**：
- 編輯已提交的記錄
- 統計查詢

