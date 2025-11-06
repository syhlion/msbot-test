import { ActivityHandler, TurnContext, MessageFactory, CardFactory, Attachment } from 'botbuilder';
import { generateTicketNumber } from './utils/ticketGenerator';
import { googleSheetService } from './services/googleSheetService';
import { mapFormDataToSheetRow } from './utils/dataMapper';

/**
 * 表單資料介面
 */
interface RecordFormData {
    environment: string;
    product: string;
    issueDate: string;
    issueTime: string;
    operation: string;
    userId?: string;           // UserID（獨立欄位）
    betOrderId?: string;       // 注單編號（獨立欄位）
    errorCode?: string;        // 錯誤代碼（選填）
    severity: string;
    description?: string;
    submitter?: string;        // 提交人名稱
}

/**
 * SRE 工單記錄 Bot - 支援混合模式
 */
export class EchoBot extends ActivityHandler {
    // 儲存原始訊息連結的 Map: conversationId -> messageLink
    private messageLinksCache = new Map<string, string>();

    constructor() {
        super();

        // 處理訊息
        this.onMessage(async (context: TurnContext, next) => {
            // 檢查是否為 Adaptive Card 提交（通過 message 活動）
            if (context.activity.value) {
                console.log('='.repeat(50));
                console.log('收到表單提交 (via message)');
                console.log('提交資料:', JSON.stringify(context.activity.value, null, 2));
                console.log('='.repeat(50));

                const submitData = context.activity.value;
                
                // 檢查是否為取消操作
                if (submitData.action === 'cancel') {
                    await context.sendActivity('已取消工單記錄。');
                    return;
                }

                // 處理提交記錄（同步處理，但不等待 next）
                if (submitData.action === 'submitRecord') {
                    await this.handleRecordSubmit(context, submitData);
                    return;
                }
            }

            const userMessage = context.activity.text || '';
            
            console.log('='.repeat(50));
            console.log(`收到訊息: ${userMessage}`);
            console.log(`對話類型: ${context.activity.conversation?.conversationType || 'unknown'}`);
            
            // 記錄 channelData 以便除錯連結生成
            if (context.activity.channelData) {
                console.log(`Channel Data:`, JSON.stringify(context.activity.channelData, null, 2));
            }

            // 檢查是否包含觸發關鍵字 (需要同時包含「遊戲商系統」和「SRE」)
            const hasGameSystem = userMessage.includes('遊戲商系統');
            const hasSRE = userMessage.toLowerCase().includes('sre');
            const hasBothKeywords = hasGameSystem && hasSRE;
            
            console.log(`包含關鍵字: 遊戲商系統=${hasGameSystem}, SRE=${hasSRE}, 兩者都有=${hasBothKeywords}`);
            console.log('='.repeat(50));

            // 如果包含關鍵字,處理工單
            if (hasBothKeywords) {
                // Plan 1: 優先嘗試自動建單 (如果訊息包含足夠資訊)
                if (userMessage.length > 50) {
                    console.log('[INFO] 嘗試自動建單模式...');
                    const autoCreateResult = await this.tryAutoCreateIssue(context, userMessage);
                    if (autoCreateResult) {
                        console.log('[OK] 自動建單成功');
                        await next();
                        return;
                    }
                    console.log('[INFO] 自動建單失敗,切換到表單模式');
                }
                
                // Plan 2: 如果無法自動建單,顯示表單讓使用者手動填寫
                console.log('[OK] 觸發 Adaptive Card 表單 (手動填寫模式)');
                
                // 在發送表單前,先建立並快取訊息連結
                const messageLink = this.buildTeamsMessageLink(context);
                const conversationId = context.activity.conversation?.id || '';
                if (messageLink && conversationId) {
                    this.messageLinksCache.set(conversationId, messageLink);
                    console.log(`[INFO] 已快取訊息連結: ${messageLink}`);
                }
                
                await this.sendRecordForm(context);
                await next();
                return;
            }

            // 不包含關鍵字的訊息不回應 (移除 Echo 模式)
            await next();
        });

        // 處理成員加入 (只在 Bot 被安裝時顯示歡迎訊息)
        this.onMembersAdded(async (context: TurnContext, next) => {
            const membersAdded = context.activity.membersAdded || [];
            
            for (const member of membersAdded) {
                // 只有當 Bot 自己被加入時才顯示歡迎訊息
                if (member.id === context.activity.recipient.id) {
                    console.log(`Bot 被安裝到: ${context.activity.conversation?.name || 'unknown'}`);
                    const welcomeText = `歡迎使用 SRE 工單記錄 Bot\n\n` +
                        `使用方式：\n` +
                        `方式 1: 在訊息中同時提到「遊戲商系統」和「SRE」觸發表單\n` +
                        `  範例: 遊戲商系統 SRE 異常回報\n\n` +
                        `方式 2: 直接貼上包含環境、異常分級的訊息,Bot 會自動建單\n` +
                        `  必要資訊: pgs-prod/pgs-stage + P0/P1/P2/P3\n` +
                        `  範例: pgs-prod 老虎機 P2 異常`;
                    await context.sendActivity(MessageFactory.text(welcomeText));
                }
            }

            await next();
        });
    }


    /**
     * Plan 1: 嘗試自動解析訊息內容並建立工單
     */
    private async tryAutoCreateIssue(context: TurnContext, message: string): Promise<boolean> {
        try {
            console.log('[INFO] 嘗試自動解析訊息內容...');
            
            // 解析訊息中的關鍵資訊
            const parsedData = this.parseMessageContent(message);
            
            // 檢查是否有足夠的資訊自動建單
            if (!parsedData.environment || !parsedData.severity) {
                console.log('[INFO] 資訊不足,無法自動建單');
                return false;
            }
            
            console.log('[OK] 偵測到足夠資訊,自動建立工單');
            console.log('[INFO] 解析結果:', JSON.stringify(parsedData, null, 2));
            
            // 取得提交人資訊
            const submitterName = context.activity.from.name || context.activity.from.id || '未知使用者';
            
            // 產生工單號碼
            const ticketNumber = generateTicketNumber();
            console.log(`[OK] 產生工單號碼: ${ticketNumber}`);
            
            // 建立 Teams 訊息連結
            const issueLink = this.buildTeamsMessageLink(context);
            
            // 準備表單資料
            const recordData: RecordFormData = {
                environment: parsedData.environment,
                product: parsedData.product || '其他',
                issueDate: parsedData.issueDate || new Date().toISOString().split('T')[0],
                issueTime: parsedData.issueTime || new Date().toTimeString().split(' ')[0].substring(0, 5),
                operation: parsedData.operation || message.substring(0, 500), // 使用原始訊息作為操作描述
                userId: parsedData.userId,
                betOrderId: parsedData.betOrderId,
                errorCode: parsedData.errorCode,
                severity: parsedData.severity,
                submitter: submitterName
            };
            
            // 寫入 Google Sheets
            if (googleSheetService.isEnabled()) {
                console.log('[INFO] 開始寫入 Google Sheets...');
                const sheetRowData = mapFormDataToSheetRow(ticketNumber, recordData, issueLink);
                
                try {
                    await googleSheetService.appendRow(sheetRowData);
                    console.log(`[OK] Google Sheets 寫入成功: ${ticketNumber}`);
                    
                    // 顯示確認卡片
                    await this.sendConfirmationCard(context, ticketNumber, recordData);
                    return true;
                    
                } catch (sheetError: any) {
                    console.error(`[ERROR] Google Sheets 寫入失敗: ${sheetError}`);
                    await context.sendActivity(`❌ 自動建單失敗: ${sheetError.message}`);
                    return false;
                }
            }
            
            return false;
            
        } catch (error) {
            console.error('[ERROR] 自動建單失敗:', error);
            return false;
        }
    }
    
    /**
     * 解析訊息內容,提取關鍵資訊
     * 支援固定表格格式的解析
     */
    private parseMessageContent(message: string): Partial<RecordFormData> & { environment?: string; severity?: string } {
        const result: Partial<RecordFormData> & { environment?: string; severity?: string } = {};
        
        console.log('[INFO] 開始解析訊息內容...');
        
        // 解析環境/整合商 (支援表格格式: "環境/整合商 * pgs-prod / 1xbet" 或 "環境/整合商: pgs-prod")
        // 使用更寬鬆的正則表達式,支援星號和多種分隔符
        const envMatch = message.match(/環境[\/\s]*整合商[*\s:：]*([^\n]+)/i);
        if (envMatch) {
            const envText = envMatch[1].trim();
            console.log(`[解析 DEBUG] 找到環境欄位內容: "${envText}"`);
            if (envText.includes('pgs-prod')) result.environment = 'pgs-prod';
            else if (envText.includes('pgs-stage')) result.environment = 'pgs-stage';
            else if (envText.includes('1xbet')) result.environment = '1xbet';
            console.log(`[解析] 環境/整合商: ${result.environment}`);
        } else {
            // Fallback: 直接搜尋關鍵字
            console.log('[解析 DEBUG] 未找到環境欄位,使用 Fallback 搜尋');
            if (message.includes('pgs-prod')) result.environment = 'pgs-prod';
            else if (message.includes('pgs-stage')) result.environment = 'pgs-stage';
            else if (message.includes('1xbet')) result.environment = '1xbet';
            if (result.environment) {
                console.log(`[解析] 環境/整合商 (Fallback): ${result.environment}`);
            }
        }
        
        // 解析產品/遊戲 (支援表格格式: "產品/遊戲 * 老虎機 /" 或 "產品/遊戲: 老虎機")
        const productMatch = message.match(/產品[\/\s]*遊戲[*\s:：]*([^\n]+)/i);
        if (productMatch) {
            const productText = productMatch[1].trim();
            if (productText.includes('老虎機')) result.product = '老虎機';
            else if (productText.includes('棋牌')) result.product = '棋牌';
            else if (productText.includes('魚機')) result.product = '魚機';
            if (result.product) {
                console.log(`[解析] 產品/遊戲: ${result.product}`);
            }
        } else {
            // Fallback
            if (message.includes('老虎機')) result.product = '老虎機';
            else if (message.includes('棋牌')) result.product = '棋牌';
            else if (message.includes('魚機')) result.product = '魚機';
        }
        
        // 解析發現異常時間 (支援表格格式: "發現異常時間 * 2025-10-29 10:00")
        const issueTimeMatch = message.match(/發[現生][異常]*時間[*\s:：]*(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/i);
        if (issueTimeMatch) {
            result.issueDate = `${issueTimeMatch[1]}-${issueTimeMatch[2]}-${issueTimeMatch[3]}`;
            result.issueTime = `${issueTimeMatch[4]}:${issueTimeMatch[5]}`;
            console.log(`[解析] 發現異常時間: ${result.issueDate} ${result.issueTime}`);
        } else {
            // Fallback: 一般日期時間格式
            const dateTimeMatch = message.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
            if (dateTimeMatch) {
                result.issueDate = `${dateTimeMatch[1]}-${dateTimeMatch[2]}-${dateTimeMatch[3]}`;
                result.issueTime = `${dateTimeMatch[4]}:${dateTimeMatch[5]}`;
            }
        }
        
        // 解析 UserID 與 注單編號 (支援表格格式: "UserID 與 注單編號: 792f88d3-...")
        const userIdMatch = message.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
        if (userIdMatch) {
            result.userId = userIdMatch[0];
            console.log(`[解析] UserID: ${result.userId}`);
        }
        
        const betOrderMatch = message.match(/bet[0-9]+/i);
        if (betOrderMatch) {
            result.betOrderId = betOrderMatch[0];
            console.log(`[解析] 注單編號: ${result.betOrderId}`);
        }
        
        // 解析異常代碼 (支援表格格式: "異常代碼 * ERR3331" 或留空)
        const errorCodeMatch = message.match(/異常代碼[*\s:：]*([A-Z0-9_]+)/i);
        if (errorCodeMatch && errorCodeMatch[1].trim()) {
            result.errorCode = errorCodeMatch[1].trim();
            console.log(`[解析] 異常代碼: ${result.errorCode}`);
        } else {
            // Fallback: 搜尋 ERR 或 _ERROR 格式
            const fallbackMatch = message.match(/ERR[0-9A-Z_]+|[A-Z_]+_ERROR|RS_ERROR[A-Z_]*/i);
            if (fallbackMatch) {
                result.errorCode = fallbackMatch[0];
                console.log(`[解析] 異常代碼 (Fallback): ${result.errorCode}`);
            }
        }
        
        // 解析異常分級 (支援表格格式: "異常分級 * P2")
        const severityMatch = message.match(/異常分[級级][*\s:：]*(P[0-3])/i);
        if (severityMatch) {
            result.severity = severityMatch[1].toUpperCase();
            console.log(`[解析] 異常分級: ${result.severity}`);
        } else {
            // Fallback
            if (message.match(/P0|緊急/i)) result.severity = 'P0';
            else if (message.match(/P1|高/i)) result.severity = 'P1';
            else if (message.match(/P2|中/i)) result.severity = 'P2';
            else if (message.match(/P3|低/i)) result.severity = 'P3';
            if (result.severity) {
                console.log(`[解析] 異常分級 (Fallback): ${result.severity}`);
            }
        }
        
        // 解析發生異常操作 (從表格中提取問題描述)
        const operationMatch = message.match(/問題[:\s：]*([^\n]+)/);
        if (operationMatch && operationMatch[1].trim()) {
            result.operation = operationMatch[1].trim();
            console.log(`[解析] 發生異常操作: ${result.operation}`);
        }
        
        console.log('[INFO] 解析完成,結果:', JSON.stringify(result, null, 2));
        return result;
    }
    
    /**
     * 直接發送確認卡片 (用於自動建單)
     */
    private async sendConfirmationCard(context: TurnContext, ticketNumber: string, data: RecordFormData): Promise<void> {
        const confirmationCard = this.createConfirmationCard(ticketNumber, data);
        const message = MessageFactory.attachment(confirmationCard);
        await context.sendActivity(message);
    }

    /**
     * 發送工單記錄表單 (Adaptive Card)
     */
    private async sendRecordForm(context: TurnContext): Promise<void> {
        const card = this.createRecordFormCard();
        const message = MessageFactory.attachment(card);
        await context.sendActivity(message);
    }

    /**
     * 建立工單記錄表單的 Adaptive Card
     */
    private createRecordFormCard(): Attachment {
        const cardPayload = {
            type: 'AdaptiveCard',
            version: '1.4',
            body: [
                {
                    type: 'TextBlock',
                    text: '遊戲商系統 SRE 工單記錄',
                    weight: 'Bolder',
                    size: 'Large',
                    color: 'Accent'
                },
                {
                    type: 'TextBlock',
                    text: '請填寫以下資訊',
                    size: 'Small',
                    isSubtle: true,
                    spacing: 'None'
                },
                {
                    type: 'Container',
                    spacing: 'Medium',
                    items: [
                        {
                            type: 'Input.ChoiceSet',
                            id: 'environment',
                            label: '環境/整合商 *',
                            style: 'compact',
                            isRequired: true,
                            errorMessage: '請選擇環境',
                            choices: [
                                { title: 'pgs-prod', value: 'pgs-prod' },
                                { title: 'pgs-stage', value: 'pgs-stage' },
                                { title: '1xbet', value: '1xbet' },
                                { title: 'other', value: 'other' }
                            ]
                        },
                        {
                            type: 'Input.ChoiceSet',
                            id: 'product',
                            label: '產品/遊戲 *',
                            style: 'compact',
                            isRequired: true,
                            errorMessage: '請選擇產品',
                            choices: [
                                { title: '老虎機', value: '老虎機' },
                                { title: '棋牌', value: '棋牌' },
                                { title: '魚機', value: '魚機' }
                            ]
                        },
                        {
                            type: 'Input.Date',
                            id: 'issueDate',
                            label: '發現異常日期 *',
                            isRequired: true,
                            errorMessage: '請選擇日期'
                        },
                        {
                            type: 'Input.Time',
                            id: 'issueTime',
                            label: '發現異常時間 *',
                            isRequired: true,
                            errorMessage: '請選擇時間'
                        },
                        {
                            type: 'Input.Text',
                            id: 'userId',
                            label: 'UserID',
                            placeholder: '例如：792f88d3-6836-48e4-82dd-479fc1982286'
                        },
                        {
                            type: 'Input.Text',
                            id: 'betOrderId',
                            label: '注單編號',
                            placeholder: '例如：BET-20251103-001'
                        },
                        {
                            type: 'Input.Text',
                            id: 'errorCode',
                            label: '錯誤代碼',
                            placeholder: '例如：ERR-500, TIMEOUT'
                        },
                        {
                            type: 'Input.Text',
                            id: 'operation',
                            label: '發生異常操作 *',
                            placeholder: '詳細描述異常操作...',
                            isMultiline: true,
                            isRequired: true,
                            errorMessage: '請輸入操作描述'
                        },
                        {
                            type: 'Input.ChoiceSet',
                            id: 'severity',
                            label: '異常分級 *',
                            style: 'compact',
                            isRequired: true,
                            errorMessage: '請選擇等級',
                            choices: [
                                { title: 'P0 - 緊急', value: 'P0' },
                                { title: 'P1 - 高', value: 'P1' },
                                { title: 'P2 - 中', value: 'P2' },
                                { title: 'P3 - 低', value: 'P3' }
                            ]
                        }
                    ]
                }
            ],
            actions: [
                {
                    type: 'Action.Submit',
                    title: '提交記錄',
                    style: 'positive',
                    data: {
                        action: 'submitRecord'
                    }
                },
                {
                    type: 'Action.Submit',
                    title: '取消',
                    data: {
                        action: 'cancel'
                    }
                }
            ]
        };

        return CardFactory.adaptiveCard(cardPayload);
    }

    /**
     * 建立 Teams 訊息連結
     */
    private buildTeamsMessageLink(context: TurnContext): string {
        try {
            const activity = context.activity;
            const conversation = activity.conversation;
            const channelData = activity.channelData || {};
            
            // 使用當前訊息的 ID (觸發關鍵字的訊息)
            const messageId = activity.id;
            
            // 從 channelData 獲取更多資訊
            const tenantId = channelData.tenant?.id || '';
            const teamId = channelData.team?.id || '';
            const channelId = channelData.channel?.id || '';
            const teamName = channelData.team?.name || '';
            const channelName = channelData.channel?.name || '';
            
            console.log('[INFO] Teams 訊息連結資訊:');
            console.log(`  - Tenant ID: ${tenantId}`);
            console.log(`  - Team ID: ${teamId}`);
            console.log(`  - Team Name: ${teamName}`);
            console.log(`  - Channel ID: ${channelId}`);
            console.log(`  - Channel Name: ${channelName}`);
            console.log(`  - Message ID: ${messageId}`);
            console.log(`  - Conversation ID: ${conversation?.id}`);
            
            // 記錄完整的 activity 用於除錯
            console.log(`  - Activity:`, JSON.stringify({
                id: activity.id,
                timestamp: activity.timestamp,
                channelId: activity.channelId,
                serviceUrl: activity.serviceUrl,
                conversation: conversation,
                channelData: channelData
            }, null, 2));
            
            // 如果有必要資訊,建立連結
            if (tenantId && messageId && channelId && teamId) {
                // Teams 深層連結格式 (完整版)
                // 使用 19: 開頭的 thread ID (channelId)
                const baseUrl = 'https://teams.microsoft.com/l/message';
                
                // 確保 timestamp 是字串格式
                const timestamp = activity.timestamp 
                    ? (typeof activity.timestamp === 'string' 
                        ? activity.timestamp 
                        : activity.timestamp.toISOString())
                    : new Date().toISOString();
                
                // 構建完整連結,包含所有必要參數
                const params = new URLSearchParams({
                    tenantId: tenantId,
                    groupId: teamId,
                    parentMessageId: messageId,
                    teamName: teamName || 'Team',
                    channelName: channelName || 'Channel',
                    createdTime: timestamp
                });
                
                const link = `${baseUrl}/${encodeURIComponent(channelId)}/${encodeURIComponent(messageId)}?${params.toString()}`;
                
                console.log(`[OK] 建立 Teams 訊息連結: ${link}`);
                return link;
            }
            
            console.log('[WARN] 無法建立 Teams 訊息連結：缺少必要資訊');
            console.log(`[DEBUG] tenantId: ${!!tenantId}, teamId: ${!!teamId}, messageId: ${!!messageId}, channelId: ${!!channelId}`);
            return '';
            
        } catch (error) {
            console.error('[ERROR] 建立 Teams 訊息連結失敗:', error);
            return '';
        }
    }

    /**
     * 處理表單提交
     */
    private async handleRecordSubmit(context: TurnContext, formData: any): Promise<void> {
        try {
            // 取得提交人資訊
            const submitterName = context.activity.from.name || context.activity.from.id || '未知使用者';
            
            console.log(`[INFO] 提交人: ${submitterName} (ID: ${context.activity.from.id})`);

            // 解析表單資料
            const recordData: RecordFormData = {
                environment: formData.environment,
                product: formData.product,
                issueDate: formData.issueDate,
                issueTime: formData.issueTime,
                operation: formData.operation,
                userId: formData.userId,
                betOrderId: formData.betOrderId,
                errorCode: formData.errorCode,
                severity: formData.severity,
                description: formData.description,
                submitter: submitterName
            };

            // 產生工單號碼
            const ticketNumber = generateTicketNumber();

            console.log(`[OK] 產生工單號碼: ${ticketNumber}`);

            // 從快取中獲取 Teams 訊息連結
            const conversationId = context.activity.conversation?.id || '';
            const issueLink = this.messageLinksCache.get(conversationId) || '';
            
            if (issueLink) {
                console.log(`[INFO] 使用快取的訊息連結: ${issueLink}`);
                // 使用後清除快取
                this.messageLinksCache.delete(conversationId);
            } else {
                console.log('[WARN] 未找到快取的訊息連結');
            }

            // 寫入 Google Sheets（同步等待結果）
            if (googleSheetService.isEnabled()) {
                console.log('[INFO] 開始寫入 Google Sheets...');
                const sheetRowData = mapFormDataToSheetRow(ticketNumber, recordData, issueLink);
                
                try {
                    // 同步等待寫入結果
                    await googleSheetService.appendRow(sheetRowData);
                    console.log(`[OK] Google Sheets 寫入成功: ${ticketNumber}`);
                    
                    // 寫入成功，顯示確認卡片
                    await this.updateToConfirmationCard(context, ticketNumber, recordData);
                    console.log(`[OK] 已更新為確認卡片`);
                    
                } catch (sheetError: any) {
                    // 寫入失敗，顯示錯誤卡片
                    console.error(`[ERROR] Google Sheets 寫入失敗: ${sheetError}`);
                    const errorMessage = sheetError?.message || String(sheetError);
                    await this.updateToErrorCard(context, ticketNumber, recordData, errorMessage);
                    console.log(`[ERROR] 已更新為錯誤卡片`);
                }
            } else {
                console.log('[INFO] Google Sheets 功能未啟用，跳過寫入');
                // 功能未啟用時仍然顯示確認卡片
                await this.updateToConfirmationCard(context, ticketNumber, recordData);
                console.log(`[OK] 已更新為確認卡片（未啟用 Google Sheets）`);
            }

        } catch (error) {
            console.error('[ERROR] 處理表單提交失敗:', error);
            await context.sendActivity('處理表單時發生錯誤，請稍後再試。');
        }
    }

    /**
     * 更新為確認卡片
     */
    private async updateToConfirmationCard(context: TurnContext, ticketNumber: string, data: RecordFormData): Promise<void> {
        const confirmationCard = this.createConfirmationCard(ticketNumber, data);
        
        // 更新原本的表單卡片
        const activity = MessageFactory.attachment(confirmationCard);
        activity.id = context.activity.replyToId;
        
        try {
            await context.updateActivity(activity);
        } catch (error) {
            console.error('[WARN] 無法更新卡片，改為發送新訊息:', error);
            // 如果更新失敗，改為發送新訊息
            await context.sendActivity(activity);
        }
    }

    /**
     * 更新為錯誤卡片
     */
    private async updateToErrorCard(context: TurnContext, ticketNumber: string, data: RecordFormData, errorMessage: string): Promise<void> {
        const errorCard = this.createErrorCard(ticketNumber, data, errorMessage);
        
        // 更新原本的表單卡片
        const activity = MessageFactory.attachment(errorCard);
        activity.id = context.activity.replyToId;
        
        try {
            await context.updateActivity(activity);
        } catch (error) {
            console.error('[WARN] 無法更新卡片，改為發送新訊息:', error);
            // 如果更新失敗，改為發送新訊息
            await context.sendActivity(activity);
        }
    }

    /**
     * 建立確認卡片
     */
    private createConfirmationCard(ticketNumber: string, data: RecordFormData): Attachment {
        const cardPayload = {
            type: 'AdaptiveCard',
            version: '1.4',
            body: [
                {
                    type: 'Container',
                    style: 'good',
                    items: [
                        {
                            type: 'TextBlock',
                            text: '✅ 工單記錄已提交',
                            weight: 'Bolder',
                            size: 'Large',
                            wrap: true
                        }
                    ],
                    bleed: true
                },
                {
                    type: 'Container',
                    spacing: 'Medium',
                    items: [
                        {
                            type: 'FactSet',
                            facts: [
                                {
                                    title: '工單號碼',
                                    value: ticketNumber
                                },
                                {
                                    title: '提交人',
                                    value: data.submitter || '未知'
                                },
                                {
                                    title: '環境/整合商',
                                    value: data.environment
                                },
                                {
                                    title: '產品/遊戲',
                                    value: data.product
                                },
                                {
                                    title: '發現異常時間',
                                    value: `${data.issueDate} ${data.issueTime}`
                                },
                                {
                                    title: '異常分級',
                                    value: data.severity
                                }
                            ]
                        }
                    ]
                },
                {
                    type: 'Container',
                    spacing: 'Medium',
                    items: [
                        {
                            type: 'TextBlock',
                            text: '**發生異常操作：**',
                            weight: 'Bolder',
                            size: 'Small'
                        },
                        {
                            type: 'TextBlock',
                            text: data.operation,
                            wrap: true,
                            spacing: 'None'
                        }
                    ]
                },
                ...(data.userId ? [{
                    type: 'Container',
                    spacing: 'Small',
                    items: [
                        {
                            type: 'TextBlock',
                            text: '**UserID：**',
                            weight: 'Bolder',
                            size: 'Small'
                        },
                        {
                            type: 'TextBlock',
                            text: data.userId,
                            wrap: true,
                            spacing: 'None'
                        }
                    ]
                }] : []),
                ...(data.betOrderId ? [{
                    type: 'Container',
                    spacing: 'Small',
                    items: [
                        {
                            type: 'TextBlock',
                            text: '**注單編號：**',
                            weight: 'Bolder',
                            size: 'Small'
                        },
                        {
                            type: 'TextBlock',
                            text: data.betOrderId,
                            wrap: true,
                            spacing: 'None'
                        }
                    ]
                }] : []),
                ...(data.errorCode ? [{
                    type: 'Container',
                    spacing: 'Small',
                    items: [
                        {
                            type: 'TextBlock',
                            text: '**錯誤代碼：**',
                            weight: 'Bolder',
                            size: 'Small'
                        },
                        {
                            type: 'TextBlock',
                            text: data.errorCode,
                            wrap: true,
                            spacing: 'None'
                        }
                    ]
                }] : []),
                {
                    type: 'Container',
                    spacing: 'Medium',
                    separator: true,
                    items: [
                        {
                            type: 'TextBlock',
                            text: '請確認以上資訊是否正確',
                            size: 'Small',
                            isSubtle: true,
                            wrap: true,
                            horizontalAlignment: 'Center'
                        }
                    ]
                }
            ]
        };

        return CardFactory.adaptiveCard(cardPayload);
    }

    /**
     * 建立錯誤卡片
     */
    private createErrorCard(ticketNumber: string, data: RecordFormData, errorMessage: string): Attachment {
        const cardPayload = {
            type: 'AdaptiveCard',
            version: '1.4',
            body: [
                {
                    type: 'Container',
                    style: 'attention',
                    items: [
                        {
                            type: 'TextBlock',
                            text: '⚠️ 工單提交失敗',
                            weight: 'Bolder',
                            size: 'Large',
                            wrap: true
                        }
                    ],
                    bleed: true
                },
                {
                    type: 'Container',
                    spacing: 'Medium',
                    items: [
                        {
                            type: 'TextBlock',
                            text: '工單資料寫入 Google Sheets 時發生錯誤，請稍後重試或聯繫管理員。',
                            wrap: true,
                            color: 'Attention'
                        }
                    ]
                },
                {
                    type: 'Container',
                    spacing: 'Medium',
                    separator: true,
                    items: [
                        {
                            type: 'TextBlock',
                            text: '工單資訊',
                            weight: 'Bolder',
                            size: 'Medium'
                        },
                        {
                            type: 'FactSet',
                            facts: [
                                {
                                    title: '工單號碼',
                                    value: `${ticketNumber} (未寫入)`
                                },
                                {
                                    title: '提交人',
                                    value: data.submitter || '未知'
                                },
                                {
                                    title: '環境/整合商',
                                    value: data.environment
                                },
                                {
                                    title: '產品/遊戲',
                                    value: data.product
                                },
                                {
                                    title: '發現異常時間',
                                    value: `${data.issueDate} ${data.issueTime}`
                                },
                                {
                                    title: '異常分級',
                                    value: data.severity
                                }
                            ]
                        }
                    ]
                },
                {
                    type: 'Container',
                    spacing: 'Medium',
                    items: [
                        {
                            type: 'TextBlock',
                            text: '**發生異常操作：**',
                            weight: 'Bolder',
                            size: 'Small'
                        },
                        {
                            type: 'TextBlock',
                            text: data.operation,
                            wrap: true,
                            spacing: 'None'
                        }
                    ]
                },
                ...(data.userId ? [{
                    type: 'Container',
                    spacing: 'Small',
                    items: [
                        {
                            type: 'TextBlock',
                            text: '**UserID：**',
                            weight: 'Bolder',
                            size: 'Small'
                        },
                        {
                            type: 'TextBlock',
                            text: data.userId,
                            wrap: true,
                            spacing: 'None'
                        }
                    ]
                }] : []),
                ...(data.betOrderId ? [{
                    type: 'Container',
                    spacing: 'Small',
                    items: [
                        {
                            type: 'TextBlock',
                            text: '**注單編號：**',
                            weight: 'Bolder',
                            size: 'Small'
                        },
                        {
                            type: 'TextBlock',
                            text: data.betOrderId,
                            wrap: true,
                            spacing: 'None'
                        }
                    ]
                }] : []),
                ...(data.errorCode ? [{
                    type: 'Container',
                    spacing: 'Small',
                    items: [
                        {
                            type: 'TextBlock',
                            text: '**錯誤代碼：**',
                            weight: 'Bolder',
                            size: 'Small'
                        },
                        {
                            type: 'TextBlock',
                            text: data.errorCode,
                            wrap: true,
                            spacing: 'None'
                        }
                    ]
                }] : []),
                {
                    type: 'Container',
                    spacing: 'Medium',
                    separator: true,
                    items: [
                        {
                            type: 'TextBlock',
                            text: '錯誤詳情',
                            weight: 'Bolder',
                            size: 'Small',
                            color: 'Attention'
                        },
                        {
                            type: 'TextBlock',
                            text: errorMessage,
                            wrap: true,
                            spacing: 'None',
                            size: 'Small',
                            isSubtle: true
                        }
                    ]
                },
                {
                    type: 'Container',
                    spacing: 'Small',
                    items: [
                        {
                            type: 'TextBlock',
                            text: '💡 請重新提交表單，或將以上資訊截圖後聯繫技術人員。',
                            size: 'Small',
                            wrap: true,
                            horizontalAlignment: 'Center',
                            isSubtle: true
                        }
                    ]
                }
            ]
        };

        return CardFactory.adaptiveCard(cardPayload);
    }

    /**
     * 格式化確認訊息
     */
    private formatConfirmationMessage(ticketNumber: string, data: RecordFormData): string {
        const lines = [
            '✅ **工單記錄已提交**',
            '',
            `📋 **工單號碼：** ${ticketNumber}`,
            `👤 **提交人：** ${data.submitter}`,
            '',
            '📝 **工單資訊：**',
            '',
            `**環境/整合商：** ${data.environment}`,
            `**產品/遊戲：** ${data.product}`,
            `**發現異常時間：** ${data.issueDate} ${data.issueTime}`,
            `**發生異常操作：** ${data.operation}`,
        ];

        // 選填欄位
        if (data.userId) {
            lines.push(`**UserID 與 注單編號：** ${data.userId}`);
        }

        lines.push(`**異常分級：** ${data.severity}`);

        lines.push('');
        lines.push('---');
        lines.push('');
        lines.push('請確認以上資訊是否正確。');

        return lines.join('\n');
    }

}

