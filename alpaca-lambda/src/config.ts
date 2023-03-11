import { TradeParams } from './interfaces/trade_config';

export const config = {
    long: {
        orderSize: 3, // % from byuing power
        orderType: 'limit', // limit, market
        extendedHours: false, // true | false
        cancelPendingOrderPeriod: 5, // in seconds, fail as fast as possible. Do not change unless you have a good reason
        trailingStop: {
            enabled: true, // true, false
            trailPercent: 2, // % value away from the highest watermark
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
        limitBracket: {
            enabled: true,
            stopPrice: 3,
            takeProfit: 6,
        },
    } as TradeParams,
};

//TODO: Check with Vlad if those should in to AWS Secrets. It costs :(
//      $0.40 per secret per month
//      $0.05 per 10,000 API calls
export const credentials = {
    paper: {
        key: 'YOUR_KEY',
        secret: 'YOUR_SECRET',
        paper: true,
    },
    live: {
        key: 'YOUR_KEY',
        secret: 'YOUR_SECRET',
    },
};
