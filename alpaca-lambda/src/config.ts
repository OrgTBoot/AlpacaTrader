export const config = {
    long: {
        orderSize: 3, // % from byuing power
        orderType: 'market', // limit, market
        stopLoss: true, // true, false
        stopPrice: 3, // % below order price
        takeProfit: 6, // % above order price
        notional: false, // ture, false - if false system will calculate order qty
        extendedHours: false, // true | false
    },
    short: {},
};

export const cryptoConfig = {
    long: {
        orderSize: 3,
        orderType: 'market',
        notional: true,
    },
};

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
