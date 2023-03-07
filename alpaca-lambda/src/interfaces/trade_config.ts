export interface TradeParams {
    orderSize: number;
    orderType: string;
    timeInForce: 'day' | 'gtc';
    stopLoss?: boolean;
    stopPrice?: number;
    takeProfit?: number;
    trailPercent?: number;
    notional: boolean;
    extendedHours?: boolean;
}

export interface TradeConfig {
    long: TradeParams;
    short?: TradeParams;
}
