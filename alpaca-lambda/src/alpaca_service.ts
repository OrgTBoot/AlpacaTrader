import { AlpacaClient, Order, PlaceOrder } from '@master-chief/alpaca';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { credentials } from './config';
import { TradeSignal } from './interfaces/trade_signal';
import { AlpacaError } from './interfaces/alpaca_error';
import { OrderType } from '@master-chief/alpaca/@types/entities';
import { TradeConfig, TradeParams } from './interfaces/trade_config';
import { AlpacaClientExtention } from './alpaca_client_extention';

export abstract class AlpacaService {
    private paperClient: AlpacaClientExtention;
    private liveClient: AlpacaClientExtention;
    private longTradeParams: TradeParams;
    private shortTradeParams: TradeParams;

    constructor(tradeConfig: TradeConfig) {
        this.paperClient = new AlpacaClientExtention({
            credentials: credentials.paper,
            rate_limit: true,
        });
        this.liveClient = new AlpacaClientExtention({
            credentials: credentials.live,
            rate_limit: true,
        });
        this.longTradeParams = tradeConfig.long;
        this.shortTradeParams = tradeConfig.short ?? ({} as TradeParams);
    }

    async processPaperEvent(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
        return this.processEvent(this.paperClient, event);
    }

    async processLiveEvent(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
        return this.processEvent(this.liveClient, event);
    }

    async processEvent(client: AlpacaClient, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
        console.info('Event: ', event.body);

        try {
            const tradeSignal = JSON.parse(event.body ?? '') as TradeSignal;

            console.info('TradeSignal: ', tradeSignal);

            if (tradeSignal.action === 'buy') return this.processBuySignal(client, tradeSignal);

            if (tradeSignal.action === 'sell') return this.processSellSignal(client, tradeSignal);
        } catch (err) {
            console.error('Failed to process event: ', err);
        }

        return this.buildSuccessResponse(JSON.stringify({ message: 'Unknown route' }));
    }

    protected abstract getCurrentPrice(client: AlpacaClient, tradeSignal: TradeSignal): Promise<number>;

    protected abstract computeOrderQty(orderMoney: number, askPrice: number): number;

    private async processSellSignal(client: AlpacaClient, tradeSignal: TradeSignal): Promise<APIGatewayProxyResult> {
        let closeOrder: Order;
        let openOrders: Order[];

        try {
            //if open orders are available cancel them
            openOrders = await client.getOrders({ status: 'open', symbols: [tradeSignal.ticker] });

            openOrders.forEach(async (order) => {
                console.warn('Cancel order: ', order);
                try {
                    await client.cancelOrder({ order_id: order.id });
                } catch (err) {
                    console.error(`Failed to cancel order ${order.id}: `, err);
                }
            });

            //close entire position
            closeOrder = await client.closePosition({ symbol: tradeSignal.ticker });
        } catch (err) {
            return this.errorResonse(err, tradeSignal);
        }

        console.info('Position closed: ', closeOrder);

        return this.buildSuccessResponse(JSON.stringify(closeOrder));
    }

    private async processBuySignal(client: AlpacaClient, tradeSignal: TradeSignal): Promise<APIGatewayProxyResult> {
        let buyOrder: Order;

        try {
            //get account buying power
            const buyingPower: number = (await client.getAccount()).buying_power;

            //substract order size percentage from buyingPower
            const orderMoney: number = buyingPower - buyingPower * (1 - this.longTradeParams.orderSize / 100);

            //get latest price for the symbol
            const askPrice: number = await this.getCurrentPrice(client, tradeSignal);

            let placeOrder: PlaceOrder;

            if (this.longTradeParams.notional) {
                //use orderMoney as notional
                console.info(`buyingPower: ${buyingPower}, orderMoney: ${orderMoney}, askPrice: ${askPrice}`);

                placeOrder = this.buildBuyPlaceOrder(tradeSignal, orderMoney);
            } else {
                //calculate order quantity
                const orderQty = this.computeOrderQty(orderMoney, askPrice);

                console.info(
                    `buyingPower: ${buyingPower}, orderMoney: ${orderMoney}, askPrice: ${askPrice}, orderQty: ${orderQty}`,
                );

                placeOrder = this.buildBuyPlaceOrder(tradeSignal, orderQty);
            }

            //att stop loss if tradeConfig.stopLoss = true
            placeOrder = this.attachStopLoss(placeOrder, askPrice);

            console.info('Submit order: ', placeOrder);

            buyOrder = await client.placeOrder(placeOrder);
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
        return typeof err === 'object' && err !== null && 'message' in err;
    }

    private errorResonse(err: unknown, tradeSignal: TradeSignal) {
        console.error(`Failed to process trade signal for ${tradeSignal.ticker}: `, err);

        if (this.isAlpacaError(err) && (err.message.includes('not found') || err.message.includes('not find')))
            return this.buildResponse(404, JSON.stringify(err));

        if (this.isAlpacaError(err) && err.message.includes('forbidden'))
            return this.buildResponse(403, JSON.stringify(err));

        return this.buildResponse(500, JSON.stringify(err));
    }

    private buildBuyPlaceOrder(tradeSignal: TradeSignal, qty: number): PlaceOrder {
        let order: PlaceOrder = {
            symbol: tradeSignal.ticker,
            side: 'buy',
            type: this.longTradeParams.orderType as OrderType,
            time_in_force: this.longTradeParams.timeInForce,
            extended_hours: this.longTradeParams.extendedHours ?? false,
        };

        this.calculateNational(order, qty)
        this.calculateQty(order, qty)
        this.calculateLimitPrice(order, tradeSignal)
        this.calculateTrailPercent(order)

        return order;
    }

    private calculateNational(order: PlaceOrder, qty: number): void {
        if (this.longTradeParams.notional) {
            order.notional = qty;
        }
    }

    private calculateQty(order: PlaceOrder, qty: number): void {
        if (!this.longTradeParams.notional) {
            order.qty = qty
        }
    }

    private calculateLimitPrice(order: PlaceOrder, tradeSignal: TradeSignal): void {
        if (this.longTradeParams.orderType == 'limit') {
            order.limit_price = Number(tradeSignal.price)
        }
    }

    private calculateTrailPercent(order: PlaceOrder): void {
        if (this.longTradeParams.orderType == 'trailing_stop') {
            order.trail_percent = this.longTradeParams.trailPercent;
        }
    }

    private attachStopLoss(placeOrder: PlaceOrder, askPrice: number): PlaceOrder {
        if (this.longTradeParams.stopLoss && this.longTradeParams.stopPrice && this.longTradeParams.takeProfit) {
            const stopPrice = askPrice * (1 - this.longTradeParams.stopPrice / 100);
            const limitPrice = askPrice * (1 + this.longTradeParams.takeProfit / 100);
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
