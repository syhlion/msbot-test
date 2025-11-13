/**
 * 工單號碼產生器
 * 格式: ISS-YYYYMMDD-{Base36編碼}
 * 例如: ISS-20251113-2P2MXP
 * 
 * Base36 編碼包含時間(HHMMSS)和隨機數(RRR)，壓縮長度至 15-19 字元
 */

/**
 * 產生唯一的異常工單號碼
 * 格式: ISS-YYYYMMDD-{Base36}
 */
export function generateTicketNumber(): string {
    const now = new Date();
    
    // 日期部分: YYYYMMDD
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateString = `${year}${month}${day}`;
    
    // 時間部分: HHMMSS (6 位數字)
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timeValue = parseInt(`${hours}${minutes}${seconds}`); // 0-235959
    
    // 隨機數: 000-999
    const random = Math.floor(Math.random() * 1000); // 0-999
    
    // 組合成一個數字: HHMMSS * 1000 + RRR
    const combined = timeValue * 1000 + random;
    
    // 轉換為 Base36 (使用大寫)
    const base36Code = combined.toString(36).toUpperCase();
    
    return `ISS-${dateString}-${base36Code}`;
}

/**
 * 產生唯一的需求單號碼
 * 格式: REQ-YYYYMMDD-{Base36編碼}
 * 例如: REQ-20251113-2D5YU5
 * 
 * Base36 編碼包含時間(HHMMSS)和隨機數(RRR)，壓縮長度至 15-19 字元
 */
export function generateRequirementNumber(): string {
    const now = new Date();
    
    // 日期部分: YYYYMMDD
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateString = `${year}${month}${day}`;
    
    // 時間部分: HHMMSS (6 位數字)
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timeValue = parseInt(`${hours}${minutes}${seconds}`); // 0-235959
    
    // 隨機數: 000-999
    const random = Math.floor(Math.random() * 1000); // 0-999
    
    // 組合成一個數字: HHMMSS * 1000 + RRR
    const combined = timeValue * 1000 + random;
    
    // 轉換為 Base36 (使用大寫)
    const base36Code = combined.toString(36).toUpperCase();
    
    return `REQ-${dateString}-${base36Code}`;
}

/**
 * 重置計數器（用於測試）
 * 注：新版本使用時間戳+隨機數，不需要重置
 */
export function resetCounter(): void {
    // 保留此函數以維持向後兼容，但實際上不做任何事
}

