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
        reply.hijack();
        let responseSent = false;
        const req = Object.assign(request.raw, {
            body: request.body as Record<string, unknown>
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
                console.log(`Activity type: ${context.activity.type}`);  // 加入日誌
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