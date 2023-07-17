export interface OtelConfig {
  OTEL_ENABLED?: boolean | string;
  OTEL_SERVICE_NAME?: string;
  OTEL_SERVICE_NAMESPACE?: string;
  OTEL_SERVICE_VERSION?: string;
  TELEMETRY_ENABLE_CONSOLE_EXPORTER?: boolean | string;
  OTEL_INSTRUMENTATION_LOGGER_WINSTON?: boolean | string;
  OTEL_AGENT_ENDPOINT?: string;
}
