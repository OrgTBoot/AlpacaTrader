export interface TradeParams {
    orderSize: number;
    orderType: string;
    timeInForce: 'day' | 'gtc';
    notional: boolean;
    extendedHours?: boolean;
    cancelPendingOrderPeriod: number;
    limitBracket: {
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
