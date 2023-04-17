import { AlpacaClient, Order, PlaceOrder, Position } from '@master-chief/alpaca';
import { TradeSignal } from './interfaces/trade_signal';
import { TradeParams } from './interfaces/trade_config';

export abstract class AlpacaOrderService {
    protected async buildLongBuyMarketOrder(
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

    protected async buildLongBuyLimitOrder(
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
            limit_price: this.getLimitBuyBufferPerice(tradeSignal, longTradeParams),
            time_in_force: 'gtc',
            extended_hours: longTradeParams.extendedHours ?? false,
        };

        if (longTradeParams.limitBracket?.enabled) {
            const askPrice = this.getAskPrice(tradeSignal);
            const stopPrice = askPrice * (1 - longTradeParams.limitBracket.stopPrice / 100);
            const limitPrice = askPrice * (1 + longTradeParams.limitBracket.takeProfit / 100);

            placeOrder.order_class = 'bracket';
            placeOrder.stop_loss = { stop_price: this.round(stopPrice) };
            placeOrder.take_profit = { limit_price: this.round(limitPrice) };
        }

        if (longTradeParams.limit?.enabled) {
            const askPrice = this.getAskPrice(tradeSignal);
            const stopPrice = askPrice * (1 - longTradeParams.limit.stopPrice / 100);

            placeOrder.stop_loss = { stop_price: this.round(stopPrice) };
        }

        return placeOrder;
    }

    protected buildLongSellTrailingStopOrder(
        signal: TradeSignal,
        longTradeParams: TradeParams,
        qty: number,
    ): PlaceOrder {
        const trailingPercent = Number(signal.trailingStopPercent ?? longTradeParams.trailingStop?.trailPercent ?? 3);
        return {
            symbol: signal.ticker,
            side: 'sell',
            type: 'trailing_stop',
            time_in_force: 'gtc',
            trail_percent: trailingPercent,
            extended_hours: longTradeParams.extendedHours ?? false,
            qty: qty,
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
     * Check if trailing order is allowed.
     * Note that Trailing Stop works with limit orders only if there are no limit brackets.
     */
    protected isTrailingOrderAllowed(tradeSignal: TradeSignal, tradeParams: TradeParams): boolean {
        const trailingEnabled = tradeParams.trailingStop?.enabled ?? false;
        return tradeSignal.action === 'buy' && trailingEnabled;
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

    private getLimitBuyBufferPerice(signal: TradeSignal, params: TradeParams): number {
        const signalPrice = Number(signal.price);
        const buffer = (params.limitBuyBufferPercent / 100) * signalPrice;

        return this.round(signalPrice + buffer);
    }
}
