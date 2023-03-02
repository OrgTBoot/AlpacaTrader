export const config = {
    long: {
        orderSize: 3, // % from byuing power
        orderType: 'market', // limit, market
        stopLoss: true, // true, false
        stopPrice: 5, // % below order price
        takeProfit: 10, // % above order price
        notional: false, // ture, false - if false system will calculate order qty
        extendedHours: false, // true | false
    },
    short: {},
};

export const credentials = {
    paper: {
        key: 'YOUR_KEY',
        secret: 'YOUR_SECRET'
    },
    live: {
        key: 'YOUR_KEY',
        secret: 'YOUR_SECRET'
    }

};
