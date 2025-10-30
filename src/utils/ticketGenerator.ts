/**
 * 工單號碼產生器
 * 格式: SRE-YYYYMMDD-HHMMSS-RRR
 * 例如: SRE-20251030-163045-123
 * 
 * 使用時間戳 + 隨機數確保唯一性，避免並發衝突
 */

/**
 * 產生唯一的工單號碼
 */
export function generateTicketNumber(): string {
    const now = new Date();
    
    // 日期部分: YYYYMMDD
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateString = `${year}${month}${day}`;
    
    // 時間部分: HHMMSS
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timeString = `${hours}${minutes}${seconds}`;
    
    // 隨機數: 000-999
    const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    
    return `SRE-${dateString}-${timeString}-${random}`;
}

/**
 * 重置計數器（用於測試）
 * 注：新版本使用時間戳+隨機數，不需要重置
 */
export function resetCounter(): void {
    // 保留此函數以維持向後兼容，但實際上不做任何事
}

