import { TradeParams } from './interfaces/trade_config';

export const config = {
    long: {
        orderSize: 3, // % from byuing power
        orderType: 'limit', // limit, market
        extendedHours: false, // true | false
        cancelPendingOrderPeriod: 5, // in seconds, fail as fast as possible. Do not change unless you have a good reason
        trailingStop: {
            enabled: true, // true, false
            trailPercent: 5, // % value away from the highest watermark
        },
        limitBracket: {
            enabled: false, // true, false - always set it to false if trailingStop.enabled=true
            stopPrice: 3, // % below order price
            takeProfit: 999, // % above order price
        },
    } as TradeParams,
    short: {} as TradeParams,
};

export const cryptoConfig = {
    long: {
        orderSize: 3,
        orderType: 'limit',
        cancelPendingOrderPeriod: 5, // in seconds, fail as fast as possible. Do not change unless you have a good reason
        limit: {
            enabled: true,
            stopPrice: 3,
        },
    } as TradeParams,
};

export const credentials = {
    paper: {
        key: process.env.AlpacaTraderPaperKey ?? '',
        secret: process.env.AlpacaTraderPaperSecret ?? '',
        paper: true,
    },
    live: {
        key: process.env.AlpacaTraderLiveKey ?? '',
        secret: process.env.AlpacaTraderLiveSecret ?? '',
    },
};
