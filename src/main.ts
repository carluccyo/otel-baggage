import express from 'express';
import config from "config";
import {getLogger} from "./logger";
import axios from "axios";

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
    const message: PingMessage = {
        eventType: EVENT_TYPE.PING,
        payload,
    };

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
