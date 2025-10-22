import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import {
    CloudAdapter,
    ConfigurationServiceClientCredentialFactory,
    ConfigurationBotFrameworkAuthentication,
    TurnContext,
    ActivityTypes
} from 'botbuilder';
import { EchoBot } from './bot';

// 讀取環境變數
const PORT = parseInt(process.env.PORT || '3978', 10);
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

// 建立 Fastify 伺服器
const app = Fastify({
    logger: true
});

// 健康檢查端點
app.get('/api/ping', async (request: FastifyRequest, reply: FastifyReply) => {
    return { status: 'ok', message: 'pong' };
});

// Bot 訊息端點
app.post('/api/messages', async (request: FastifyRequest, reply: FastifyReply) => {
    console.log(`收到請求: ${request.method} ${request.url}`);
    console.log(`來源: ${request.ip}`);
    
    // 建立 Bot Framework 相容的 request/response wrapper
    const req = Object.assign(request.raw, {
        body: request.body as Record<string, unknown>
    }) as any;
    
    const res = Object.assign(reply.raw, {
        status: (code: number) => {
            reply.code(code);
            return res;
        },
        send: (body: any) => {
            reply.send(body);
            return res;
        },
        header: (name: string, value: string) => {
            reply.header(name, value);
            return res;
        }
    });
    
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
    
    // 告訴 Fastify 不要自動發送回應（Bot Adapter 已經處理了）
    reply.sent = true;
});

// 啟動伺服器
const start = async () => {
    try {
        await app.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`\nServer listening on port ${PORT}`);
        console.log(`Bot endpoint: http://localhost:${PORT}/api/messages`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();

