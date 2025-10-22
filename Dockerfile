# 第一階段：建置階段
FROM node:20-alpine AS builder

# 設定工作目錄
WORKDIR /app

# 複製 package.json
COPY package.json ./

# 安裝所有依賴（包含 devDependencies 用於建置）
RUN npm install && npm cache clean --force

# 複製 TypeScript 設定和原始碼
COPY tsconfig.json ./
COPY src ./src

# 建置 TypeScript
RUN npm run build

# 移除 devDependencies，只保留 production 依賴
RUN npm prune --production

# 第二階段：執行階段
FROM node:20-alpine

# 安裝 dumb-init (正確處理訊號)
RUN apk add --no-cache dumb-init

# 建立非 root 使用者
RUN addgroup -g 1000 appuser && \
    adduser -D -u 1000 -G appuser appuser

# 設定工作目錄
WORKDIR /home/appuser/app

# 從建置階段複製檔案
COPY --from=builder --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appuser /app/dist ./dist
COPY --from=builder --chown=appuser:appuser /app/package.json ./

# 切換到非 root 使用者
USER appuser

# 暴露應用程式使用的 Port
EXPOSE 3978

# 健康檢查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+process.env.PORT+'/api/ping', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# 使用 dumb-init 啟動應用程式
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
