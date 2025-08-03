/**
 * Blocking and non-blocking input reader for terminal events
 *
 * This module provides low-level input reading functions that work
 * with Bun's stdin in a performance-optimized way.
 */

import { InputDecoder } from './decoder.ts';
import type { InputEvent } from './types.ts';

/**
 * Singleton decoder instance shared across all readers
 */
let sharedDecoder: InputDecoder | null = null;

/**
 * Buffer for reading input
 */
const READ_BUFFER_SIZE = 1024;
const _readBuffer = new Uint8Array(READ_BUFFER_SIZE);

/**
 * Global stdin stream reader - created once and reused
 */
let stdinReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

function getStdinReader(): ReadableStreamDefaultReader<Uint8Array> {
  if (!stdinReader) {
    const stream = Bun.stdin.stream();
    stdinReader = stream.getReader() as ReadableStreamDefaultReader<Uint8Array>;
  }
  return stdinReader as ReadableStreamDefaultReader<Uint8Array>;
}

/**
 * Get or create the singleton decoder
 */
function getDecoder(): InputDecoder {
  if (!sharedDecoder) {
    sharedDecoder = new InputDecoder();
  }
  return sharedDecoder;
}

/**
 * Configure the decoder with options
 */
export function configureDecoder(options: {
  kittyKeyboard?: boolean;
  quirks?: boolean;
  enabledFeatures?: Record<string, boolean>;
  keyNormalization?: 'raw' | 'character';
}): void {
  // For now, we need to recreate the decoder with new options
  // In the future, we could add a method to update options on existing decoder
  sharedDecoder = new InputDecoder(options);
}

/**
 * Read the next input event (blocking)
 *
 * This function reads from stdin and blocks until an event is available.
 * In raw mode, the stream will return immediately if data is available.
 */
export async function readEvent(): Promise<InputEvent> {
  const dec = getDecoder();
  const reader = getStdinReader();

  // Check if we already have events queued
  let event = dec.next();
  if (event) {
    return event;
  }

  // Keep reading until we get an event
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      throw new Error('stdin closed');
    }

    if (value) {
      // Feed the data to the decoder
      dec.feed(new Uint8Array(value));

      // Check if this produced any events
      event = dec.next();
      if (event) {
        return event;
      }
    }
  }
}

/**
 * Check if an input event is available within a timeout
 *
 * @param timeout - Timeout in milliseconds
 * @returns True if an event is available, false otherwise
 */
export async function pollEvent(timeout: number): Promise<boolean> {
  const dec = getDecoder();
  const reader = getStdinReader();
  const _startTime = Date.now();

  // Check if we already have events queued
  if (dec.hasEvents()) {
    return true;
  }

  try {
    // Try to read data with a timeout
    const readPromise = reader.read();
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), timeout)
    );

    const result = await Promise.race([readPromise, timeoutPromise]);

    if (result && !result.done && result.value) {
      // Feed the data to the decoder
      dec.feed(new Uint8Array(result.value));
      return dec.hasEvents();
    }
  } catch (error) {
    // Ignore timeout errors
    if (!(error instanceof Error && error.message.includes('EAGAIN'))) {
      throw error;
    }
  }

  return false;
}

/**
 * Try to read an event without blocking
 *
 * @returns An event if available, null otherwise
 */
export async function tryReadEvent(): Promise<InputEvent | null> {
  const dec = getDecoder();

  // Check if we already have events queued
  const event = dec.next();
  if (event) {
    return event;
  }

  // Poll with a very short timeout
  const hasEvent = await pollEvent(1);
  if (hasEvent) {
    return dec.next();
  }

  return null;
}

/**
 * Clear any pending input events
 */
export async function clearInput(): Promise<void> {
  const dec = getDecoder();
  const reader = getStdinReader();

  // Clear decoder state
  dec.clear();

  // Try to drain any pending input with a short timeout
  try {
    const drainPromise = async () => {
      while (true) {
        const timeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 10)
        );
        const result = await Promise.race([reader.read(), timeoutPromise]);

        if (!result || result.done || !result.value) {
          break;
        }
      }
    };

    await drainPromise();
  } catch {
    // Ignore errors while draining
  }
}
