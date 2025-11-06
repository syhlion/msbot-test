import { TurnContext, MessageFactory, CardFactory, Attachment } from 'botbuilder';
import { BaseChannelHandler } from './BaseChannelHandler';
import { ChannelConfig } from '../config/channelConfig';
import { generateTicketNumber } from '../utils/ticketGenerator';
import { googleSheetService } from '../services/googleSheetService';
import { mapFormDataToSheetRow } from '../utils/dataMapper';

/**
 * 異常工單表單資料介面
 */
export interface IssueFormData {
    environment: string;
    product: string;
    issueDate: string;
    issueTime: string;
    operation: string;
    userId?: string;
    betOrderId?: string;
    errorCode?: string;
    severity: string;
    description?: string;
    submitter?: string;
}

/**
 * 異常頻道處理器
 * 處理異常回報相關的表單和自動建單邏輯
 */
export class IssueChannelHandler extends BaseChannelHandler {
    // 儲存原始訊息連結的 Map
    private messageLinksCache = new Map<string, string>();

    constructor(config: ChannelConfig) {
        super(config);
    }

    /**
     * 偵測是否為表格格式
     */
    protected detectTableFormat(message: string): boolean {
        const requiredFields = [
            /環境[\/\s]*整合商/i,
            /產品[\/\s]*遊戲/i,
            /異常分[級级]/i
        ];
        
        const matchCount = requiredFields.filter(pattern => pattern.test(message)).length;
        console.log(`[INFO] 表格欄位偵測: 找到 ${matchCount}/${requiredFields.length} 個必要欄位`);
        
        return matchCount >= 2;
    }

    /**
     * 解析訊息內容
     */
    protected parseMessage(message: string): Partial<IssueFormData> {
        const result: Partial<IssueFormData> = {};
        
        console.log('[INFO] 開始解析訊息內容...');
        
        // 解析環境/整合商
        const envSection = message.match(/環境[\/\s]*整合商[\s\*＊]*([\s\S]*?)(?=產品|發現|UserID|異常|$)/i);
        if (envSection) {
            const lines = envSection[1].split('\n');
            const contentLine = lines.find(line => line.trim() && !line.match(/^[\s\*＊]+$/));
            if (contentLine) {
                result.environment = contentLine.trim();
                console.log(`[解析] 環境/整合商: ${result.environment}`);
            }
        }
        
        // 解析產品/遊戲
        const productSection = message.match(/產品[\/\s]*遊戲[\s\*＊]*([\s\S]*?)(?=發現|UserID|異常|$)/i);
        if (productSection) {
            const lines = productSection[1].split('\n');
            const contentLine = lines.find(line => line.trim() && !line.match(/^[\s\*＊]+$/));
            if (contentLine) {
                result.product = contentLine.trim();
                console.log(`[解析] 產品/遊戲: ${result.product}`);
            }
        }
        
        // 解析發現異常時間
        const issueTimeMatch = message.match(/發[現生][異常]*時間[\s\*＊]*[\s\S]*?(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/i);
        if (issueTimeMatch) {
            result.issueDate = `${issueTimeMatch[1]}-${issueTimeMatch[2]}-${issueTimeMatch[3]}`;
            result.issueTime = `${issueTimeMatch[4]}:${issueTimeMatch[5]}`;
            console.log(`[解析] 發現異常時間: ${result.issueDate} ${result.issueTime}`);
        }
        
        // 解析 UserID 與 注單編號
        const userIdSection = message.match(/UserID\s*與\s*注單編號[\s\*＊]*([\s\S]*?)(?=異常代碼|異常單|異常分|$)/i);
        if (userIdSection) {
            const lines = userIdSection[1].split('\n');
            const contentLine = lines.find(line => line.trim() && !line.match(/^[\s\*＊]+$/));
            if (contentLine) {
                result.userId = contentLine.trim();
                console.log(`[解析] UserID 與 注單編號: ${result.userId}`);
            }
        }
        
        // 解析異常代碼
        const errorCodeSection = message.match(/異常代碼[\s\*＊]*([\s\S]*?)(?=異常單|異常分|$)/i);
        if (errorCodeSection) {
            const lines = errorCodeSection[1].split('\n');
            const contentLine = lines.find(line => line.trim() && !line.match(/^[\s\*＊]+$/));
            if (contentLine) {
                result.errorCode = contentLine.trim();
                console.log(`[解析] 異常代碼: ${result.errorCode}`);
            } else {
                console.log(`[解析] 異常代碼: (欄位為空)`);
            }
        }
        
        // 解析異常分級
        const severitySection = message.match(/異常分[級级][\s\*＊]*([\s\S]*?)(?=問題|$)/i);
        if (severitySection) {
            const lines = severitySection[1].split('\n');
            const contentLine = lines.find(line => line.trim() && !line.match(/^[\s\*＊]+$/));
            if (contentLine) {
                result.severity = contentLine.trim();
                console.log(`[解析] 異常分級: ${result.severity}`);
            }
        }
        
        // 解析發生異常操作
        const operationMatch = message.match(/問題\s*[:\s：]*([^\n]+)/);
        if (operationMatch) {
            result.operation = operationMatch[1].trim();
            console.log(`[解析] 發生異常操作: ${result.operation}`);
        }
        
        console.log('[INFO] 解析完成');
        return result;
    }

    /**
     * 嘗試自動建單
     */
    protected async tryAutoCreate(context: TurnContext, message: string): Promise<boolean> {
        try {
            // 檢查是否包含表格格式
            if (!this.detectTableFormat(message)) {
                console.log('[INFO] 未偵測到表格格式');
                return false;
            }
            
            console.log('[OK] 偵測到表格格式,開始自動建單');
            
            // 解析訊息
            const parsedData = this.parseMessage(message);
            
            // 取得提交人資訊
            const submitterName = context.activity.from.name || context.activity.from.id || '未知使用者';
            
            // 產生工單號碼
            const ticketNumber = generateTicketNumber();
            console.log(`[OK] 產生工單號碼: ${ticketNumber}`);
            
            // 建立 Teams 訊息連結
            const issueLink = this.buildTeamsMessageLink(context);
            
            // 準備表單資料
            const recordData: IssueFormData = {
                environment: parsedData.environment || '',
                product: parsedData.product || '',
                issueDate: parsedData.issueDate || new Date().toISOString().split('T')[0],
                issueTime: parsedData.issueTime || new Date().toTimeString().split(' ')[0].substring(0, 5),
                operation: parsedData.operation || '',
                userId: parsedData.userId,
                betOrderId: parsedData.betOrderId,
                errorCode: parsedData.errorCode,
                severity: parsedData.severity || '',
                submitter: submitterName
            };
            
            // 寫入 Google Sheets
            if (googleSheetService.isEnabled()) {
                console.log('[INFO] 開始寫入 Google Sheets...');
                const sheetRowData = mapFormDataToSheetRow(ticketNumber, recordData, issueLink);
                
                await googleSheetService.appendRow(sheetRowData);
                console.log(`[OK] Google Sheets 寫入成功: ${ticketNumber}`);
                
                // 顯示確認卡片
                await this.sendConfirmationCard(context, ticketNumber, recordData);
                return true;
            }
            
            return false;
            
        } catch (error) {
            console.error('[ERROR] 自動建單失敗:', error);
            return false;
        }
    }

    /**
     * 顯示表單
     */
    protected async showForm(context: TurnContext): Promise<void> {
        // 建立並快取訊息連結
        const messageLink = this.buildTeamsMessageLink(context);
        const conversationId = context.activity.conversation?.id || '';
        if (messageLink && conversationId) {
            this.messageLinksCache.set(conversationId, messageLink);
            console.log(`[INFO] 已快取訊息連結`);
        }
        
        const card = this.createRecordFormCard();
        const message = MessageFactory.attachment(card);
        await context.sendActivity(message);
    }

    /**
     * 處理表單提交
     */
    public async handleFormSubmit(context: TurnContext, formData: any): Promise<void> {
        try {
            console.log('[INFO] 處理異常工單表單提交');
            
            const submitterName = context.activity.from.name || context.activity.from.id || '未知使用者';
            const ticketNumber = generateTicketNumber();
            console.log(`[OK] 產生工單號碼: ${ticketNumber}`);
            
            // 取得快取的訊息連結
            const conversationId = context.activity.conversation?.id || '';
            const issueLink = this.messageLinksCache.get(conversationId) || '';
            
            const recordData: IssueFormData = {
                ...formData,
                submitter: submitterName
            };
            
            if (googleSheetService.isEnabled()) {
                const sheetRowData = mapFormDataToSheetRow(ticketNumber, recordData, issueLink);
                await googleSheetService.appendRow(sheetRowData);
                console.log(`[OK] Google Sheets 寫入成功: ${ticketNumber}`);
            }
            
            // 更新為確認卡片
            const confirmationCard = this.createConfirmationCard(ticketNumber, recordData);
            const updateActivity = MessageFactory.attachment(confirmationCard);
            updateActivity.id = context.activity.replyToId;
            
            await context.updateActivity(updateActivity);
            console.log('[OK] 已更新為確認卡片');
            
        } catch (error: any) {
            console.error('[ERROR] 處理表單提交失敗:', error);
            await context.sendActivity(`❌ 提交失敗: ${error.message}`);
        }
    }

    /**
     * 建立 Teams 訊息連結
     */
    private buildTeamsMessageLink(context: TurnContext): string {
        try {
            const activity = context.activity;
            const channelData = activity.channelData || {};
            
            const messageId = activity.id;
            const tenantId = channelData.tenant?.id || '';
            const teamId = channelData.team?.id || '';
            const channelId = channelData.channel?.id || '';
            
            if (tenantId && messageId && channelId && teamId) {
                const timestamp = activity.timestamp
                    ? (typeof activity.timestamp === 'string'
                        ? activity.timestamp
                        : activity.timestamp.toISOString())
                    : new Date().toISOString();
                
                const params = new URLSearchParams({
                    tenantId: tenantId,
                    groupId: teamId,
                    parentMessageId: messageId,
                    teamName: channelData.team?.name || 'Team',
                    channelName: channelData.channel?.name || 'Channel',
                    createdTime: timestamp
                });
                
                const link = `https://teams.microsoft.com/l/message/${encodeURIComponent(channelId)}/${encodeURIComponent(messageId)}?${params.toString()}`;
                return link;
            }
            
            return '';
        } catch (error) {
            console.error('[ERROR] 建立 Teams 訊息連結失敗:', error);
            return '';
        }
    }

    /**
     * 建立工單記錄表單的 Adaptive Card
     */
    private createRecordFormCard(): Attachment {
        return CardFactory.adaptiveCard({
            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
            type: 'AdaptiveCard',
            version: '1.4',
            body: [
                {
                    type: 'TextBlock',
                    text: '遊戲商系統 SRE 工單記錄',
                    weight: 'Bolder',
                    size: 'Large'
                },
                {
                    type: 'TextBlock',
                    text: '請填寫以下資訊',
                    wrap: true,
                    spacing: 'Small'
                },
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
                        { title: '其他', value: '其他' }
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
                        { title: '魚機', value: '魚機' },
                        { title: '其他', value: '其他' }
                    ]
                },
                {
                    type: 'Input.Date',
                    id: 'issueDate',
                    label: '發生異常日期 *',
                    isRequired: true,
                    errorMessage: '請選擇日期'
                },
                {
                    type: 'Input.Time',
                    id: 'issueTime',
                    label: '發生異常時間 *',
                    isRequired: true,
                    errorMessage: '請選擇時間'
                },
                {
                    type: 'Input.Text',
                    id: 'operation',
                    label: '發生異常操作 *',
                    isMultiline: true,
                    isRequired: true,
                    errorMessage: '請描述發生的異常操作'
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
                    placeholder: '例如：ERR3331（選填）'
                },
                {
                    type: 'Input.ChoiceSet',
                    id: 'severity',
                    label: '異常嚴重度 *',
                    style: 'compact',
                    isRequired: true,
                    errorMessage: '請選擇嚴重度',
                    choices: [
                        { title: 'P0 - 緊急', value: 'P0' },
                        { title: 'P1 - 高', value: 'P1' },
                        { title: 'P2 - 中', value: 'P2' },
                        { title: 'P3 - 低', value: 'P3' }
                    ]
                }
            ],
            actions: [
                {
                    type: 'Action.Submit',
                    title: '提交',
                    data: {
                        action: 'submit'
                    },
                    style: 'positive'
                },
                {
                    type: 'Action.Submit',
                    title: '取消',
                    data: {
                        action: 'cancel'
                    }
                }
            ]
        });
    }

    /**
     * 建立確認卡片
     */
    private createConfirmationCard(ticketNumber: string, data: IssueFormData): Attachment {
        return CardFactory.adaptiveCard({
            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
            type: 'AdaptiveCard',
            version: '1.4',
            body: [
                {
                    type: 'Container',
                    style: 'good',
                    items: [
                        {
                            type: 'ColumnSet',
                            columns: [
                                {
                                    type: 'Column',
                                    width: 'auto',
                                    items: [
                                        {
                                            type: 'TextBlock',
                                            text: '✅',
                                            size: 'Large'
                                        }
                                    ]
                                },
                                {
                                    type: 'Column',
                                    width: 'stretch',
                                    items: [
                                        {
                                            type: 'TextBlock',
                                            text: '工單記錄已提交',
                                            weight: 'Bolder',
                                            size: 'Large'
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                {
                    type: 'FactSet',
                    facts: [
                        { title: '工單號碼', value: ticketNumber },
                        { title: '提交人', value: data.submitter || '' },
                        { title: '環境/整合商', value: data.environment },
                        { title: '產品/遊戲', value: data.product },
                        { title: '發現異常時間', value: `${data.issueDate} ${data.issueTime}` },
                        { title: '異常分級', value: data.severity },
                        { title: '發生異常操作：', value: '' }
                    ]
                },
                {
                    type: 'TextBlock',
                    text: data.operation,
                    wrap: true
                },
                ...(data.userId ? [{
                    type: 'FactSet',
                    facts: [
                        { title: 'UserID：', value: '' }
                    ]
                }, {
                    type: 'TextBlock',
                    text: data.userId,
                    wrap: true
                }] : []),
                ...(data.betOrderId ? [{
                    type: 'FactSet',
                    facts: [
                        { title: '注單編號：', value: '' }
                    ]
                }, {
                    type: 'TextBlock',
                    text: data.betOrderId,
                    wrap: true
                }] : []),
                ...(data.errorCode ? [{
                    type: 'FactSet',
                    facts: [
                        { title: '錯誤代碼：', value: '' }
                    ]
                }, {
                    type: 'TextBlock',
                    text: data.errorCode,
                    wrap: true
                }] : []),
                {
                    type: 'TextBlock',
                    text: '請確認以上資訊是否正確',
                    wrap: true,
                    size: 'Small',
                    color: 'Accent',
                    spacing: 'Medium'
                }
            ]
        });
    }

    /**
     * 發送確認卡片（用於自動建單）
     */
    private async sendConfirmationCard(context: TurnContext, ticketNumber: string, data: IssueFormData): Promise<void> {
        const confirmationCard = this.createConfirmationCard(ticketNumber, data);
        const message = MessageFactory.attachment(confirmationCard);
        await context.sendActivity(message);
    }
}

