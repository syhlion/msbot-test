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
 * @returns Google Sheets 資料列
 */
export function mapFormDataToSheetRow(
    ticketNumber: string,
    formData: RecordFormData
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
        severity: formData.severity,            // I: 異常嚴重度
        priority: formData.severity,            // J: 優先級別（= 異常嚴重度）
        assignee: '',                           // K: 對應人員（預留，暫時留空）
        description: formData.description || '', // L: 發生原因
        resolution: '',                         // M: 處理方式（預留，暫時留空）
    };
}

