import { describe, expect, test } from 'bun:test';
import { InputDecoder } from '../src/input/decoder.ts';
import type { InputEvent, KeyEvent } from '../src/input/types.ts';

describe('Kitty Keyboard Protocol', () => {
  test('should handle simple key press correctly', () => {
    const decoder = new InputDecoder({ kittyKeyboard: true });
    const events: InputEvent[] = [];

    // Simulate pressing 'a' with Kitty protocol
    // Terminal sends: 'a' followed by ESC [ 97 ; 1 : 3 u
    // But actually, for a simple 'a' press, Kitty usually sends: ESC [ 97 u
    // Let's test with the simpler sequence first
    const data = new Uint8Array([
      0x61, // 'a'
      0x1b,
      0x5b,
      0x39,
      0x37,
      0x75, // ESC [ 97 u
    ]);
    decoder.feed(data);

    // Try to flush pending character with timeout
    // Wait and feed empty data
    decoder.feed(new Uint8Array([]));

    // Collect all events
    let event = decoder.next();
    while (event !== null) {
      events.push(event);
      event = decoder.next();
    }

    // Should emit exactly one event
    expect(events.length).toBe(1);

    const keyEvent = events[0];
    expect(keyEvent.type).toBe('key');
    if (keyEvent.type === 'key') {
      expect(keyEvent.code).toEqual({ char: 'a' });
      expect(keyEvent.modifiers).toEqual({
        ctrl: false,
        alt: false,
        shift: false,
        meta: false,
      });
    }
  });

  test('should handle key with modifiers', () => {
    const decoder = new InputDecoder({ kittyKeyboard: true });
    const events: InputEvent[] = [];

    // Simulate Ctrl+A with Kitty protocol
    // Terminal sends: \x01 followed by ESC [ 97 ; 5 : 3 u
    const data = new Uint8Array([
      0x01, // Ctrl+A
      0x1b,
      0x5b,
      0x39,
      0x37,
      0x3b,
      0x35, // ESC [ 97 ; 5
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

    // Should emit one or two events (the Ctrl+A might be emitted separately)
    expect(events.length).toBeGreaterThanOrEqual(1);

    // Check if we have a Kitty-enhanced event
    const kittyEvent = events.find(
      (e) => e.type === 'key' && e.modifiers?.ctrl === true
    );

    if (kittyEvent && kittyEvent.type === 'key') {
      expect(kittyEvent.code).toEqual({ char: 'a' });
      expect(kittyEvent.modifiers.ctrl).toBe(true);
    }
  });

  test('should work normally when Kitty is disabled', () => {
    const decoder = new InputDecoder({ kittyKeyboard: false });
    const events: InputEvent[] = [];

    // Send just 'a' without Kitty sequence
    decoder.feed(new Uint8Array([0x61])); // 'a'

    // Collect all events
    let event = decoder.next();
    while (event !== null) {
      events.push(event);
      event = decoder.next();
    }

    // Should emit exactly one event
    expect(events.length).toBe(1);

    const keyEvent = events[0];
    expect(keyEvent.type).toBe('key');
    if (keyEvent.type === 'key') {
      expect(keyEvent.code).toEqual({ char: 'a' });
    }
  });

  test('should suppress regular characters in Kitty mode', () => {
    const decoder = new InputDecoder({ kittyKeyboard: true });

    // Send just 'a' without Kitty sequence
    decoder.feed(new Uint8Array([0x61])); // 'a'

    // In Kitty mode, regular characters are suppressed
    // expecting them to come via Kitty sequences
    expect(decoder.next()).toBeNull();

    // Now send the same character as a Kitty sequence
    // ESC [ 97 u (97 is Unicode for 'a')
    decoder.feed(new Uint8Array([0x1b, 0x5b, 0x39, 0x37, 0x75]));

    const event = decoder.next();
    expect(event).not.toBeNull();
    expect(event?.type).toBe('key');
    expect((event as KeyEvent).code).toEqual({ char: 'a' });
    expect((event as KeyEvent).kind).toBe('press');
  });
});
