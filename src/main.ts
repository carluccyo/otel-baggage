import express from 'express';
import config from "config";
import {getLogger} from "./logger";
import axios from "axios";
import {baggageEntryMetadataFromString, context, propagation} from "@opentelemetry/api";

const app: express.Application = express();
const port = config.get<number>('server.port');


const logger = getLogger()


export interface IEventPayload {
    timestamp: Date;
}

export enum EVENT_TYPE {
    PING = 'ping',
}
export interface PingMessage {
    eventType: EVENT_TYPE.PING;
    payload: IEventPayload;
}


export interface PingConfig {
    enabled: boolean;
    target_service_url: string;
    consumer_enabled: boolean;
    consumer_target_service_url: string;
}


// Handling '/' Request
app.get('/ping', async (_req, _res) => {
    // log current timestamp
    logger.info({headers: _req.headers}, `ping: ${Date.now()}`);

    const payload: IEventPayload = {
        timestamp: new Date(),
    };

    const entries = {
        'cf-ray': { value: 'd4cda95b652f4a1592b449d5929fda1b' },
        'with/slash': { value: 'with spaces' },
        key3: { value: 'c88815a7-0fa9-4d95-a1f1-cdccce3c5c2a' },
        key4: {
            value: 'foo',
            metadata: baggageEntryMetadataFromString(
                'key4prop1=value1;key4prop2=value2;key4prop3WithNoValue',
            ),
        },
    };

    const baggage = propagation.createBaggage(entries);
    propagation.setBaggage(context.active(), baggage);

    const pingConfig = config.get<PingConfig>('ping');
    if (pingConfig?.enabled) {
        const axiosResponse = await axios.get(pingConfig.target_service_url);
        logger.info({status: axiosResponse.status, body: axiosResponse.data}, 'ping response');
    }


    _res.send("TypeScript With Express");
});

// Server setup
app.listen(port, () => {
    console.log(`TypeScript with Express http://localhost:${port}/`);
});
