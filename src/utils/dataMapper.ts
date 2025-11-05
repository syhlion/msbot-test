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
    errorCode?: string;
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
    
    // 產生台灣時區的回報時間
    const reportTime = new Date().toLocaleString('zh-TW', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    return {
        ticketNumber,                           // A: 工單編號
        reportTime,                             // B: 回報時間（台灣時區）
        environment: formData.environment,      // C: 環境/整合商
        product: formData.product,              // D: 產品/遊戲
        issueDateTime,                          // E: 發生異常時間
        operation: formData.operation,          // F: 發生異常操作
        userId: formData.userId || '',          // G: UserID
        betOrderId: formData.betOrderId || '',  // H: 注單編號
        errorCode: formData.errorCode || '',    // I: 異常代碼（使用者填寫，選填）
        issueLink,                              // J: 異常單連結
        priority: formData.severity,            // K: 優先級別（= 異常嚴重度）
        assignee: formData.submitter || '',     // L: 對應人員（提交人）
        description: '',                        // M: 發生原因（由接收方處理後填寫，Bot 留空）
        resolution: '',                         // N: 處理方式（由接收方處理後填寫，Bot 留空）
    };
}

