import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import botFrameworkPlugin from './plugins/bot-framework';
import dotenv from 'dotenv';

const PORT = parseInt(process.env.PORT || '3978', 10);
const app = Fastify({ logger: true });
//health check
app.get('/api/ping', (request, reply) => {
    reply.send('pong');
});



const start = async () => {
    try {
        await app.register(botFrameworkPlugin, {
            appId: process.env.APP_ID || '',
            appPassword: process.env.APP_PASSWORD || '',
            appTenantId: process.env.APP_TENANT_ID || ''
        });
        await app.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`Bot is running on port ${PORT}`);
    } catch (error) {
        console.error('Error starting the server:', error);
        process.exit(1);
    }
}

start();