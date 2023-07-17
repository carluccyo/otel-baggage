'use strict';
// SDK
import { NodeSDK } from '@opentelemetry/sdk-node';
// Express, MySql and http instrumentation
import { ConsoleSpanExporter, NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
// Collector trace exporter
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { SimpleSpanProcessor, SpanExporter } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OtelConfig } from './types';
import {
    SpanContext,
    context,
    isSpanContextValid,
    trace,
    propagation,
    ROOT_CONTEXT,
} from '@opentelemetry/api';
import { WinstonInstrumentationConfig } from '@opentelemetry/instrumentation-winston/build/src/types';
import { PinoInstrumentationConfig } from '@opentelemetry/instrumentation-pino';
import { BaggageEntry } from '@opentelemetry/api/build/src/baggage/types';
import {
    CompositePropagator,
    W3CTraceContextPropagator,
    W3CBaggagePropagator,
} from '@opentelemetry/core';
import { Logger } from 'pino';

const getOtelTraceExporter = (
    enableConsoleExporter,
    otelAgentEndpoint,
): SpanExporter | undefined => {
    if (enableConsoleExporter === 'true' || enableConsoleExporter === true) {
        return new ConsoleSpanExporter();
    }
    if (otelAgentEndpoint) {
        return new OTLPTraceExporter({
            url: `${otelAgentEndpoint}/v1/traces`,
        });
    }
    return undefined;
};
const requiredConfigValues = [
    'OTEL_SERVICE_NAME',
    'OTEL_SERVICE_NAMESPACE',
    'OTEL_SERVICE_VERSION',
];
const validateConfig = (config) => {
    for (const key of requiredConfigValues) {
        if (!config[key]) {
            throw new Error(`Missing needed OTEL env variable(s) - ${requiredConfigValues}`);
        }
    }
};

let sdk;

/* istanbul ignore next */ // eslint-disable-next-line @typescript-eslint/no-explicit-any
function logHookSetAttribute(record: Record<string, any>, provider: NodeTracerProvider) {
    record['resource.service.name'] = provider.resource.attributes['service.name'];
}


export const init = async (config: OtelConfig, logger?: Logger): Promise<NodeSDK | void> => {
    const otelEnabled = config.OTEL_ENABLED === 'true' || config.OTEL_ENABLED === true;
    if (!otelEnabled) {
        const message = 'Skip OpenTelemetry initialization: tracing not enabled';
        /* istanbul ignore next */
        return logger ? logger.info(message) : console.log(message);
    }
    validateConfig(config);

    /* istanbul ignore next */
    const compositePropagator = new CompositePropagator({
        propagators: [new W3CTraceContextPropagator(), new W3CBaggagePropagator()],
    });

    /* istanbul ignore next */
    const globalPropagatorRegistered = propagation.setGlobalPropagator(compositePropagator);

    const msg = `globalPropagatorRegistered: ${globalPropagatorRegistered}`;
    logger ? logger.info(msg) : console.log(msg);

    // Tracer provider
    const provider = new NodeTracerProvider({
        resource: new Resource({
            [SemanticResourceAttributes.SERVICE_NAME]: config.OTEL_SERVICE_NAME,
            [SemanticResourceAttributes.SERVICE_NAMESPACE]: config.OTEL_SERVICE_NAMESPACE,
            [SemanticResourceAttributes.SERVICE_VERSION]: config.OTEL_SERVICE_VERSION,
        }),
    });

    const isWinston = !!(
        config.OTEL_INSTRUMENTATION_LOGGER_WINSTON ||
        config.OTEL_INSTRUMENTATION_LOGGER_WINSTON === 'true'
    );

    /* istanbul ignore next */
    const winstonInstrumentationConfig: WinstonInstrumentationConfig = {
        enabled: isWinston,
        logHook: (_span, record) => logHookSetAttribute(record, provider),
    };

    /* istanbul ignore next */
    const pinoInstrumentationConfig: PinoInstrumentationConfig = {
        enabled: !isWinston,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        logHook: (_span, record, _level) => logHookSetAttribute(record, provider),
    };

    const instrumentations = [
        getNodeAutoInstrumentations({
            // Node auto instrumentation
            '@opentelemetry/instrumentation-fs': { enabled: false },
            '@opentelemetry/instrumentation-dns': { enabled: false },
            '@opentelemetry/instrumentation-net': { enabled: false },
            '@opentelemetry/instrumentation-winston': winstonInstrumentationConfig,
            '@opentelemetry/instrumentation-pino': pinoInstrumentationConfig,
            // Currently to be able to have auto-instrumentation for express we need the auto-instrumentation for HTTP.
            '@opentelemetry/instrumentation-http': {
                /* istanbul ignore next */
                ignoreIncomingRequestHook(req) {
                    return req && !!req.url?.match(/^.*health.*$/);
                },
            },
            '@opentelemetry/instrumentation-express': { enabled: true },
            '@opentelemetry/instrumentation-mysql2': { enabled: true },
            '@opentelemetry/instrumentation-aws-sdk': {
                enabled: true,
                sqsExtractContextPropagationFromPayload: true,
            },
        }),
    ];

    const traceExporter = getOtelTraceExporter(
        config.TELEMETRY_ENABLE_CONSOLE_EXPORTER,
        config.OTEL_AGENT_ENDPOINT,
    );

    if (traceExporter) {
        provider.addSpanProcessor(new SimpleSpanProcessor(traceExporter));
    }

    provider.register();

    // SDK configuration and start up
    sdk = new NodeSDK({
        traceExporter,
        instrumentations,
    });

    await sdk.start();
    const infoMessage = 'Tracing started!';
    logger ? logger.info(infoMessage) : console.log(infoMessage);
    return sdk;
};

export const shutdown = async (isOtelEnabled, logger?: Logger) => {
    try {
        if (isOtelEnabled && sdk) {
            await sdk.shutdown();
        }
        logger ? logger.info('Tracing finished.') : console.log('Tracing finished.');
    } catch (error) {
        /* istanbul ignore next */
        console.error(error);
    }
};

const getSpanContext = (): SpanContext | undefined => {
    const span = trace.getSpan(context.active());
    if (!span) {
        return undefined;
    }
    const spanContext = span.spanContext();
    if (!isSpanContextValid(spanContext)) {
        return undefined;
    }
    return spanContext;
};

export const getTraceId = (): string | undefined => {
    const spanContext = getSpanContext();
    return spanContext?.traceId;
};

export const getSpanId = (): string | undefined => {
    const spanContext = getSpanContext();
    return spanContext?.spanId;
};

/* istanbul ignore next */
export const addBaggage = (record: Record<string, any>) => {
    const activeContext = context.active();
    if (activeContext) {
        const entries: Record<string, BaggageEntry> = Object.entries(record).reduce(
            (result, [key, value]) => {
                result[key] = {
                    value: String(value),
                    metadata: typeof value,
                };
                return result;
            },
            {},
        );
        const baggage = propagation.createBaggage(entries);
        propagation.setBaggage(ROOT_CONTEXT, baggage);
    }
};
/* istanbul ignore next */
export const getBaggage = () => {
    const activeContext = context.active();
    if (activeContext) {
        const baggage = propagation.getBaggage(activeContext);
        return baggage?.getAllEntries();
    }
    return undefined;
};



const config: OtelConfig = {
    OTEL_ENABLED: process.env.OTEL_ENABLED || true,
    OTEL_SERVICE_NAME: process.env.OTEL_SERVICE_NAME,
    OTEL_SERVICE_NAMESPACE: process.env.OTEL_SERVICE_NAMESPACE,
    OTEL_SERVICE_VERSION: process.env.OTEL_SERVICE_VERSION,
    TELEMETRY_ENABLE_CONSOLE_EXPORTER: process.env.TELEMETRY_ENABLE_CONSOLE_EXPORTER,
    OTEL_INSTRUMENTATION_LOGGER_WINSTON: process.env.OTEL_INSTRUMENTATION_LOGGER_WINSTON,
    OTEL_AGENT_ENDPOINT: process.env.OTEL_AGENT_ENDPOINT,
};

(async () => {
    try {
        await init(config);
    } catch (error) {
        console.error(error);
    }
})();

process.on('SIGTERM', async () => {
    try {
        await shutdown(config.OTEL_ENABLED);
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error);
    } finally {
        process.exit(0);
    }
});

