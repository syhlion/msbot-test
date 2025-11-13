import { ActivityHandler, TurnContext, MessageFactory, TeamsInfo } from 'botbuilder';
import { getChannelConfig, hasRequiredKeywords, channelConfigs } from './config/channelConfig';
import { BaseChannelHandler } from './handlers/BaseChannelHandler';
import { IssueChannelHandler } from './handlers/IssueChannelHandler';
import { RequirementChannelHandler } from './handlers/RequirementChannelHandler';

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

                // 根據表單類型路由到對應的 Handler
                const formType = submitData.formType || 'issue'; // 預設為異常單
                console.log(`[INFO] 表單類型: ${formType}`);
                
                let handlerKey = '異常';
                if (formType === 'requirement') {
                    handlerKey = '需求';
                }
                
                const handler = this.channelHandlers.get(handlerKey);
                if (handler) {
                    console.log(`[OK] 路由到 ${handlerKey} Handler`);
                    await handler.handleFormSubmit(context, submitData);
                } else {
                    console.error(`[ERROR] 找不到對應的 Handler: ${handlerKey}`);
                }
                return;
            }

            // 處理一般訊息
            const userMessage = context.activity.text || '';
            
            // 使用 TeamsInfo API 取得頻道名稱
            const channelData = context.activity.channelData || {};
            let channelName = '';
            
            if (!channelData.teamsTeamId || !channelData.teamsChannelId) {
                console.log('[ERROR] 缺少 Team ID 或 Channel ID,無法呼叫 TeamsInfo API');
                await next();
                return;
            }
            
            try {
                console.log('[INFO] 使用 TeamsInfo API 取得頻道名稱...');
                console.log(`[INFO] Team ID: ${channelData.teamsTeamId}`);
                console.log(`[INFO] Channel ID: ${channelData.teamsChannelId}`);
                
                const channels = await TeamsInfo.getTeamChannels(context, channelData.teamsTeamId);
                console.log(`[INFO] 取得 ${channels.length} 個頻道`);
                
                const currentChannel = channels.find(ch => ch.id === channelData.teamsChannelId);
                if (!currentChannel) {
                    console.log(`[ERROR] 在團隊的 ${channels.length} 個頻道中找不到 ID: ${channelData.teamsChannelId}`);
                    console.log(`[DEBUG] 可用的頻道:`, JSON.stringify(channels.map(ch => ({ id: ch.id, name: ch.name })), null, 2));
                    await next();
                    return;
                }
                
                if (!currentChannel.name) {
                    console.log(`[ERROR] 頻道物件沒有 name 欄位:`, JSON.stringify(currentChannel, null, 2));
                    console.log(`[ERROR] 無法取得頻道名稱,Bot 無法運作`);
                    await next();
                    return;
                }
                
                channelName = currentChannel.name;
                
                console.log(`[OK] TeamsInfo API 成功取得頻道名稱: "${channelName}"`);
                
            } catch (error: any) {
                console.error('[ERROR] TeamsInfo API 呼叫失敗:', error?.message || error);
                console.error('[ERROR] 完整錯誤:', error);
                await next();
                return;
            }
            
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

            // 根據頻道名稱找到對應的配置
            const config = getChannelConfig(channelName);
            
            if (!config) {
                console.log(`[跳過] 頻道「${channelName}」沒有對應的配置`);
                console.log(`[提示] 請確認頻道名稱是否包含配置中的關鍵字: ${channelConfigs.map(c => c.name).join(', ')}`);
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
        const issueConfig = channelConfigs.find(c => c.name === '*異常*');
        if (issueConfig) {
            const issueHandler = new IssueChannelHandler(issueConfig);
            this.channelHandlers.set('異常', issueHandler);
            console.log(`[OK] 已註冊 Handler: 異常`);
        }
        
        // 註冊需求管理 Handler
        const requirementConfig = channelConfigs.find(c => c.name === '*需求*');
        if (requirementConfig) {
            const requirementHandler = new RequirementChannelHandler(requirementConfig);
            this.channelHandlers.set('需求', requirementHandler);
            console.log(`[OK] 已註冊 Handler: 需求`);
        }
        
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
