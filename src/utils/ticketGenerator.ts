/**
 * 工單號碼產生器
 * 格式: SRE-YYYYMMDD-XXX
 * 例如: SRE-20251030-001
 */

let dailyCounter = 0;
let lastGeneratedDate = '';

/**
 * 產生唯一的工單號碼
 */
export function generateTicketNumber(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateString = `${year}${month}${day}`;

    // 如果日期改變，重置計數器
    if (dateString !== lastGeneratedDate) {
        dailyCounter = 0;
        lastGeneratedDate = dateString;
    }

    // 遞增計數器
    dailyCounter++;

    // 格式化計數器為 3 位數
    const counterString = String(dailyCounter).padStart(3, '0');

    return `SRE-${dateString}-${counterString}`;
}

/**
 * 重置計數器（用於測試）
 */
export function resetCounter(): void {
    dailyCounter = 0;
    lastGeneratedDate = '';
}

