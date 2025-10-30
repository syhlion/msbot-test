# 變更日誌

## [Phase 2.1] 2025-10-30 - 新增提交人記錄

### 新增功能 ✨

#### 提交人資訊記錄
- 🎯 功能：自動擷取並記錄提交人名稱
- 📊 資料來源：從 `context.activity.from.name` 取得使用者名稱
- 🔄 備援機制：如果無法取得名稱，則使用 User ID 或顯示「未知使用者」
- 📝 顯示位置：在確認訊息中顯示提交人名稱（工單號碼下方）

### 技術實作 🔧

**修改內容**：
1. `RecordFormData` 介面新增 `submitter` 欄位
2. `handleRecordSubmit()` 方法中擷取提交人資訊
3. `formatConfirmationMessage()` 方法中顯示提交人名稱

**程式碼片段**：
```typescript
// 取得提交人資訊
const submitterName = context.activity.from.name || context.activity.from.id || '未知使用者';
```

### 使用者體驗 🎯

**確認訊息現在包含**：
- 📋 工單號碼
- 👤 提交人名稱（新增）
- 📝 完整工單資訊

---

## [Phase 2] 2025-10-30 - 表單提交處理

### 新增功能 ✨

#### 1. 工單號碼產生器
- 📁 新增檔案：`src/utils/ticketGenerator.ts`
- 🎯 功能：自動產生唯一的工單號碼
- 📋 格式：`SRE-YYYYMMDD-XXX`（例如：`SRE-20251030-001`）
- 🔄 特性：
  - 每日自動重置計數器
  - 三位數流水號（001-999）
  - 可重置計數器（用於測試）

#### 2. 表單提交事件處理
- 📝 修改檔案：`src/bot.ts`
- 新增功能：
  - 監聽 `Action.Submit` 事件
  - 解析 Adaptive Card 表單資料
  - 處理「提交記錄」和「取消」兩種操作
  - 錯誤處理機制

#### 3. 格式化回應訊息
- 🎨 實作功能：
  - 以文字訊息（非卡片）回應使用者
  - 顯示自動產生的工單號碼
  - 完整呈現所有填寫資訊
  - 提示使用者 double check 資料
  - 選填欄位智慧顯示（有填寫才顯示）

### 技術細節 🔧

#### 新增介面定義
```typescript
interface RecordFormData {
    environment: string;
    product: string;
    issueDate: string;
    issueTime: string;
    operation: string;
    userId?: string;
    severity: string;
    description?: string;
}
```

#### 主要方法
- `handleRecordSubmit()`: 處理表單提交
- `formatConfirmationMessage()`: 格式化確認訊息
- `generateTicketNumber()`: 產生工單號碼

### 使用者體驗 🎯

**提交流程**：
1. 使用者填寫表單
2. 點擊「提交記錄」
3. Bot 立即回應確認訊息
4. 顯示工單號碼和所有資訊供確認

**取消流程**：
1. 使用者點擊「取消」
2. Bot 回應：「已取消工單記錄。」

### 文件更新 📚

- ✅ 更新 `README.md`：新增功能說明和範例回應
- ✅ 更新 `TESTING.md`：新增表單提交測試指南
- ✅ 新增 `CHANGELOG.md`：完整記錄變更

### 下一步計畫 🚀

**Phase 3 - Google Sheet 整合**（待開發）：
- 設定 Google API 認證
- 實作 Google Sheet 寫入功能
- 在表單提交時同步寫入資料
- 實作查詢功能

**Phase 4 - 進階功能**（規劃中）：
- 編輯已提交的記錄
- 統計查詢
- 匯出報表

---

## [Phase 1] 2025-10-29 - 初始版本

### 功能
- ✅ 混合模式觸發（Tag + 關鍵字）
- ✅ Adaptive Card 互動式表單
- ✅ Command 指令支援（/record, /help）
- ✅ 支援 Microsoft Teams
- ✅ Docker 支援

