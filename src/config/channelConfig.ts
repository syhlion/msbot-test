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
 * 頻道配置清單
 * 當需要新增頻道時,在此新增配置即可
 */
export const channelConfigs: ChannelConfig[] = [
    {
        name: '異常',
        keywords: ['遊戲商系統', 'SRE'],
        sheetId: process.env.GOOGLE_SHEET_ID || '',
        sheetName: process.env.GOOGLE_SHEET_NAME || '異常工單',
        description: '異常回報處理 (Issue/Bug Tracking)'
    },
    
    // 未來擴充範例:
    // {
    //     name: '需求',
    //     keywords: ['需求', 'Feature'],
    //     sheetId: process.env.REQUIREMENT_SHEET_ID || '',
    //     sheetName: '需求清單',
    //     description: '需求管理'
    // },
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
 * @param channelName 頻道名稱 (中文名稱)
 * @returns 對應的頻道配置,如果沒有匹配則返回 null
 */
export function getChannelConfig(channelName: string): ChannelConfig | null {
    const config = channelConfigs.find(config => channelName.includes(config.name));
    
    if (config) {
        console.log(`[匹配] 頻道名稱「${channelName}」包含配置「${config.name}」`);
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

