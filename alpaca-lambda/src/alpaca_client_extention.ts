import { AlpacaClient, DefaultCredentials } from '@master-chief/alpaca';
import Alpaca from '@alpacahq/alpaca-trade-api';
import { CryptoTrade } from '@alpacahq/alpaca-trade-api/dist/resources/datav2/entityv2';

export class AlpacaClientExtention extends AlpacaClient {
    private rawAlpacaClient: Alpaca;

    constructor(
        public params: {
            rate_limit?: boolean;
            credentials?: DefaultCredentials;
        },
    ) {
        super(params);
        this.rawAlpacaClient = new Alpaca({
            keyId: this.params.credentials?.key,
            secretKey: this.params.credentials?.secret,
            paper: this.params.credentials?.paper,
        });
    }

    getLatestCryptoTrade(symbol: string): Promise<CryptoTrade> {
        return this.rawAlpacaClient.getLatestCryptoTrade(symbol, { exchange: 'ERSX' });
    }
}
