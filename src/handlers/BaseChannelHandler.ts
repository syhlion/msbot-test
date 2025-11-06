import { TurnContext } from 'botbuilder';
import { ChannelConfig } from '../config/channelConfig';

/**
 * 頻道處理器基類
 * 所有頻道處理器都需要繼承此類別並實作抽象方法
 */
export abstract class BaseChannelHandler {
    protected config: ChannelConfig;

    constructor(config: ChannelConfig) {
        this.config = config;
    }

    /**
     * 處理訊息的主要入口
     * @param context Bot 上下文
     * @param message 訊息內容
     */
    public async handle(context: TurnContext, message: string): Promise<void> {
        console.log(`[${this.config.name}] 開始處理訊息`);

        // 嘗試自動建單
        if (message.length > 50) {
            console.log(`[${this.config.name}] 嘗試自動建單模式...`);
            const autoCreated = await this.tryAutoCreate(context, message);
            if (autoCreated) {
                console.log(`[${this.config.name}] 自動建單成功`);
                return;
            }
            console.log(`[${this.config.name}] 自動建單失敗,切換到表單模式`);
        }

        // 顯示表單
        console.log(`[${this.config.name}] 顯示手動填寫表單`);
        await this.showForm(context);
    }

    /**
     * 偵測是否為表格格式
     * @param message 訊息內容
     * @returns 是否為表格格式
     */
    protected abstract detectTableFormat(message: string): boolean;

    /**
     * 解析訊息內容
     * @param message 訊息內容
     * @returns 解析後的資料
     */
    protected abstract parseMessage(message: string): any;

    /**
     * 嘗試自動建單
     * @param context Bot 上下文
     * @param message 訊息內容
     * @returns 是否成功建單
     */
    protected abstract tryAutoCreate(context: TurnContext, message: string): Promise<boolean>;

    /**
     * 顯示表單
     * @param context Bot 上下文
     */
    protected abstract showForm(context: TurnContext): Promise<void>;

    /**
     * 處理表單提交
     * @param context Bot 上下文
     * @param formData 表單資料
     */
    public abstract handleFormSubmit(context: TurnContext, formData: any): Promise<void>;
}

