import { type Backend } from './backend';
import { type Tracing } from './tracing';

export type SpanParams = {
  backend: Backend;
  origin: Tracing;
  parent: Span | null;
  name: string;
};

export class Span {
  private _backend: Backend;
  
  public origin: Tracing;
  public parent: Span | null;
  public name: string;
  public depth: number;
  public start: number;
  public stop: number;
  
  constructor(params: SpanParams) {
    const {
      backend,
      origin,
      parent,
      name,
    } = params;
    
    this._backend = backend;
    
    this.origin = origin;
    this.parent = parent;
    this.name = name;
    this.depth = (parent) ? parent.depth + 1 : 0;
    this.start = -1;
    this.stop = -1;
  }
  
  public enter(): void {
    this.start = this._backend.now();
    this._backend.enter(this);
  }
  
  public exit(err?: unknown): void {
    this.stop = this._backend.now();
    this._backend.exit(this, err);
  }
  
  public trace(msg?: string): void;
  public trace(details?: object, msg?: string): void;
  public trace(detailsOrMsg?: object | string, maybeMsg?: string): void {
    this._backend.trace(this.origin, this, detailsOrMsg, maybeMsg);
  }
}
