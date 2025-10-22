import { ActivityHandler, TurnContext, MessageFactory } from 'botbuilder';

/**
 * Echo Bot - 回應使用者訊息
 */
export class EchoBot extends ActivityHandler {
    constructor() {
        super();

        // 處理訊息
        this.onMessage(async (context: TurnContext, next) => {
            const userMessage = context.activity.text;
            console.log(`處理訊息: ${userMessage}`);

            const replyText = `Echo: ${userMessage}`;
            await context.sendActivity(MessageFactory.text(replyText));

            // 繼續處理下一個中間件
            await next();
        });

        // 處理成員加入
        this.onMembersAdded(async (context: TurnContext, next) => {
            const membersAdded = context.activity.membersAdded || [];
            
            for (const member of membersAdded) {
                if (member.id !== context.activity.recipient.id) {
                    console.log(`新成員加入: ${member.name || member.id}`);
                    const welcomeText = '歡迎使用 Echo Bot！發送任何訊息，我會回應你。';
                    await context.sendActivity(MessageFactory.text(welcomeText));
                }
            }

            await next();
        });
    }
}

