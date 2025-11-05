import { google, sheets_v4 } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Google Sheets 寫入的資料格式
 */
export interface SheetRowData {
    ticketNumber: string;       // A: 工單編號
    environment: string;        // B: 環境/整合商
    product: string;            // C: 產品/遊戲
    issueDateTime: string;      // D: 發生異常時間
    operation: string;          // E: 發生異常操作
    userId: string;             // F: UserID
    betOrderId: string;         // G: 注單編號
    errorCode: string;          // H: 異常代碼（預留）
    severity: string;           // I: 異常嚴重度
    priority: string;           // J: 優先級別（= 異常嚴重度）
    assignee: string;           // K: 對應人員（預留）
    description: string;        // L: 發生原因
    resolution: string;         // M: 處理方式（預留）
}

/**
 * Google Sheets Service
 * 負責將工單資料寫入 Google Sheets
 */
export class GoogleSheetService {
    private sheets: sheets_v4.Sheets | null = null;
    private spreadsheetId: string;
    private sheetName: string;

    constructor() {
        this.spreadsheetId = process.env.GOOGLE_SHEET_ID || '';
        this.sheetName = process.env.GOOGLE_SHEET_NAME || '工作表1';
        
        if (!this.spreadsheetId) {
            console.warn('[WARN] GOOGLE_SHEET_ID 未設定，Google Sheets 功能將被停用');
        }
    }

    /**
     * 初始化 Google Sheets API 客戶端
     */
    private async initialize(): Promise<void> {
        if (this.sheets) {
            return; // 已初始化
        }

        const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;
        
        if (!serviceAccountPath) {
            throw new Error('GOOGLE_SERVICE_ACCOUNT_PATH 環境變數未設定');
        }

        // 檢查檔案是否存在
        if (!fs.existsSync(serviceAccountPath)) {
            throw new Error(`Service Account 檔案不存在: ${serviceAccountPath}`);
        }

        // 讀取 Service Account JSON
        const serviceAccountJson = JSON.parse(
            fs.readFileSync(serviceAccountPath, 'utf-8')
        );

        // 建立 Google Auth 客戶端
        const auth = new google.auth.GoogleAuth({
            credentials: serviceAccountJson,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        // 建立 Sheets API 客戶端
        this.sheets = google.sheets({ version: 'v4', auth });

        console.log('[OK] Google Sheets API 初始化成功');
    }

    /**
     * 檢查 Google Sheets 功能是否已啟用
     */
    public isEnabled(): boolean {
        return !!this.spreadsheetId && !!process.env.GOOGLE_SERVICE_ACCOUNT_PATH;
    }

    /**
     * 將工單資料寫入 Google Sheets
     * @param data 工單資料
     */
    public async appendRow(data: SheetRowData): Promise<void> {
        if (!this.isEnabled()) {
            console.warn('[WARN] Google Sheets 功能未啟用，跳過寫入');
            return;
        }

        try {
            // 確保已初始化
            await this.initialize();

            if (!this.sheets) {
                throw new Error('Google Sheets API 初始化失敗');
            }

            // 準備要寫入的資料列（對應 A-M 欄）
            const row = [
                data.ticketNumber,    // A: 工單編號
                data.environment,     // B: 環境/整合商
                data.product,         // C: 產品/遊戲
                data.issueDateTime,   // D: 發生異常時間
                data.operation,       // E: 發生異常操作
                data.userId,          // F: UserID
                data.betOrderId,      // G: 注單編號
                data.errorCode,       // H: 異常代碼
                data.severity,        // I: 異常嚴重度
                data.priority,        // J: 優先級別
                data.assignee,        // K: 對應人員
                data.description,     // L: 發生原因
                data.resolution,      // M: 處理方式
            ];

            // 寫入資料到 Sheet
            const response = await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: `${this.sheetName}!A:M`,
                valueInputOption: 'RAW',
                requestBody: {
                    values: [row],
                },
            });

            console.log(`[OK] 成功寫入 Google Sheets: ${data.ticketNumber}`);
            console.log(`[INFO] 更新範圍: ${response.data.updates?.updatedRange}`);
        } catch (error) {
            console.error('[ERROR] 寫入 Google Sheets 失敗:', error);
            
            // 詳細錯誤訊息
            if (error instanceof Error) {
                console.error(`[ERROR] 錯誤訊息: ${error.message}`);
                if ('code' in error) {
                    console.error(`[ERROR] 錯誤代碼: ${(error as any).code}`);
                }
            }
            
            // 不要拋出錯誤，避免影響主流程
            // 只記錄錯誤，讓 Bot 繼續運作
        }
    }

    /**
     * 測試 Google Sheets 連線
     */
    public async testConnection(): Promise<boolean> {
        if (!this.isEnabled()) {
            console.warn('[WARN] Google Sheets 功能未啟用');
            return false;
        }

        try {
            await this.initialize();

            if (!this.sheets) {
                return false;
            }

            // 嘗試讀取 Sheet 的元資料
            const response = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId,
            });

            console.log(`[OK] 成功連接到 Google Sheet: ${response.data.properties?.title}`);
            return true;
        } catch (error) {
            console.error('[ERROR] Google Sheets 連線測試失敗:', error);
            return false;
        }
    }
}

// 建立單例實例
export const googleSheetService = new GoogleSheetService();

