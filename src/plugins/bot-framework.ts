import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { CloudAdapter, ConfigurationServiceClientCredentialFactory, ConfigurationBotFrameworkAuthentication, TurnContext, ActivityTypes } from 'botbuilder';
import { EchoBot } from "../bot";
interface BotFrameworkOptions {
    appId: string;
    appPassword: string;
    appTenantId: string;
}

const botFrameworkPlugin: FastifyPluginAsync<BotFrameworkOptions> = async (fastify, options) => {
    const { appId, appPassword, appTenantId } = options;

    const credentialsFactory = new ConfigurationServiceClientCredentialFactory({
        MicrosoftAppId: appId,
        MicrosoftAppPassword: appPassword,
        MicrosoftAppType: 'SingleTenant',
        MicrosoftAppTenantId: appTenantId
    });
    const botFrameworkAuthentication = new ConfigurationBotFrameworkAuthentication(
        {},
        credentialsFactory
    );
    const adapter = new CloudAdapter(botFrameworkAuthentication);
    adapter.onTurnError = async (context: TurnContext, error: Error) => {
        console.error(`\n [onTurnError] 發生未處理的錯誤: ${error}`);
        console.error(error.stack);
        await context.sendActivity('Bot 遇到錯誤或問題。');
    };

    const bot = new EchoBot();
    fastify.decorate('bot', bot);
    fastify.decorate('adapter', adapter);
    fastify.post('/api/messages', async (request, reply) => {
        const requestBody = request.body as Record<string, unknown>;
        
        // 檢查是否為 Adaptive Card 提交（有 value 屬性）
        const isCardSubmit = requestBody.type === 'message' && requestBody.value;
        
        if (isCardSubmit) {
            console.log('[Fastify] 檢測到 Adaptive Card 提交，使用快速回應模式');
            
            // 立即返回 202 Accepted
            reply.code(202).send();
            
            // 異步處理 Bot 邏輯
            adapter.process(request.raw, {
                status: () => ({ send: () => {}, end: () => {}, header: () => ({}) }),
                send: () => {},
                end: () => {}
            } as any, async (context) => {
                console.log(`[Async] Activity type: ${context.activity.type}`);
                try {
                    await bot.run(context);
                } catch (error) {
                    console.error('[Async] Bot 處理錯誤:', error);
                }
            }).catch(error => {
                console.error('[Async] Adapter 處理錯誤:', error);
            });
            
            return;
        }
        
        // 一般訊息：使用原本的處理方式
        reply.hijack();
        let responseSent = false;
        const req = Object.assign(request.raw, {
            body: requestBody
        });
        const res = Object.assign(reply.raw, {
            status: (code: number) => {
                if (!responseSent) {
                    reply.code(code);
                }
                return res;
            },
            send: (body: any) => {
                if (!responseSent) {
                    responseSent = true;
                    reply.send(body);
                }
                return res;
            },
            header: (name: string, value: string) => {
                if (!responseSent) {
                    reply.header(name, value);
                }
                return res;
            },
            end: () => {
                if (!responseSent) {
                    responseSent = true;
                    reply.raw.end();
                }
            }
        });
        try {
            await adapter.process(req, res, async (context) => {
                console.log(`Activity type: ${context.activity.type}`);
                console.log(`Activity name: ${context.activity.name}`);
                console.log(`Has value: ${!!context.activity.value}`);
                
                await bot.run(context);
            });
        } catch (error) {
            console.error('Bot adapter 處理錯誤:', error);
            if (!responseSent) {
                responseSent = true;
                reply.code(500).send({ error: 'Internal Server Error' });
            }   
        }
    });
}

export default fp(botFrameworkPlugin, {
    name: 'bot-framework',
    dependencies: []
});