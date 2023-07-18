import express from 'express';
import config from "config";
import {getLogger} from "./logger";
import axios from "axios";
import {
    baggageEntryMetadataFromString,
    Context,
    context,
    propagation,
    ROOT_CONTEXT,
    Span,
    trace
} from "@opentelemetry/api";
import {AttributeNames} from "@opentelemetry/instrumentation-express";

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
    logger.info({headers: _req.headers}, `ping: ${Date.now()}`);


    const baggage = propagation.getBaggage(context.active());
    let span;
    if (baggage?.getEntry('app.username')?.value) {
        logger.info(`found active baggage: ${JSON.stringify(baggage.getAllEntries())}`);
    } else {
        // continue current trace/span
        span = trace.getSpan(context.active()) as Span;
        span.setAttribute('app.username', 'carluccyo');
    }

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
