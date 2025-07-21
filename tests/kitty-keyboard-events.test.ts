import { describe, expect, test } from 'bun:test';
import { InputDecoder } from '../src/input/decoder.ts';
import type { InputEvent } from '../src/input/types.ts';

describe('Kitty Keyboard Event Types', () => {
  test('should only emit Kitty enhanced events when enabled', () => {
    const decoder = new InputDecoder({ kittyKeyboard: true });
    const events: InputEvent[] = [];

    // Simulate pressing 'a' with Kitty protocol
    // Terminal sends: 'a' followed by ESC [ 97 ; 1 : 1 u (press event)
    const data = new Uint8Array([
      0x61, // 'a'
      0x1b,
      0x5b,
      0x39,
      0x37,
      0x3b,
      0x31, // ESC [ 97 ; 1
      0x3a,
      0x31,
      0x75, // : 1 u (press)
    ]);

    decoder.feed(data);

    // Collect all events
    let event = decoder.next();
    while (event !== null) {
      events.push(event);
      event = decoder.next();
    }

    // Should emit only one event - the Kitty enhanced event
    // (raw character is suppressed when Kitty is enabled)
    expect(events.length).toBe(1);

    // Kitty enhanced event
    const kittyEvent = events[0];
    expect(kittyEvent.type).toBe('key');
    if (kittyEvent.type === 'key') {
      expect(kittyEvent.code).toEqual({ char: 'a' });
      expect(kittyEvent.kind).toBe('press');
      expect(kittyEvent.repeat).toBe(false);
    }
  });

  test('should handle key release events', () => {
    const decoder = new InputDecoder({ kittyKeyboard: true });
    const events: InputEvent[] = [];

    // Key release: 'a' followed by ESC [ 97 ; 1 : 3 u
    const data = new Uint8Array([
      0x61, // 'a'
      0x1b,
      0x5b,
      0x39,
      0x37,
      0x3b,
      0x31, // ESC [ 97 ; 1
      0x3a,
      0x33,
      0x75, // : 3 u (release)
    ]);

    decoder.feed(data);

    // Collect all events
    let event = decoder.next();
    while (event !== null) {
      events.push(event);
      event = decoder.next();
    }

    expect(events.length).toBe(1);

    // Check the release event
    const releaseEvent = events[0];
    if (releaseEvent.type === 'key') {
      expect(releaseEvent.kind).toBe('release');
      expect(releaseEvent.repeat).toBe(false);
    }
  });

  test('should handle key repeat events', () => {
    const decoder = new InputDecoder({ kittyKeyboard: true });
    const events: InputEvent[] = [];

    // Key repeat: 'a' followed by ESC [ 97 ; 1 : 2 u
    const data = new Uint8Array([
      0x61, // 'a'
      0x1b,
      0x5b,
      0x39,
      0x37,
      0x3b,
      0x31, // ESC [ 97 ; 1
      0x3a,
      0x32,
      0x75, // : 2 u (repeat)
    ]);

    decoder.feed(data);

    // Collect all events
    let event = decoder.next();
    while (event !== null) {
      events.push(event);
      event = decoder.next();
    }

    expect(events.length).toBe(1);

    // Check the repeat event
    const repeatEvent = events[0];
    if (repeatEvent.type === 'key') {
      expect(repeatEvent.kind).toBe('repeat');
      expect(repeatEvent.repeat).toBe(true);
    }
  });

  test('should include modifiers in Kitty events', () => {
    const decoder = new InputDecoder({ kittyKeyboard: true, quirks: false });
    const events: InputEvent[] = [];

    // Ctrl+A: ESC [ 97 ; 5 : 1 u (5 = 1 + 4 for Ctrl)
    const data = new Uint8Array([
      0x1b,
      0x5b,
      0x39,
      0x37,
      0x3b,
      0x35, // ESC [ 97 ; 5
      0x3a,
      0x31,
      0x75, // : 1 u
    ]);

    decoder.feed(data);

    // Collect all events
    let event = decoder.next();
    while (event !== null) {
      events.push(event);
      event = decoder.next();
    }

    expect(events.length).toBe(1);

    // Check the Kitty event
    const kittyEvent = events[0];
    if (kittyEvent.type === 'key') {
      expect(kittyEvent.kind).toBe('press');
      expect(kittyEvent.code).toEqual({ char: 'a' });
      expect(kittyEvent.modifiers.ctrl).toBe(true);
    }
  });

  test('should work without Kitty protocol', () => {
    const decoder = new InputDecoder({ kittyKeyboard: false });
    const events: InputEvent[] = [];

    // Just 'a' without Kitty sequence
    decoder.feed(new Uint8Array([0x61])); // 'a'

    // Collect all events
    let event = decoder.next();
    while (event !== null) {
      events.push(event);
      event = decoder.next();
    }

    // Should emit exactly one event without kind
    expect(events.length).toBe(1);
    if (events[0].type === 'key') {
      expect(events[0].kind).toBeUndefined();
    }
  });
});
