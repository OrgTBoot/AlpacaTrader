export interface TradeParams {
    orderSize: number;
    orderType: string;
    stopLoss?: boolean;
    stopPrice?: number;
    takeProfit?: number;
    notional: boolean;
    extendedHours?: boolean;
}

export interface TradeConfig {
    long: TradeParams;
    short?: TradeParams;
}
