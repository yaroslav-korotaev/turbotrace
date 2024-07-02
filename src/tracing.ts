import { AsyncLocalStorage, AsyncResource } from 'node:async_hooks';
import { type Backend } from './backend';
import { Span } from './span';

export type AsyncFunction<T, A extends any[], R> = (this: T, ...args: A) => Promise<R>;

export type SpanCallback<T> = (span: Span) => Promise<T>;

export type TracingSpanOptions = {
  root?: boolean;
};

export type TracingWrapOptions = TracingSpanOptions & {
  bind?: boolean;
};

export type TracingParams = {
  storage: AsyncLocalStorage<Span>;
  backend: Backend;
  root?: Span;
  tag: string;
};

export class Tracing {
  public storage: AsyncLocalStorage<Span>;
  public backend: Backend;
  public root: Span;
  public tag: string;
  
  constructor(params: TracingParams) {
    const {
      storage,
      backend,
      root,
      tag,
    } = params;
    
    this.storage = storage;
    this.backend = backend;
    this.root = root ?? new Span({
      origin: this,
      parent: null,
      name: '',
    });
    this.tag = tag;
  }
  
  public child(tag: string): Tracing {
    return new Tracing({
      storage: this.storage,
      backend: this.backend,
      root: this.root,
      tag: `${this.tag}.${tag}`,
    });
  }
  
  public head(): Span {
    const span = this.storage.getStore();
    
    if (!span) {
      throw new Error(`tracing out of context: ${this.tag}`);
    }
    
    return span;
  }
  
  public async span<T>(
    name: string,
    callback: SpanCallback<T>,
    options?: TracingSpanOptions,
  ): Promise<T> {
    let result: T;
    
    const span = new Span({
      origin: this,
      parent: (options?.root) ? this.root : this.head(),
      name: `${this.tag}.${name}`,
    });
    
    span.enter();
    
    return await this.storage.run(span, async () => {
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
    options?: TracingWrapOptions,
  ): AsyncFunction<T, A, R> {
    const self = this;
    
    let wrapper: AsyncFunction<T, A, R> = async function (...args) {
      const them = this;
      
      return await self.span(name, async () => {
        return await fn.apply(them, args);
      }, options);
    };
    
    if (options?.bind) {
      wrapper = AsyncResource.bind<AsyncFunction<T, A, R>, T>(wrapper);
    }
    
    return wrapper;
  }
  
  public trace(msg?: string): void;
  public trace(details?: object, msg?: string): void;
  public trace(detailsOrMsg?: object | string, maybeMsg?: string): void {
    this.backend.trace(this, this.head(), detailsOrMsg, maybeMsg);
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
  
  storage.enterWith(tracing.root);
  
  return tracing;
}
