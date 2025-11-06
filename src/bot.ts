import { ActivityHandler, TurnContext, MessageFactory } from 'botbuilder';
import { getChannelConfig, hasRequiredKeywords, channelConfigs } from './config/channelConfig';
import { BaseChannelHandler } from './handlers/BaseChannelHandler';
import { IssueChannelHandler } from './handlers/IssueChannelHandler';

/**
 * Bot 路由器
 * 根據頻道配置將訊息路由到對應的 Handler
 */
export class EchoBot extends ActivityHandler {
    // Handler 註冊表: channelName -> Handler instance
    private channelHandlers = new Map<string, BaseChannelHandler>();

    constructor() {
        super();
        
        // 註冊 Handler
        this.registerHandlers();

        // 處理訊息
        this.onMessage(async (context: TurnContext, next) => {
            // 處理表單提交
            if (context.activity.value) {
                console.log('='.repeat(50));
                console.log('收到表單提交');
                console.log('='.repeat(50));

                const submitData = context.activity.value;
                
                // 檢查是否為取消操作
                if (submitData.action === 'cancel') {
                    await context.sendActivity('已取消操作');
                    return;
                }

                // 路由到對應的 Handler
                // TODO: 未來需要根據表單類型路由到不同 Handler
                const handler = this.channelHandlers.get('異常');
                if (handler) {
                    await handler.handleFormSubmit(context, submitData);
                }
                return;
            }

            // 處理一般訊息
            const userMessage = context.activity.text || '';
            
            // 嘗試從多個地方取得頻道名稱
            const channelData = context.activity.channelData || {};
            const channelName = channelData.channel?.name || 
                               channelData.teamsChannelId || 
                               context.activity.conversation?.name || 
                               '';
            
            console.log('='.repeat(50));
            console.log(`收到訊息: ${userMessage}`);
            console.log(`頻道名稱: ${channelName}`);
            console.log(`[DEBUG] Channel Data:`, JSON.stringify({
                channelName: channelData.channel?.name,
                channelId: channelData.channel?.id,
                teamsChannelId: channelData.teamsChannelId,
                teamsTeamId: channelData.teamsTeamId,
                teamName: channelData.team?.name,
                conversationName: context.activity.conversation?.name,
                conversationId: context.activity.conversation?.id,
                conversationType: context.activity.conversation?.conversationType
            }, null, 2));
            
            // 輸出完整的 channelData 以便除錯
            console.log(`[DEBUG] 完整 channelData:`, JSON.stringify(channelData, null, 2));
            console.log('='.repeat(50));

            // 根據頻道名稱或頻道 ID 找到對應的配置
            const channelId = channelData.teamsChannelId || channelData.channel?.id || '';
            const config = getChannelConfig(channelName, channelId);
            
            if (!config) {
                console.log(`[跳過] 頻道「${channelName}」(ID: ${channelId}) 沒有對應的配置`);
                console.log(`[提示] 請確認頻道名稱是否包含配置中的關鍵字: ${channelConfigs.map(c => c.name).join(', ')}`);
                console.log(`[提示] 或者將此頻道 ID 加入白名單: allowedChannelIds: ['${channelId}']`);
                await next();
                return;
            }

            console.log(`[匹配] 頻道「${channelName}」→ 配置「${config.name}」`);

            // 檢查是否包含必要的關鍵字
            if (!hasRequiredKeywords(userMessage, config.keywords)) {
                console.log(`[跳過] 訊息不包含必要關鍵字: ${config.keywords.join(' AND ')}`);
                await next();
                return;
            }

            console.log(`[OK] 關鍵字匹配成功`);

            // 路由到對應的 Handler
            const handler = this.channelHandlers.get(config.name);
            if (handler) {
                await handler.handle(context, userMessage);
            } else {
                console.log(`[錯誤] 找不到 Handler: ${config.name}`);
            }

            await next();
        });

        // 處理成員加入 (只在 Bot 被安裝時顯示歡迎訊息)
        this.onMembersAdded(async (context: TurnContext, next) => {
            const membersAdded = context.activity.membersAdded || [];
            
            for (const member of membersAdded) {
                // 只有當 Bot 自己被加入時才顯示歡迎訊息
                if (member.id === context.activity.recipient.id) {
                    console.log(`Bot 被安裝到: ${context.activity.conversation?.name || 'unknown'}`);
                    const welcomeText = this.generateWelcomeMessage();
                    await context.sendActivity(MessageFactory.text(welcomeText));
                }
            }

            await next();
        });
    }

    /**
     * 註冊所有 Handler
     */
    private registerHandlers(): void {
        console.log('[初始化] 註冊 Handler...');
        
        // 註冊異常處理 Handler
        const issueConfig = channelConfigs.find(c => c.name === '異常');
        if (issueConfig) {
            const issueHandler = new IssueChannelHandler(issueConfig);
            this.channelHandlers.set('異常', issueHandler);
            console.log(`[OK] 已註冊 Handler: 異常`);
        }
        
        // 未來擴充範例:
        // const requirementConfig = channelConfigs.find(c => c.name === '需求');
        // if (requirementConfig) {
        //     const requirementHandler = new RequirementChannelHandler(requirementConfig);
        //     this.channelHandlers.set('需求', requirementHandler);
        //     console.log(`[OK] 已註冊 Handler: 需求`);
        // }
        
        console.log(`[初始化完成] 共註冊 ${this.channelHandlers.size} 個 Handler`);
    }

    /**
     * 產生歡迎訊息
     */
    private generateWelcomeMessage(): string {
        let message = '歡迎使用工單記錄 Bot\n\n';
        message += '使用方式：\n';
        
        channelConfigs.forEach((config, index) => {
            message += `${index + 1}. 在「${config.name}」相關頻道中,提到「${config.keywords.join('」和「')}」即可觸發\n`;
            if (config.description) {
                message += `   (${config.description})\n`;
            }
        });
        
        message += '\n✨ Bot 支援自動解析表格或手動填寫表單';
        
        return message;
    }
}
