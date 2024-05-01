export type TracingObject = {
  name: string;
};

export type SpanObject = {
  origin: TracingObject;
  parent: SpanObject | null;
  name: string;
  depth: number;
  start: number;
  stop: number;
};

export type Backend = {
  now(): number;
  enter(span: SpanObject): void;
  exit(span: SpanObject, err?: unknown): void;
  trace(
    origin: TracingObject,
    span: SpanObject,
    detailsOrMsg?: object | string,
    maybeMsg?: string,
  ): void;
};
