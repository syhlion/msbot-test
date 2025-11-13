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
 * 需求單表單資料介面
 */
export interface RequirementFormData {
    department: string;           // 需求部門
    product: string;              // 產品名稱
    contact: string;              // 聯絡窗口
    communicationChannel?: string; // 溝通頻道
    expectedOnlineDate: string;   // 期望上線時間
    requirementIssue: string;     // 需求問題
    requirementDocument?: string; // 需求文件
    requirementReason: string;    // 需求原因
    description?: string;         // 需求描述
    submitter?: string;           // 提交人
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

/**
 * 將需求單表單資料轉換為 Google Sheets 資料格式
 * @param requirementNumber 需求單編號
 * @param formData 需求單表單資料
 * @param requirementLink Teams 訊息連結（選填）
 * @returns Google Sheets 資料列（需求單格式）
 */
export function mapRequirementDataToSheetRow(
    requirementNumber: string,
    formData: RequirementFormData,
    requirementLink: string = ''
): any[] {
    // 產生台灣時區的建立時間
    const createTime = new Date().toLocaleString('zh-TW', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    // 返回陣列格式，對應 Google Sheets 的欄位順序
    return [
        requirementNumber,                              // A: 需求編號
        formData.department,                            // B: 需求部門
        formData.product,                               // C: 產品名稱
        formData.contact,                               // D: 聯絡窗口
        formData.communicationChannel || '/',           // E: 溝通頻道
        formData.expectedOnlineDate,                    // F: 期望上線時間
        formData.requirementIssue,                      // G: 需求問題
        formData.requirementDocument || '',             // H: 需求文件
        formData.requirementReason,                     // I: 需求原因
        formData.description || '',                     // J: 需求描述
        formData.submitter || '',                       // K: 提交人
        createTime,                                     // L: 建立時間
        requirementLink                                 // M: 需求單連結
    ];
}

