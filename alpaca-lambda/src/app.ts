import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { config, cryptoConfig } from './config';
import { AlpacaStockService } from './alpaca_stock_service';
import { TradeConfig } from './interfaces/trade_config';
import { AlpacaCryptoService } from './alpaca_crypto_service';

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */

export const lambdaPaperHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const aplacaService = new AlpacaStockService(config as TradeConfig);

    return aplacaService.processPaperEvent(event);
};
export const lambdaLiveHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const aplacaService = new AlpacaStockService(config as TradeConfig);

    return aplacaService.processLiveEvent(event);
};

export const lambdaPaperCryptoHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const aplacaService = new AlpacaCryptoService(cryptoConfig as TradeConfig);

    return aplacaService.processPaperEvent(event);
};

export const lambdaLiveCryptoHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const aplacaService = new AlpacaCryptoService(cryptoConfig as TradeConfig);

    return aplacaService.processLiveEvent(event);
};
