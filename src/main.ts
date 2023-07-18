import express from 'express';
import config from "config";
import {getLogger} from "./logger";
import axios from "axios";
import {
    Context,
    context,
    propagation,
    trace
} from "@opentelemetry/api";

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


const doTheWork = () => {
    const index = 0;
    logger.info(`index: ${index}`);
}

function doWork(parent) {

    // new context based on current, with key/values added to baggage
    const ctx: Context = propagation.setBaggage(
        context.active(),
        propagation.createBaggage({'app.username': {value: 'carluccyo'}})
    );

    // within the new context, do some work and baggage will be
    // applied as attributes on child spans
    context.with(ctx, () => {
        tracer.startActiveSpan('childSpan', (childSpan) => {
            doTheWork();
            childSpan.end();
        });
    });


    const baggages = propagation.createBaggage({key1: {value: 'value1'}});
    const tracer = trace.getTracer("my-application", "0.1.0");
    const span = tracer.startSpan('doWork', undefined, ctx);

    propagation.setBaggage(ctx, baggages);
    console.log(propagation.getBaggage(ctx));

    span.end();
}



// Handling '/' Request
app.get('/ping', async (_req, _res) => {
    // log current timestamp
    logger.info({headers: _req.headers, baggage: propagation.getBaggage(context.active())}, `ping: ${Date.now()}`);

    const tracer = trace.getTracer(
        'my-service-tracer'
    );

    await tracer.startActiveSpan('main', async (span) => {
        const newContext = propagation.setBaggage(context.active(), propagation.createBaggage({'app.username': {value: 'carluccyo'}}));
        await context.with(newContext, async () => {
            const pingConfig = config.get<PingConfig>('ping');
            if (pingConfig?.enabled) {
                const axiosResponse = await axios.get(pingConfig.target_service_url);
                logger.info({status: axiosResponse.status, body: axiosResponse.data}, 'ping response');
            }
        });
        _res.send("TypeScript With Express");
        span.end();
    });
});

// Server setup
app.listen(port, () => {
    console.log(`TypeScript with Express http://localhost:${port}/`);
});
