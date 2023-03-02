import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { AlpacaService } from './alpaca_service';
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
    const aplacaService = new AlpacaService();

    return aplacaService.processPaperEvent(event);
};


export const lambdaLiveHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const aplacaService = new AlpacaService();

    return aplacaService.processLiveEvent(event);
};
