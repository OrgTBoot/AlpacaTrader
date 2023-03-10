import { AlpacaClient, Order, PlaceOrder } from '@master-chief/alpaca';
import { TradeSignal } from './interfaces/trade_signal';
import { TradeParams } from './interfaces/trade_config';

export abstract class AlpacaOrderService {
    protected async getLongBuyMarketOrder(
        client: AlpacaClient,
        tradeSignal: TradeSignal,
        longTradeParams: TradeParams,
    ): Promise<PlaceOrder> {
        const orderQty = await this.getOrderQty(client, longTradeParams, tradeSignal);

        return {
            symbol: tradeSignal.ticker,
            side: 'buy',
            type: 'market',
            time_in_force: 'gtc',
            extended_hours: longTradeParams.extendedHours ?? false,
            qty: orderQty,
        };
    }

    protected async getLongBuyLimitOrder(
        client: AlpacaClient,
        tradeSignal: TradeSignal,
        longTradeParams: TradeParams,
    ): Promise<PlaceOrder> {
        const orderQty = await this.getOrderQty(client, longTradeParams, tradeSignal);

        const placeOrder: PlaceOrder = {
            symbol: tradeSignal.ticker,
            side: 'buy',
            type: 'limit',
            qty: orderQty,
            limit_price: Number(tradeSignal.price),
            time_in_force: 'gtc',
            extended_hours: longTradeParams.extendedHours ?? false,
        };

        if (longTradeParams.limitBracket.enabled) {
            const askPrice = this.getAskPrice(tradeSignal);
            const stopPrice = askPrice * (1 - longTradeParams.limitBracket.stopPrice / 100);
            const limitPrice = askPrice * (1 + longTradeParams.limitBracket.takeProfit / 100);

            placeOrder.order_class = 'bracket';
            placeOrder.stop_loss = { stop_price: this.round(stopPrice) };
            placeOrder.take_profit = { limit_price: this.round(limitPrice) };
        }

        return placeOrder;
    }

    protected async getLongSellTrailingStopOrder(
        client: AlpacaClient,
        buyOrder: Order,
        longTradeParams: TradeParams,
    ): Promise<PlaceOrder> {
        return {
            symbol: buyOrder.symbol,
            side: 'sell',
            type: 'trailing_stop',
            time_in_force: 'gtc',
            trail_percent: longTradeParams?.trailingStop?.trailPercent ?? 2,
            extended_hours: longTradeParams.extendedHours ?? false,
            qty: buyOrder.qty,
        };
    }

    private async getOrderQty(
        client: AlpacaClient,
        longTradeParams: TradeParams,
        tradeSignal: TradeSignal,
    ): Promise<number> {
        const buyingPower: number = (await client.getAccount()).buying_power;

        //substract order size percentage from buyingPower
        const orderMoney: number = buyingPower - buyingPower * (1 - longTradeParams.orderSize / 100);
        return Math.round(orderMoney / this.getAskPrice(tradeSignal));
    }

    /**
     * Gets ask price from the signal instead of Alpaca due to potential MKT data delays.
     */
    private getAskPrice(tradeSignal: TradeSignal): number {
        return Number(tradeSignal.price);
    }

    private round(num: number): number {
        return Math.round((num + Number.EPSILON) * 100) / 100;
    }
}
