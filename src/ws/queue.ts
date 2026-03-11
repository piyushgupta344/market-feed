/**
 * Single-consumer async queue.
 *
 * Bridges event-based callbacks (WebSocket handlers) to an async generator
 * without any dependency on Node streams or EventEmitter.
 *
 * - `push(value)` immediately resolves a waiting consumer, or buffers.
 * - `close(err?)` ends the iteration; an error causes the consumer to throw.
 */
export class AsyncQueue<T> {
  private readonly buf: T[] = [];
  private waiting: ((result: IteratorResult<T, undefined>) => void) | null = null;
  private waitingReject: ((err: Error) => void) | null = null;
  private closed = false;
  private closeError: Error | undefined;

  /** Push a value. Resolves a waiting `next()` call immediately if one exists. */
  push(value: T): void {
    if (this.closed) return; // drop after close
    if (this.waiting) {
      const resolve = this.waiting;
      this.waiting = null;
      this.waitingReject = null;
      resolve({ value, done: false });
    } else {
      this.buf.push(value);
    }
  }

  /** Signal end-of-stream. Passing an error causes the consumer's `for await` to throw. */
  close(err?: Error): void {
    if (this.closed) return;
    this.closed = true;
    this.closeError = err;
    if (this.waiting) {
      const resolve = this.waiting;
      const reject = this.waitingReject;
      this.waiting = null;
      this.waitingReject = null;
      if (err && reject) {
        reject(err);
      } else {
        resolve({ value: undefined, done: true });
      }
    }
  }

  get isClosing(): boolean {
    return this.closed;
  }

  [Symbol.asyncIterator](): AsyncIterator<T, undefined> {
    const next = (): Promise<IteratorResult<T, undefined>> => {
      if (this.buf.length > 0) {
        return Promise.resolve({ value: this.buf.shift()!, done: false });
      }
      if (this.closed) {
        if (this.closeError) return Promise.reject(this.closeError);
        return Promise.resolve({ value: undefined, done: true });
      }
      return new Promise<IteratorResult<T, undefined>>((resolve, reject) => {
        this.waiting = resolve;
        this.waitingReject = reject;
      });
    };
    return { next };
  }
}
