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
    
    /** 允許的頻道 ID 白名單 (可選,如果設定則只在這些頻道中運作) */
    allowedChannelIds?: string[];
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
        description: '異常回報處理 (Issue/Bug Tracking)',
        // 暫時使用頻道 ID 白名單 (如果頻道名稱無法正確取得)
        // 請將下方註解取消,並替換為你的頻道 ID
        // allowedChannelIds: ['19:-XowN2vJvgG4ZPcpoaykHXtOkTCcTtEudC0erJt2o9U1@thread.tacv2']
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
 * 根據頻道名稱或頻道 ID 獲取對應的配置
 * @param channelName 頻道名稱 (可能包含中文或頻道 ID)
 * @param channelId 頻道 ID (用於白名單匹配)
 * @returns 對應的頻道配置,如果沒有匹配則返回 null
 */
export function getChannelConfig(channelName: string, channelId?: string): ChannelConfig | null {
    return channelConfigs.find(config => {
        // 優先檢查頻道 ID 白名單
        if (config.allowedChannelIds && config.allowedChannelIds.length > 0 && channelId) {
            const isAllowed = config.allowedChannelIds.includes(channelId);
            if (isAllowed) {
                console.log(`[匹配] 頻道 ID「${channelId}」在配置「${config.name}」的白名單中`);
                return true;
            }
        }
        
        // 降級: 檢查頻道名稱是否包含配置的 name
        const matchByName = channelName.includes(config.name);
        if (matchByName) {
            console.log(`[匹配] 頻道名稱「${channelName}」包含配置「${config.name}」`);
        }
        return matchByName;
    }) || null;
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

