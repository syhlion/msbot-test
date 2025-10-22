# 第一階段：建置階段
FROM golang:1.25-alpine AS builder

# 安裝必要的建置工具
RUN apk add --no-cache git ca-certificates tzdata

# 設定工作目錄
WORKDIR /app

# 複製 go.mod 和 go.sum 並下載依賴
COPY go.mod go.sum ./
RUN GOTOOLCHAIN=auto go mod download

# 複製原始碼
COPY . .

# 建置應用程式（靜態編譯，減少依賴）
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 GOTOOLCHAIN=auto go build -ldflags="-w -s" -o bot-server .

# 第二階段：執行階段
FROM alpine:latest

# 安裝 CA 證書（HTTPS 請求需要）
RUN apk --no-cache add ca-certificates tzdata

# 建立非 root 使用者
RUN addgroup -g 1000 appuser && \
    adduser -D -u 1000 -G appuser appuser

# 設定工作目錄
WORKDIR /home/appuser

# 從建置階段複製編譯好的二進制檔案
COPY --from=builder /app/bot-server .

# 修改擁有者為 appuser
RUN chown -R appuser:appuser /home/appuser

# 切換到非 root 使用者
USER appuser

# 暴露應用程式使用的 Port（Zeabur 會自動設定 PORT 環境變數）
EXPOSE 3978

# 健康檢查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3978}/api/messages || exit 1

# 執行應用程式
CMD ["./bot-server"]

