/**
 * Async stream implementation for terminal input events
 *
 * This module provides high-level async iteration over input events,
 * similar to Crossterm's EventStream but idiomatic to JavaScript.
 */

import { readEvent } from './reader.ts';
import type { InputEvent, InputOptions } from './types.ts';

/**
 * Input event stream that implements async iteration
 */
export interface InputEventStream extends AsyncIterable<InputEvent> {
  /**
   * Close the stream and stop reading events
   */
  close(): void;
}

/**
 * Internal stream implementation
 */
class EventStreamImpl implements InputEventStream {
  private queue: InputEvent[] = [];
  private resolvers: Array<(value: IteratorResult<InputEvent>) => void> = [];
  private closed = false;
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: Used to track background reading task
  private readTask: Promise<void>;

  constructor(_options?: InputOptions) {
    // Start the background reading task
    this.readTask = this.startReading();
  }

  /**
   * Start the background reading loop
   */
  private async startReading(): Promise<void> {
    while (!this.closed) {
      try {
        const event = await readEvent();

        if (this.closed) {
          break;
        }

        // If there are waiting resolvers, resolve the first one
        const resolver = this.resolvers.shift();
        if (resolver) {
          resolver({ value: event, done: false });
        } else {
          // Otherwise, queue the event
          this.queue.push(event);
        }
      } catch (_error) {
        // If we're closed, just exit
        if (this.closed) {
          break;
        }

        // For debugging: log errors but continue
        if (process.env.DEBUG_INPUT) {
          // Log input errors when debugging
        }

        // Don't mark as done on error, just continue
        // This allows the stream to recover from transient errors
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

    // Resolve any remaining resolvers with done
    for (const resolver of this.resolvers) {
      resolver({ value: undefined as unknown as InputEvent, done: true });
    }
    this.resolvers = [];
  }

  /**
   * Async iterator implementation
   */
  async *[Symbol.asyncIterator](): AsyncIterator<InputEvent> {
    while (!this.closed) {
      // If we have queued events, yield them
      const event = this.queue.shift();
      if (event) {
        yield event;
        continue;
      }

      // Otherwise, wait for the next event
      const result = await new Promise<IteratorResult<InputEvent>>(
        (resolve) => {
          this.resolvers.push(resolve);
        }
      );

      if (result.done) {
        break;
      }

      yield result.value;
    }
  }

  /**
   * Close the stream
   */
  close(): void {
    this.closed = true;

    // Resolve all pending promises
    for (const resolver of this.resolvers) {
      resolver({ value: undefined as unknown as InputEvent, done: true });
    }
    this.resolvers = [];

    // Clear the queue
    this.queue = [];
  }
}

/**
 * Create an async event stream for terminal input
 *
 * @param options - Options for configuring input handling
 * @returns An async iterable stream of input events
 *
 * @example
 * ```ts
 * const stream = createEventStream({ mouse: true });
 *
 * for await (const event of stream) {
 *   if (event.type === "key" && event.code === "Escape") {
 *     stream.close();
 *     break;
 *   }
 *   console.log(event);
 * }
 * ```
 */
export function createEventStream(options?: InputOptions): InputEventStream {
  return new EventStreamImpl(options);
}

/**
 * Create an event emitter interface for input events
 *
 * This provides a more traditional event emitter API as an alternative
 * to async iteration.
 */
export class InputEventEmitter extends EventTarget {
  private stream: InputEventStream;

  constructor(options?: InputOptions) {
    super();
    this.stream = createEventStream(options);
    this.startReading();
  }

  /**
   * Start reading events and dispatching them
   */
  private async startReading(): Promise<void> {
    try {
      for await (const event of this.stream) {
        // Dispatch typed events
        const customEvent = new CustomEvent(event.type, {
          detail: event,
        });
        this.dispatchEvent(customEvent);

        // Also dispatch a general "input" event
        const inputEvent = new CustomEvent('input', {
          detail: event,
        });
        this.dispatchEvent(inputEvent);
      }
    } catch (error) {
      // Dispatch error event
      const errorEvent = new CustomEvent('error', {
        detail: error,
      });
      this.dispatchEvent(errorEvent);
    }
  }

  /**
   * Close the event emitter and stop reading
   */
  close(): void {
    this.stream.close();
  }

  /**
   * Convenience method for adding typed event listeners
   */
  on(
    type: 'key' | 'mouse' | 'resize' | 'paste' | 'focus' | 'input' | 'error',
    listener: (event: CustomEvent) => void
  ): void {
    this.addEventListener(type, listener as EventListener);
  }

  /**
   * Convenience method for removing typed event listeners
   */
  off(
    type: 'key' | 'mouse' | 'resize' | 'paste' | 'focus' | 'input' | 'error',
    listener: (event: CustomEvent) => void
  ): void {
    this.removeEventListener(type, listener as EventListener);
  }
}
