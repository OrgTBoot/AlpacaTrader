import { AlpacaClient, Snapshot } from '@master-chief/alpaca';
import { AlpacaService } from './alpaca_service';
import { TradeConfig } from './interfaces/trade_config';
import { TradeSignal } from './interfaces/trade_signal';

export class AlpacaStockService extends AlpacaService {
    constructor(tradeConfig: TradeConfig) {
        super(tradeConfig);
    }

    protected async getCurrentPrice(client: AlpacaClient, tradeSignal: TradeSignal): Promise<number> {
        return new Promise((resolve, reject) => {
            client
                .getSnapshot({ symbol: tradeSignal.ticker })
                .then((snapshot: Snapshot) => resolve(snapshot.latestTrade.p))
                .catch((err) => reject(err));
        });
    }

    protected computeOrderQty(orderMoney: number, askPrice: number): number {
        return Math.round(orderMoney / askPrice);
    }
}
