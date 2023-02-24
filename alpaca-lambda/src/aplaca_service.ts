import { AlpacaClient, Order, PlaceOrder } from '@master-chief/alpaca';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { credentials, config } from './config';
import { TradeSignal } from './interfaces/trade-signal';
import { AlpacaError } from './interfaces/alpaca_error';
import { OrderType } from '@master-chief/alpaca/@types/entities';

export class AplacaService {
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
            const orderMoney: number = buyingPower - buyingPower * (1 - config.orderSize / 100);

            //get latest price for the symbol
            const askPrice: number = (await this.client.getSnapshot({ symbol: tradeSignal.ticker })).latestTrade.p;

            //calculate order quantity
            const orderQty = Math.round(orderMoney / askPrice);

            console.info(
                `buyingPower: ${buyingPower}, orderMoney: ${orderMoney}, askPrice: ${askPrice}, orderQty: ${orderQty}`,
            );

            const placeOrder: PlaceOrder = this.buildBuyPlaceOrder(tradeSignal, orderQty);

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
            qty: qty,
            side: 'buy',
            type: config.orderType as OrderType,
            time_in_force: 'day',
            extended_hours: config.extendedHours,
        };

        if (config.orderType == 'market') {
            return placeOrder;
        }

        placeOrder.limit_price = Number(tradeSignal.price);

        return placeOrder;
    }
}
