import { TurnContext, MessageFactory, CardFactory, Attachment } from 'botbuilder';
import { BaseChannelHandler } from './BaseChannelHandler';
import { ChannelConfig } from '../config/channelConfig';
import { generateRequirementNumber } from '../utils/ticketGenerator';
import { googleSheetService } from '../services/googleSheetService';
import { RequirementFormData, mapRequirementDataToSheetRow } from '../utils/dataMapper';

/**
 * 需求頻道處理器
 * 處理需求管理相關的表單和自動建單邏輯
 */
export class RequirementChannelHandler extends BaseChannelHandler {
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
            /需求部門/i,
            /產品名稱/i,
            /需求問題/i
        ];
        
        const matchCount = requiredFields.filter(pattern => pattern.test(message)).length;
        console.log(`[INFO] 表格欄位偵測: 找到 ${matchCount}/${requiredFields.length} 個必要欄位`);
        
        return matchCount >= 2;
    }

    /**
     * 解析訊息內容
     */
    protected parseMessage(message: string): Partial<RequirementFormData> {
        const result: Partial<RequirementFormData> = {};
        
        console.log('[INFO] 開始解析需求單訊息內容...');
        
        // 解析需求部門
        const departmentSection = message.match(/需求部門[\s\*＊]*([\s\S]*?)(?=產品名稱|聯絡窗口|溝通頻道|期望上線時間|需求問題|需求文件|需求原因|需求描述|$)/i);
        if (departmentSection) {
            const lines = departmentSection[1].split('\n');
            const contentLine = lines.find(line => line.trim() && !line.match(/^[\s\*＊]+$/));
            if (contentLine) {
                result.department = contentLine.trim();
                console.log(`[解析] 需求部門: ${result.department}`);
            }
        }
        
        // 解析產品名稱
        const productSection = message.match(/產品名稱[\s\*＊]*([\s\S]*?)(?=聯絡窗口|溝通頻道|期望上線時間|需求問題|需求文件|需求原因|需求描述|$)/i);
        if (productSection) {
            const lines = productSection[1].split('\n');
            const contentLine = lines.find(line => line.trim() && !line.match(/^[\s\*＊]+$/));
            if (contentLine) {
                result.product = contentLine.trim();
                console.log(`[解析] 產品名稱: ${result.product}`);
            }
        }
        
        // 解析聯絡窗口
        const contactSection = message.match(/聯絡窗口[\s\*＊]*([\s\S]*?)(?=溝通頻道|期望上線時間|需求問題|需求文件|需求原因|需求描述|$)/i);
        if (contactSection) {
            const lines = contactSection[1].split('\n');
            const contentLine = lines.find(line => line.trim() && !line.match(/^[\s\*＊]+$/));
            if (contentLine) {
                result.contact = contentLine.trim();
                console.log(`[解析] 聯絡窗口: ${result.contact}`);
            }
        }
        
        // 解析溝通頻道
        const channelSection = message.match(/溝通頻道[\s\*＊]*([\s\S]*?)(?=期望上線時間|需求問題|需求文件|需求原因|需求描述|$)/i);
        if (channelSection) {
            const lines = channelSection[1].split('\n');
            const contentLine = lines.find(line => line.trim() && !line.match(/^[\s\*＊]+$/));
            if (contentLine) {
                result.communicationChannel = contentLine.trim();
                console.log(`[解析] 溝通頻道: ${result.communicationChannel}`);
            }
        }
        
        // 解析期望上線時間（支援多種日期格式）
        const dateSection = message.match(/期望上線時間[\s\*＊]*([\s\S]*?)(?=需求問題|需求文件|需求原因|需求描述|$)/i);
        if (dateSection) {
            const lines = dateSection[1].split('\n');
            const contentLine = lines.find(line => line.trim() && !line.match(/^[\s\*＊]+$/));
            if (contentLine) {
                // 嘗試解析日期格式 (YYYY/MM/DD 或 YYYY-MM-DD)
                const dateMatch = contentLine.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
                if (dateMatch) {
                    const year = dateMatch[1];
                    const month = dateMatch[2].padStart(2, '0');
                    const day = dateMatch[3].padStart(2, '0');
                    result.expectedOnlineDate = `${year}-${month}-${day}`;
                    console.log(`[解析] 期望上線時間: ${result.expectedOnlineDate}`);
                }
            }
        }
        
        // 解析需求問題
        const issueSection = message.match(/需求問題[\s\*＊]*([\s\S]*?)(?=需求文件|需求原因|需求描述|$)/i);
        if (issueSection) {
            const lines = issueSection[1].split('\n');
            const contentLine = lines.find(line => line.trim() && !line.match(/^[\s\*＊]+$/));
            if (contentLine) {
                result.requirementIssue = contentLine.trim();
                console.log(`[解析] 需求問題: ${result.requirementIssue}`);
            }
        }
        
        // 解析需求文件
        const documentSection = message.match(/需求文件[\s\*＊]*([\s\S]*?)(?=需求原因|需求描述|$)/i);
        if (documentSection) {
            const lines = documentSection[1].split('\n');
            const contentLine = lines.find(line => line.trim() && !line.match(/^[\s\*＊]+$/));
            if (contentLine) {
                result.requirementDocument = contentLine.trim();
                console.log(`[解析] 需求文件: ${result.requirementDocument}`);
            }
        }
        
        // 解析需求原因
        const reasonSection = message.match(/需求原因[\s\*＊]*([\s\S]*?)(?=需求描述|$)/i);
        if (reasonSection) {
            const lines = reasonSection[1].split('\n');
            const contentLine = lines.find(line => line.trim() && !line.match(/^[\s\*＊]+$/));
            if (contentLine) {
                result.requirementReason = contentLine.trim();
                console.log(`[解析] 需求原因: ${result.requirementReason}`);
            }
        }
        
        // 解析需求描述
        const descriptionSection = message.match(/需求描述[\s\*＊]*([\s\S]*?)$/i);
        if (descriptionSection) {
            const lines = descriptionSection[1].split('\n');
            const contentLine = lines.find(line => line.trim() && !line.match(/^[\s\*＊]+$/));
            if (contentLine) {
                result.description = contentLine.trim();
                console.log(`[解析] 需求描述: ${result.description}`);
            }
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
            
            // 產生需求單號碼
            const requirementNumber = generateRequirementNumber();
            console.log(`[OK] 產生需求單號碼: ${requirementNumber}`);
            
            // 建立 Teams 訊息連結
            const requirementLink = this.buildTeamsMessageLink(context);
            
            // 準備表單資料
            const recordData: RequirementFormData = {
                department: parsedData.department || '',
                product: parsedData.product || '',
                contact: parsedData.contact || '',
                communicationChannel: parsedData.communicationChannel || '/',
                expectedOnlineDate: parsedData.expectedOnlineDate || new Date().toISOString().split('T')[0],
                requirementIssue: parsedData.requirementIssue || '',
                requirementDocument: parsedData.requirementDocument,
                requirementReason: parsedData.requirementReason || '',
                description: parsedData.description,
                submitter: submitterName
            };
            
            // 寫入 Google Sheets
            if (googleSheetService.isEnabled()) {
                console.log('[INFO] 開始寫入 Google Sheets...');
                const sheetRowData = mapRequirementDataToSheetRow(requirementNumber, recordData, requirementLink);
                
                // 使用需求單的 Sheet 設定
                await googleSheetService.appendRowArray(
                    sheetRowData,
                    this.config.sheetId,
                    this.config.sheetName
                );
                console.log(`[OK] Google Sheets 寫入成功: ${requirementNumber}`);
                
                // 顯示確認卡片
                await this.sendConfirmationCard(context, requirementNumber, recordData);
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
        
        const card = this.createRequirementFormCard();
        const message = MessageFactory.attachment(card);
        await context.sendActivity(message);
    }

    /**
     * 處理表單提交
     */
    public async handleFormSubmit(context: TurnContext, formData: any): Promise<void> {
        try {
            console.log('[INFO] 處理需求單表單提交');
            
            const submitterName = context.activity.from.name || context.activity.from.id || '未知使用者';
            const requirementNumber = generateRequirementNumber();
            console.log(`[OK] 產生需求單號碼: ${requirementNumber}`);
            
            // 取得快取的訊息連結
            const conversationId = context.activity.conversation?.id || '';
            const requirementLink = this.messageLinksCache.get(conversationId) || '';
            
            const recordData: RequirementFormData = {
                ...formData,
                submitter: submitterName
            };
            
            if (googleSheetService.isEnabled()) {
                const sheetRowData = mapRequirementDataToSheetRow(requirementNumber, recordData, requirementLink);
                await googleSheetService.appendRowArray(
                    sheetRowData,
                    this.config.sheetId,
                    this.config.sheetName
                );
                console.log(`[OK] Google Sheets 寫入成功: ${requirementNumber}`);
            }
            
            // 更新為確認卡片
            const confirmationCard = this.createConfirmationCard(requirementNumber, recordData);
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
     * 建立需求單記錄表單的 Adaptive Card
     */
    private createRequirementFormCard(): Attachment {
        return CardFactory.adaptiveCard({
            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
            type: 'AdaptiveCard',
            version: '1.4',
            body: [
                {
                    type: 'TextBlock',
                    text: '需求單記錄',
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
                    id: 'department',
                    label: '需求部門 *',
                    style: 'compact',
                    isRequired: true,
                    errorMessage: '請選擇需求部門',
                    choices: [
                        { title: 'EL白牌', value: 'EL白牌' },
                        { title: '其他', value: '其他' }
                    ]
                },
                {
                    type: 'Input.Text',
                    id: 'product',
                    label: '產品名稱 *',
                    isRequired: true,
                    errorMessage: '請輸入產品名稱'
                },
                {
                    type: 'Input.Text',
                    id: 'contact',
                    label: '聯絡窗口 *',
                    placeholder: '例如：siya.li(李雯凤)',
                    isRequired: true,
                    errorMessage: '請輸入聯絡窗口'
                },
                {
                    type: 'Input.Text',
                    id: 'communicationChannel',
                    label: '溝通頻道',
                    placeholder: '例如：/ 或 Slack',
                    value: '/'
                },
                {
                    type: 'Input.Date',
                    id: 'expectedOnlineDate',
                    label: '期望上線時間 *',
                    isRequired: true,
                    errorMessage: '請選擇日期'
                },
                {
                    type: 'Input.Text',
                    id: 'requirementIssue',
                    label: '需求問題 *',
                    isMultiline: true,
                    isRequired: true,
                    errorMessage: '請描述需求問題'
                },
                {
                    type: 'Input.Text',
                    id: 'requirementDocument',
                    label: '需求文件',
                    placeholder: '例如：Google Sheets 連結'
                },
                {
                    type: 'Input.Text',
                    id: 'requirementReason',
                    label: '需求原因 *',
                    isMultiline: true,
                    isRequired: true,
                    errorMessage: '請說明需求原因'
                },
                {
                    type: 'Input.Text',
                    id: 'description',
                    label: '需求描述',
                    isMultiline: true,
                    placeholder: '其他補充說明（選填）'
                }
            ],
            actions: [
                {
                    type: 'Action.Submit',
                    title: '提交',
                    data: {
                        action: 'submit',
                        formType: 'requirement'
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
    private createConfirmationCard(requirementNumber: string, data: RequirementFormData): Attachment {
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
                                            text: '需求單已提交',
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
                        { title: '需求單編號', value: requirementNumber },
                        { title: '提交人', value: data.submitter || '' },
                        { title: '需求部門', value: data.department },
                        { title: '產品名稱', value: data.product },
                        { title: '聯絡窗口', value: data.contact },
                        { title: '溝通頻道', value: data.communicationChannel || '/' },
                        { title: '期望上線時間', value: data.expectedOnlineDate },
                        { title: '需求問題：', value: '' }
                    ]
                },
                {
                    type: 'TextBlock',
                    text: data.requirementIssue,
                    wrap: true
                },
                ...(data.requirementDocument ? [{
                    type: 'FactSet',
                    facts: [
                        { title: '需求文件：', value: '' }
                    ]
                }, {
                    type: 'TextBlock',
                    text: data.requirementDocument,
                    wrap: true
                }] : []),
                {
                    type: 'FactSet',
                    facts: [
                        { title: '需求原因：', value: '' }
                    ]
                },
                {
                    type: 'TextBlock',
                    text: data.requirementReason,
                    wrap: true
                },
                ...(data.description ? [{
                    type: 'FactSet',
                    facts: [
                        { title: '需求描述：', value: '' }
                    ]
                }, {
                    type: 'TextBlock',
                    text: data.description,
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
    private async sendConfirmationCard(context: TurnContext, requirementNumber: string, data: RequirementFormData): Promise<void> {
        const confirmationCard = this.createConfirmationCard(requirementNumber, data);
        const message = MessageFactory.attachment(confirmationCard);
        await context.sendActivity(message);
    }
}

