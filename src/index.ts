import * as restify from 'restify';
import {
    CloudAdapter,
    ConfigurationServiceClientCredentialFactory,
    ConfigurationBotFrameworkAuthentication,
    TurnContext,
    ActivityTypes
} from 'botbuilder';
import { EchoBot } from './bot';

// 讀取環境變數
const PORT = process.env.PORT || 3978;
const APP_ID = process.env.APP_ID || '';
const APP_PASSWORD = process.env.APP_PASSWORD || '';

// 記錄啟動資訊
console.log(`APP_ID: ${APP_ID}`);
console.log(`APP_PASSWORD: ${APP_PASSWORD ? '****** (hidden)' : 'NOT SET'}`);
console.log(`PORT: ${PORT}`);

// 建立認證配置
const credentialsFactory = new ConfigurationServiceClientCredentialFactory({
    MicrosoftAppId: APP_ID,
    MicrosoftAppPassword: APP_PASSWORD,
    MicrosoftAppType: 'MultiTenant'
});

const botFrameworkAuthentication = new ConfigurationBotFrameworkAuthentication(
    {},
    credentialsFactory
);

// 建立 Adapter
const adapter = new CloudAdapter(botFrameworkAuthentication);

// 錯誤處理
adapter.onTurnError = async (context: TurnContext, error: Error) => {
    console.error(`\n [onTurnError] 發生未處理的錯誤: ${error}`);
    console.error(error.stack);

    // 發送錯誤訊息給使用者
    await context.sendActivity('Bot 遇到錯誤或問題。');
};

// 建立 Bot 實例
const bot = new EchoBot();

// 建立 HTTP 伺服器
const server = restify.createServer();
server.use(restify.plugins.bodyParser());

// 健康檢查端點
server.get('/api/ping', (req, res) => {
    res.send(200, 'pong');
});

// Bot 訊息端點
server.post('/api/messages', async (req, res) => {
    console.log(`收到請求: ${req.method} ${req.url}`);
    console.log(`來源: ${req.connection.remoteAddress}`);
    
    await adapter.process(req, res, async (context) => {
        // 記錄 activity 類型
        console.log(`Activity type: ${context.activity.type}`);
        
        // 處理不同類型的 activity
        if (context.activity.type === ActivityTypes.Message) {
            await bot.run(context);
        } else if (context.activity.type === ActivityTypes.ConversationUpdate) {
            console.log('ConversationUpdate activity (ignored)');
        } else if (context.activity.type === ActivityTypes.Typing) {
            console.log('Typing activity (ignored)');
        } else {
            console.log(`未處理的 activity type: ${context.activity.type}`);
        }
    });
});

// 啟動伺服器
server.listen(PORT, () => {
    console.log(`\n${server.name} listening on port ${PORT}`);
    console.log(`Bot endpoint: http://localhost:${PORT}/api/messages`);
});

