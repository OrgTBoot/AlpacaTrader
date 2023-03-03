import { AlpacaClientExtention } from './alpaca_client_extention';
import { AlpacaService } from './alpaca_service';
import { TradeConfig } from './interfaces/trade_config';
import { TradeSignal } from './interfaces/trade_signal';

export class AlpacaCryptoService extends AlpacaService {
    constructor(tradeConfig: TradeConfig) {
        super(tradeConfig);
    }

    protected async getCurrentPrice(client: AlpacaClientExtention, tradeSignal: TradeSignal): Promise<number> {
        return new Promise((resolve) => {
            client
                .getLatestCryptoTrade(tradeSignal.ticker)
                .then((latestTrade) => resolve(latestTrade.Price))
                .catch(() => resolve(0)); // return 0 for now, there are symbols for which 'no trade found' is thrown
        });
    }

    protected computeOrderQty(orderMoney: number, askPrice: number): number {
        return orderMoney / askPrice;
    }
}
