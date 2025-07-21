import { describe, expect, test } from 'bun:test';
import { InputDecoder } from '../src/input/decoder.ts';
import type { InputEvent } from '../src/input/types.ts';

describe('Kitty Keyboard Protocol - Complex', () => {
  test('should handle the exact sequence user reported', () => {
    const decoder = new InputDecoder({ kittyKeyboard: true });
    const events: InputEvent[] = [];

    // Exact sequence from user: 'a' followed by ESC [ 97 ; 1 : 3 u
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
      0x75, // : 3 u
    ]);
    decoder.feed(data);

    // Collect all events
    let event = decoder.next();
    while (event !== null) {
      events.push(event);
      event = decoder.next();
    }
    events.forEach((e, _i) => {
      if (e.type === 'key' && typeof e.code === 'object' && 'char' in e.code) {
        // Character key event
      } else {
        // Special key or other event type
      }
    });

    // Should emit exactly one event (not three)
    expect(events.length).toBe(1);

    const keyEvent = events[0];
    expect(keyEvent.type).toBe('key');
    if (keyEvent.type === 'key') {
      expect(keyEvent.code).toEqual({ char: 'a' });
    }
  });

  test("should NOT emit '3' and 'u' as separate events", () => {
    const decoder = new InputDecoder({ kittyKeyboard: true });
    const events: InputEvent[] = [];

    // This is what was happening - the decoder was breaking up the sequence
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
      0x75, // : 3 u
    ]);

    decoder.feed(data);

    // Collect all events
    let event = decoder.next();
    while (event !== null) {
      events.push(event);
      event = decoder.next();
    }

    // Make sure we don't have '3' or 'u' as separate events
    const charEvents = events.filter(
      (e) => e.type === 'key' && typeof e.code === 'object' && 'char' in e.code
    );
    const chars = charEvents.map((e) =>
      e.type === 'key' && typeof e.code === 'object' && 'char' in e.code
        ? e.code.char
        : ''
    );

    expect(chars).not.toContain('3');
    expect(chars).not.toContain('u');
    expect(chars).toEqual(['a']);
  });
});
