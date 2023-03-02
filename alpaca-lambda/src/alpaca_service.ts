import { AlpacaClient, Order, PlaceOrder } from '@master-chief/alpaca';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { credentials, config } from './config';
import { TradeSignal } from './interfaces/trade_signal';
import { AlpacaError } from './interfaces/alpaca_error';
import { OrderType } from '@master-chief/alpaca/@types/entities';

export class AlpacaService {
    private client: AlpacaClient;

    constructor() {
        this.client = new AlpacaClient({
            credentials: credentials,
            rate_limit: true,
        });
    }

    async processEvent(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
        console.info('Event: ', event.body);

        try {
            const tradeSignal = JSON.parse(event.body ?? '') as TradeSignal;

            console.info('TradeSignal: ', tradeSignal);

            if (tradeSignal.action === 'buy') return this.processBuySignal(tradeSignal);

            if (tradeSignal.action === 'sell') return this.processSellSignal(tradeSignal);
        } catch (err) {
            console.error('Failed to process event: ', err);
        }

        return this.buildSuccessResponse(JSON.stringify({ message: 'Unknown route' }));
    }

    private async processSellSignal(tradeSignal: TradeSignal): Promise<APIGatewayProxyResult> {
        let closeOrder: Order;
        let openOrders: Order[];

        try {
            //if open orders are available cancel them
            openOrders = await this.client.getOrders({ status: 'open', symbols: [tradeSignal.ticker] });

            openOrders.forEach(async (order) => {
                console.warn('Cancel order: ', order);
                try {
                    await this.client.cancelOrder({ order_id: order.id });
                } catch (err) {
                    console.error(`Failed to cancel order ${order.id}: `, err);
                }
            });

            //close entire position
            closeOrder = await this.client.closePosition({ symbol: tradeSignal.ticker });
        } catch (err) {
            return this.errorResonse(err, tradeSignal);
        }

        console.info('Position closed: ', closeOrder);

        return this.buildSuccessResponse(JSON.stringify(closeOrder));
    }

    private async processBuySignal(tradeSignal: TradeSignal): Promise<APIGatewayProxyResult> {
        let buyOrder: Order;

        try {
            //get account buying power
            const buyingPower: number = (await this.client.getAccount()).buying_power;

            //substract order size percentage from buyingPower
            const orderMoney: number = buyingPower - buyingPower * (1 - config.long.orderSize / 100);

            //get latest price for the symbol
            const askPrice: number = (await this.client.getSnapshot({ symbol: tradeSignal.ticker })).latestTrade.p;

            let placeOrder: PlaceOrder;

            if (config.long.notional) {
                //use orderMoney as notional
                console.info(`buyingPower: ${buyingPower}, orderMoney: ${orderMoney}, askPrice: ${askPrice}`);

                placeOrder = this.buildBuyPlaceOrder(tradeSignal, orderMoney);
            } else {
                //calculate order quantity
                const orderQty = Math.round(orderMoney / askPrice);

                console.info(
                    `buyingPower: ${buyingPower}, orderMoney: ${orderMoney}, askPrice: ${askPrice}, orderQty: ${orderQty}`,
                );

                placeOrder = this.buildBuyPlaceOrder(tradeSignal, orderQty);
            }

            //att stop loss if config.long.stopLostt = true
            placeOrder = this.attachStopLoss(placeOrder, askPrice);

            console.info('Submit order: ', placeOrder);

            buyOrder = await this.client.placeOrder(placeOrder);
        } catch (err) {
            return this.errorResonse(err, tradeSignal);
        }

        console.info('Buy order placed: ', buyOrder);

        return this.buildSuccessResponse(JSON.stringify(buyOrder));
    }

    private async buildSuccessResponse(data: string): Promise<APIGatewayProxyResult> {
        return this.buildResponse(200, data);
    }

    private async buildResponse(statusCode: number, data: string): Promise<APIGatewayProxyResult> {
        return new Promise((resolve) => {
            resolve({
                statusCode: statusCode,
                body: data,
            } as APIGatewayProxyResult);
        });
    }

    private isAlpacaError(err: unknown): err is AlpacaError {
        return typeof err === 'object' && err !== null && 'code' in err && 'message' in err;
    }

    private errorResonse(err: unknown, tradeSignal: TradeSignal) {
        console.error(`Failed to process trade signal for ${tradeSignal.ticker}: `, err);

        if (this.isAlpacaError(err) && err.message.startsWith('position not found'))
            return this.buildResponse(404, JSON.stringify(err));

        return this.buildResponse(500, JSON.stringify(err));
    }

    private buildBuyPlaceOrder(tradeSignal: TradeSignal, qty: number): PlaceOrder {
        const placeOrder: PlaceOrder = {
            symbol: tradeSignal.ticker,
            side: 'buy',
            type: config.long.orderType as OrderType,
            time_in_force: 'day',
            extended_hours: config.long.extendedHours,
        };

        if (config.long.notional) placeOrder.notional = qty;
        else placeOrder.qty = qty;

        if (config.long.orderType == 'market') return placeOrder;

        placeOrder.limit_price = Number(tradeSignal.price);

        return placeOrder;
    }

    private attachStopLoss(placeOrder: PlaceOrder, askPrice: number): PlaceOrder {
        if (config.long.stopLoss) {
            const stopPrice = askPrice * (1 - config.long.stopPrice / 100);
            const limitPrice = askPrice * (1 + config.long.takeProfit / 100);
            placeOrder.stop_loss = { stop_price: this.round(stopPrice) };
            placeOrder.take_profit = { limit_price: this.round(limitPrice) };
            placeOrder.order_class = 'bracket';
        }
        return placeOrder;
    }

    private round(num: number): number {
        return Math.round((num + Number.EPSILON) * 100) / 100;
    }
}
