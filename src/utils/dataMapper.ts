import { SheetRowData } from '../services/googleSheetService';

/**
 * Bot 表單資料介面（與 bot.ts 中的定義一致）
 */
export interface RecordFormData {
    environment: string;
    product: string;
    issueDate: string;
    issueTime: string;
    operation: string;
    userId?: string;
    betOrderId?: string;
    severity: string;
    description?: string;
    submitter?: string;
}

/**
 * 將 Bot 表單資料轉換為 Google Sheets 資料格式
 * @param ticketNumber 工單編號
 * @param formData 表單資料
 * @param issueLink Teams 訊息連結（選填）
 * @returns Google Sheets 資料列
 */
export function mapFormDataToSheetRow(
    ticketNumber: string,
    formData: RecordFormData,
    issueLink: string = ''
): SheetRowData {
    // 合併日期和時間
    const issueDateTime = `${formData.issueDate} ${formData.issueTime}`;

    return {
        ticketNumber,                           // A: 工單編號
        environment: formData.environment,      // B: 環境/整合商
        product: formData.product,              // C: 產品/遊戲
        issueDateTime,                          // D: 發生異常時間
        operation: formData.operation,          // E: 發生異常操作
        userId: formData.userId || '',          // F: UserID
        betOrderId: formData.betOrderId || '',  // G: 注單編號
        errorCode: '',                          // H: 異常代碼（預留，暫時留空）
        issueLink,                              // I: 異常單連結
        severity: formData.severity,            // J: 異常嚴重度
        priority: formData.severity,            // K: 優先級別（= 異常嚴重度）
        assignee: '',                           // L: 對應人員（預留，暫時留空）
        description: formData.description || '', // M: 發生原因
        resolution: '',                         // N: 處理方式（預留，暫時留空）
    };
}

