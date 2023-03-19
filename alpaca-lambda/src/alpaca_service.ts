import { AlpacaClient, Order, PlaceOrder } from '@master-chief/alpaca';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { credentials } from './config';
import { TradeSignal } from './interfaces/trade_signal';
import { AlpacaError } from './interfaces/alpaca_error';
import { OrderType } from '@master-chief/alpaca/@types/entities';
import { TradeConfig, TradeParams } from './interfaces/trade_config';
import { AlpacaClientExtention } from './alpaca_client_extention';
import { AlpacaOrderService } from './alpaca_order_service';

export abstract class AlpacaService extends AlpacaOrderService {
    private paperClient: AlpacaClientExtention;
    private liveClient: AlpacaClientExtention;
    private longTradeParams: TradeParams;
    private shortTradeParams: TradeParams;

    constructor(tradeConfig: TradeConfig) {
        super();
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
        this.validateConfigFlags();

        try {
            const tradeSignal = JSON.parse(event.body ?? '') as TradeSignal;

            console.info('TRADE SIGNAL: ', tradeSignal);

            if (tradeSignal.action === 'buy') return this.processBuySignal(client, tradeSignal);

            if (tradeSignal.action === 'sell') return this.processSellSignal(client, tradeSignal);
        } catch (err) {
            console.error('Failed to process event: ', err);
        }

        return this.buildSuccessResponse(JSON.stringify({ message: 'Unknown route' }));
    }

    /**
     * Closes open orders and position
     * */
    private async processSellSignal(client: AlpacaClient, tradeSignal: TradeSignal): Promise<APIGatewayProxyResult> {
        try {
            await this.cancelOpenOrders(client, tradeSignal.ticker);
            const closeOrder: Order = await client.closePosition({ symbol: tradeSignal.ticker });
            console.info('POSITION CLOSED ', JSON.stringify(closeOrder));

            return this.buildSuccessResponse(JSON.stringify(closeOrder));
        } catch (err) {
            return this.errorResponse(err, tradeSignal);
        }
    }

    private async processBuySignal(client: AlpacaClient, tradeSignal: TradeSignal): Promise<APIGatewayProxyResult> {
        let placeOrder: PlaceOrder;
        let buyOrder: Order;
        let trailingSellOrder: Order | undefined = undefined;
        let placeTrailingOrder: PlaceOrder | undefined = undefined;

        try {
            const orderType = this.longTradeParams.orderType as OrderType;

            if (orderType == 'market') {
                placeOrder = await super.getLongBuyMarketOrder(client, tradeSignal, this.longTradeParams);
            } else if (orderType == 'limit') {
                placeOrder = await super.getLongBuyLimitOrder(client, tradeSignal, this.longTradeParams);
            } else {
                throw new Error(`Unsupported order type received: ${JSON.stringify(tradeSignal)}`);
            }

            console.info('Submitting Long Buy order: ', JSON.stringify(placeOrder));
            buyOrder = await client.placeOrder(placeOrder);
            buyOrder = await this.awaitOrderFillOrCancel(
                client,
                buyOrder.id,
                this.longTradeParams.cancelPendingOrderPeriod,
            );

            if (super.isTrailingOrderAllowed(buyOrder, tradeSignal, this.longTradeParams)) {
                placeTrailingOrder = await super.getLongSellTrailingStopOrder(
                    client,
                    tradeSignal,
                    buyOrder,
                    this.longTradeParams,
                );
                console.info(`Submitted Long Sell TRAILING order.`, JSON.stringify(placeTrailingOrder));

                trailingSellOrder = await client.placeOrder(placeTrailingOrder);
                console.info(`Placed Long Sell TRAILING order.`, JSON.stringify(trailingSellOrder));
            }

            //Reach log statements - used in AWS log insights queries to build reports
            console.info(`SIGNAL PROCESSED ${JSON.stringify(tradeSignal)}, ${JSON.stringify(this.longTradeParams)}`);
            console.info(`BUY ORDER PAYLOAD ${JSON.stringify(placeOrder)}`);
            console.info(`BUY ORDER RESPONSE ${JSON.stringify(buyOrder)}`);
            if (placeTrailingOrder) console.info(`STOP ORDER PAYLOAD ${JSON.stringify(placeTrailingOrder)}`);
            if (trailingSellOrder) console.info(`STOP ORDER RESPONSE ${JSON.stringify(trailingSellOrder)}`);
        } catch (err) {
            return this.errorResponse(err, tradeSignal);
        }

        return this.buildSuccessResponse(JSON.stringify([buyOrder]));
    }

    private async awaitOrderFillOrCancel(
        client: AlpacaClient,
        orderId: string,
        maxWaitSeconds: number,
    ): Promise<Order> {
        const maxWaitMillis = this.longTradeParams.cancelPendingOrderPeriod * 1000;
        const intervalMillis = 500; // check status every 0.5 second
        let elapsedMillis = 0;
        const getOrder = async () => client.getOrder({ order_id: orderId });

        while (elapsedMillis < maxWaitMillis) {
            const order = await getOrder();
            if (order.status == 'filled') {
                console.info(`Order filled:`, JSON.stringify(order), 'Elapsed Milliseconds', elapsedMillis);
                return order;
            }

            await new Promise((resolve) => setTimeout(resolve, intervalMillis));
            elapsedMillis += intervalMillis;
            console.debug(`Waiting for the '${order.status}' order to be filled`);
        }

        // max wait time reached without the order being filled
        console.warn(`Order ${orderId} was not filled within ${maxWaitSeconds} seconds. Canceling...`);
        await client.cancelOrder({ order_id: orderId });
        return await getOrder();
    }

    private async cancelOpenOrders(client: AlpacaClient, symbol: string) {
        const openOrders = await client.getOrders({ status: 'open', symbols: [symbol] });

        for (const order of openOrders) {
            console.warn('CANCEL ORDER ', JSON.stringify(order));
            try {
                await client.cancelOrder({ order_id: order.id });
            } catch (err) {
                console.error(`Failed to cancel order ${order.id}: `, err);
            }
        }
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

    private errorResponse(err: unknown, tradeSignal: TradeSignal) {
        console.error(`Failed to process trade signal for ${tradeSignal.ticker}: `, err);

        if (this.isAlpacaError(err) && (err.message.includes('not found') || err.message.includes('not find')))
            return this.buildResponse(404, JSON.stringify(err));

        if (this.isAlpacaError(err) && err.message.includes('forbidden'))
            return this.buildResponse(403, JSON.stringify(err));

        return this.buildResponse(500, JSON.stringify(err));
    }

    /**
     * Validate order leg flags, only one per configuration is expected to be enabled.
     */
    private validateConfigFlags() {
        let count = 0;
        if (this.longTradeParams.limitBracket?.enabled) {
            count += 1;
        }
        if (this.longTradeParams.trailingStop?.enabled) {
            count += 1;
        }
        if (this.longTradeParams.limit?.enabled) {
            count += 1;
        }
        if (count > 1) {
            throw new Error('Invalid config. Only one order leg flag is expected to be enabled');
        }
    }
}
