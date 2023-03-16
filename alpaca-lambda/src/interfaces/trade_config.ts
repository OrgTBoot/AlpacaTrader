export interface TradeParams {
    orderSize: number;
    orderType: string;
    limitBuyBufferPercent: number;
    timeInForce: 'day' | 'gtc';
    notional: boolean;
    extendedHours?: boolean;
    cancelPendingOrderPeriod: number;
    limit?: {
        enabled: boolean;
        stopPrice: number;
        takeProfit: number;
    };
    limitBracket?: {
        enabled: boolean;
        stopPrice: number;
        takeProfit: number;
    };
    trailingStop?: {
        enabled: boolean;
        trailPercent: number;
    };
}

export interface TradeConfig {
    long: TradeParams;
    short?: TradeParams;
}
