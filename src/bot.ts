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
    severity: string;
    description?: string;
    submitter?: string;        // 提交人名稱
}

/**
 * SRE 工單記錄 Bot - 支援混合模式
 */
export class EchoBot extends ActivityHandler {
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

            // 檢查是否包含觸發關鍵字
            const hasTriggerKeyword = userMessage.includes('遊戲商系統') || userMessage.toLowerCase().includes('sre');
            console.log(`包含關鍵字: ${hasTriggerKeyword} (遊戲商系統:${userMessage.includes('遊戲商系統')}, SRE:${userMessage.toLowerCase().includes('sre')})`);
            console.log('='.repeat(50));

            // 只要包含關鍵字就觸發表單（不需要 Tag Bot）
            if (hasTriggerKeyword) {
                console.log('[OK] 觸發 Adaptive Card 表單 (偵測到關鍵字)');
                await this.sendRecordForm(context);
                await next();
                return;
            }

            // 預設 Echo 模式
            const replyText = `Echo: ${userMessage}`;
            await context.sendActivity(MessageFactory.text(replyText));

            await next();
        });

        // 處理成員加入
        this.onMembersAdded(async (context: TurnContext, next) => {
            const membersAdded = context.activity.membersAdded || [];
            
            for (const member of membersAdded) {
                if (member.id !== context.activity.recipient.id) {
                    console.log(`新成員加入: ${member.name || member.id}`);
                    const welcomeText = `👋 歡迎使用 SRE 工單記錄 Bot！\n\n` +
                        `📋 使用方式：\n` +
                        `在訊息中提到「SRE」或「遊戲商系統」即可自動觸發表單\n\n` +
                        `範例：\n` +
                        `• 異常回報 SRE\n` +
                        `• 遊戲商系統有問題`;
                    await context.sendActivity(MessageFactory.text(welcomeText));
                }
            }

            await next();
        });
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
                            id: 'operation',
                            label: '發生異常操作 *',
                            placeholder: '描述操作',
                            isRequired: true,
                            errorMessage: '請輸入操作'
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
                        },
                        {
                            type: 'Input.Text',
                            id: 'description',
                            label: '異常狀況說明',
                            placeholder: '詳細描述問題...',
                            isMultiline: true
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
                severity: formData.severity,
                description: formData.description,
                submitter: submitterName
            };

            // 產生工單號碼
            const ticketNumber = generateTicketNumber();

            console.log(`[OK] 產生工單號碼: ${ticketNumber}`);

            // 寫入 Google Sheets（同步等待結果）
            if (googleSheetService.isEnabled()) {
                console.log('[INFO] 開始寫入 Google Sheets...');
                const sheetRowData = mapFormDataToSheetRow(ticketNumber, recordData);
                
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
                ...(data.description ? [{
                    type: 'Container',
                    spacing: 'Small',
                    items: [
                        {
                            type: 'TextBlock',
                            text: '**異常狀況說明：**',
                            weight: 'Bolder',
                            size: 'Small'
                        },
                        {
                            type: 'TextBlock',
                            text: data.description,
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
                ...(data.description ? [{
                    type: 'Container',
                    spacing: 'Small',
                    items: [
                        {
                            type: 'TextBlock',
                            text: '**異常狀況說明：**',
                            weight: 'Bolder',
                            size: 'Small'
                        },
                        {
                            type: 'TextBlock',
                            text: data.description,
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

        if (data.description) {
            lines.push(`**異常狀況說明：** ${data.description}`);
        }

        lines.push('');
        lines.push('---');
        lines.push('');
        lines.push('請確認以上資訊是否正確。');

        return lines.join('\n');
    }

}

