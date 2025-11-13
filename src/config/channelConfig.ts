/**
 * 頻道配置介面
 */
export interface ChannelConfig {
    /** 頻道識別名稱 (用於匹配頻道名稱) */
    name: string;
    
    /** 觸發 Bot 的關鍵字 (需要同時包含) */
    keywords: string[];
    
    /** Google Sheet ID */
    sheetId: string;
    
    /** Google Sheet 名稱 */
    sheetName: string;
    
    /** 描述 */
    description?: string;
}

/**
 * Google Sheets 設定
 * 統一在此處管理,不再依賴環境變數
 */
const GOOGLE_SHEETS_CONFIG = {
    sheetId: process.env.GOOGLE_SHEET_ID || '',  // 仍從環境變數讀取 Sheet ID
    issueSheetName: '工作表1',  // 異常工單的工作表名稱 (hardcoded)
    requirementSheetId: process.env.REQUIREMENT_SHEET_ID || '',  // 需求單 Sheet ID
    requirementSheetName: '需求',  // 需求單的工作表名稱
    // 未來可以新增其他工作表
    // releaseSheetName: '上版記錄',
};

/**
 * 頻道配置清單
 * 當需要新增頻道時,在此新增配置即可
 */
export const channelConfigs: ChannelConfig[] = [
    {
        name: '*異常*',
        keywords: ['遊戲商系統', 'SRE'],
        sheetId: GOOGLE_SHEETS_CONFIG.sheetId,
        sheetName: GOOGLE_SHEETS_CONFIG.issueSheetName,
        description: '異常回報處理 (Issue/Bug Tracking)'
    },
    {
        name: '*需求*',  // 萬用字元匹配，可匹配「需求」、「需求頻道」、「產品需求」等
        keywords: ['遊戲商系統'],
        sheetId: GOOGLE_SHEETS_CONFIG.requirementSheetId,
        sheetName: GOOGLE_SHEETS_CONFIG.requirementSheetName,
        description: '需求管理 (Requirement Tracking)'
    }
    
    // 未來擴充範例:
    // {
    //     name: '上版',
    //     keywords: ['上版', 'Release'],
    //     sheetId: process.env.RELEASE_SHEET_ID || '',
    //     sheetName: '上版記錄',
    //     description: '上版記錄管理'
    // }
];

/**
 * 根據頻道名稱獲取對應的配置
 * 支援萬用字元匹配（使用 * 代表任意字符）
 * @param channelName 頻道名稱 (中文名稱)
 * @returns 對應的頻道配置,如果沒有匹配則返回 null
 * 
 * 匹配規則：
 * - 如果 config.name 包含萬用字元 *，則使用正則表達式模糊匹配
 *   例如：'*需求*' 可匹配「需求」、「需求頻道」、「產品需求」等
 * - 如果 config.name 不包含萬用字元，則使用精確匹配（區分大小寫）
 *   例如：'異常' 只能匹配頻道名稱完全為「異常」的頻道
 */
export function getChannelConfig(channelName: string): ChannelConfig | null {
    const config = channelConfigs.find(config => {
        // 檢查是否包含萬用字元
        if (config.name.includes('*')) {
            // 使用萬用字元模糊匹配
            // 將萬用字元 * 轉換為正則表達式 .*
            // 例如：*需求* -> /^.*需求.*$/i
            const pattern = config.name.replace(/\*/g, '.*');
            const regex = new RegExp(`^${pattern}$`, 'i');
            return regex.test(channelName);
        } else {
            // 精確匹配（完全相等）
            return channelName === config.name;
        }
    });
    


    if (config) {
        console.log(`[匹配] 頻道名稱「${channelName}」匹配配置「${config.name}」`);
    }
    
    return config || null;
}

/**
 * 檢查訊息是否包含必要的關鍵字
 * @param message 訊息內容
 * @param keywords 關鍵字列表
 * @returns 是否所有關鍵字都存在
 */
export function hasRequiredKeywords(message: string, keywords: string[]): boolean {
    return keywords.every(keyword => 
        message.toLowerCase().includes(keyword.toLowerCase())
    );
}

