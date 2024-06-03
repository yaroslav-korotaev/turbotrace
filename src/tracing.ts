import { AsyncLocalStorage } from 'node:async_hooks';
import { type Backend } from './backend';
import { Span } from './span';

export type AsyncFunction<T, A extends any[], R> = (this: T, ...args: A) => Promise<R>;

export type SpanCallback<T> = (span: Span) => Promise<T>;

export type TracingParams = {
  storage: AsyncLocalStorage<Span>;
  backend: Backend;
  tag: string;
};

export class Tracing {
  private _storage: AsyncLocalStorage<Span>;
  private _backend: Backend;
  
  public tag: string;
  
  constructor(params: TracingParams) {
    const {
      storage,
      backend,
      tag,
    } = params;
    
    this._storage = storage;
    this._backend = backend;
    
    this.tag = tag;
  }
  
  public child(tag: string): Tracing {
    return new Tracing({
      storage: this._storage,
      backend: this._backend,
      tag: `${this.tag}.${tag}`,
    });
  }
  
  public head(): Span {
    const span = this._storage.getStore();
    
    if (!span) {
      throw new Error(`tracing out of context: ${this.tag}`);
    }
    
    return span;
  }
  
  public async span<T>(name: string, callback: SpanCallback<T>): Promise<T> {
    let result: T;
    
    const span = new Span({
      backend: this._backend,
      origin: this,
      parent: this.head(),
      name: `${this.tag}.${name}`,
    });
    
    span.enter();
    
    return await this._storage.run(span, async () => {
      try {
        result = await callback(span);
      } catch (err) {
        span.exit(err);
        
        throw err;
      }
      
      span.exit();
      
      return result;
    });
  }
  
  public wrap<T, A extends any[], R>(
    name: string,
    fn: AsyncFunction<T, A, R>,
  ): AsyncFunction<T, A, R> {
    const self = this;
    
    return async function (...args) {
      const them = this;
      
      return await self.span(name, async () => {
        return await fn.apply(them, args);
      });
    };
  }
  
  public trace(msg?: string): void;
  public trace(details?: object, msg?: string): void;
  public trace(detailsOrMsg?: object | string, maybeMsg?: string): void {
    this._backend.trace(this, this.head(), detailsOrMsg, maybeMsg);
  }
}

export type CreateTracingParams = {
  backend: Backend;
};

export function createTracing(params: CreateTracingParams): Tracing {
  const {
    backend,
  } = params;
  
  const storage = new AsyncLocalStorage<Span>();
  const tracing = new Tracing({
    storage,
    backend,
    tag: '',
  });
  const span = new Span({
    backend,
    origin: tracing,
    parent: null,
    name: '',
  });
  
  storage.enterWith(span);
  
  return tracing;
}
