export const config = {
    orderSize: 3, // % from byuing power
    orderType: 'market', // limit, market
    stopLoss: true, // true, false
    stopPrice: 5, // % below order price
    notional: true, // ture, false - if false system will calculate order qty
    extendedHours: false, // true | false
};

export const credentials = {
    key: 'PKV8LUS6ALJ9S3RSMU0I',
    secret: 'WyuBEVZcaoktIXCgBd1mmWteMrtYmm7EZyr3KZNH',
    paper: true,
};
