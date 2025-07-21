/**
 * Tests for the input decoder state machine
 */

import { describe, expect, test } from 'bun:test';
import { InputDecoder } from '../../src/input/decoder.ts';
import type {
  KeyEvent,
  MouseEvent,
  PasteEvent,
} from '../../src/input/types.ts';

describe('InputDecoder', () => {
  describe('Basic key decoding', () => {
    test('decodes printable ASCII characters', () => {
      const decoder = new InputDecoder();

      // Feed 'a'
      decoder.feed(new Uint8Array([0x61]));
      const event = decoder.next() as KeyEvent;

      expect(event).toBeDefined();
      expect(event.type).toBe('key');
      expect(event.code).toEqual({ char: 'a' });
      expect(event.modifiers.ctrl).toBe(false);
      expect(event.modifiers.alt).toBe(false);
      expect(event.modifiers.shift).toBe(false);
      expect(event.modifiers.meta).toBe(false);
    });

    test('decodes control characters', () => {
      const decoder = new InputDecoder();

      // Feed Ctrl+C (0x03)
      decoder.feed(new Uint8Array([0x03]));
      const event = decoder.next() as KeyEvent;

      expect(event).toBeDefined();
      expect(event.type).toBe('key');
      expect(event.code).toEqual({ char: 'c' });
      expect(event.modifiers.ctrl).toBe(true);
    });

    test('decodes special keys', () => {
      const decoder = new InputDecoder();

      // Feed Tab (0x09)
      decoder.feed(new Uint8Array([0x09]));
      const event = decoder.next() as KeyEvent;

      expect(event).toBeDefined();
      expect(event.type).toBe('key');
      expect(event.code).toBe('Tab');
      expect(event.modifiers.ctrl).toBe(false);
    });
  });

  describe('Escape sequences', () => {
    test('decodes arrow keys', () => {
      const decoder = new InputDecoder();

      // ESC [ A (Up arrow)
      decoder.feed(new Uint8Array([0x1b, 0x5b, 0x41]));
      const event = decoder.next() as KeyEvent;

      expect(event).toBeDefined();
      expect(event.type).toBe('key');
      expect(event.code).toBe('Up');
    });

    test('decodes function keys', () => {
      const decoder = new InputDecoder();

      // ESC O P (F1)
      decoder.feed(new Uint8Array([0x1b, 0x4f, 0x50]));
      const event = decoder.next() as KeyEvent;

      expect(event).toBeDefined();
      expect(event.type).toBe('key');
      expect(event.code).toBe('F1');
    });

    test('decodes CSI sequences with parameters', () => {
      const decoder = new InputDecoder();

      // ESC [ 1 ; 2 H (Home with Shift modifier)
      decoder.feed(new Uint8Array([0x1b, 0x5b, 0x31, 0x3b, 0x32, 0x48]));
      const event = decoder.next() as KeyEvent;

      expect(event).toBeDefined();
      expect(event.type).toBe('key');
      expect(event.code).toBe('Home');
      expect(event.modifiers.shift).toBe(true);
    });

    test('decodes Alt+key combinations', () => {
      const decoder = new InputDecoder();

      // ESC a (Alt+a)
      decoder.feed(new Uint8Array([0x1b, 0x61]));
      const event = decoder.next() as KeyEvent;

      expect(event).toBeDefined();
      expect(event.type).toBe('key');
      expect(event.code).toEqual({ char: 'a' });
      expect(event.modifiers.alt).toBe(true);
    });
  });

  describe('Mouse events', () => {
    test('decodes SGR mouse clicks', () => {
      const decoder = new InputDecoder();

      // ESC [ < 0 ; 10 ; 5 M (Left button press at 10,5)
      const sequence = new TextEncoder().encode('\x1B[<0;10;5M');
      decoder.feed(sequence);
      const event = decoder.next() as MouseEvent;

      expect(event).toBeDefined();
      expect(event.type).toBe('mouse');
      expect(event.kind).toBe('down');
      expect(event.button).toBe(1); // Left button
      expect(event.x).toBe(10);
      expect(event.y).toBe(5);
    });

    test('decodes SGR mouse release', () => {
      const decoder = new InputDecoder();

      // ESC [ < 0 ; 10 ; 5 m (Left button release at 10,5)
      const sequence = new TextEncoder().encode('\x1B[<0;10;5m');
      decoder.feed(sequence);
      const event = decoder.next() as MouseEvent;

      expect(event).toBeDefined();
      expect(event.type).toBe('mouse');
      expect(event.kind).toBe('up');
      expect(event.button).toBe(1);
      expect(event.x).toBe(10);
      expect(event.y).toBe(5);
    });

    test('decodes mouse wheel events', () => {
      const decoder = new InputDecoder();

      // ESC [ < 64 ; 10 ; 5 M (Wheel up at 10,5)
      const sequence = new TextEncoder().encode('\x1B[<64;10;5M');
      decoder.feed(sequence);
      const event = decoder.next() as MouseEvent;

      expect(event).toBeDefined();
      expect(event.type).toBe('mouse');
      expect(event.kind).toBe('scroll');
      expect(event.button).toBe('WheelUp');
      expect(event.x).toBe(10);
      expect(event.y).toBe(5);
    });

    test('decodes mouse modifiers', () => {
      const decoder = new InputDecoder();

      // ESC [ < 4 ; 10 ; 5 M (Left button with Shift at 10,5)
      const sequence = new TextEncoder().encode('\x1B[<4;10;5M');
      decoder.feed(sequence);
      const event = decoder.next() as MouseEvent;

      expect(event).toBeDefined();
      expect(event.type).toBe('mouse');
      expect(event.kind).toBe('down');
      expect(event.button).toBe(1);
      expect(event.modifiers.shift).toBe(true);
      expect(event.modifiers.ctrl).toBe(false);
    });
  });

  describe('Partial sequences', () => {
    test('handles partial escape sequences', () => {
      const decoder = new InputDecoder();

      // Feed ESC [
      decoder.feed(new Uint8Array([0x1b, 0x5b]));
      expect(decoder.next()).toBeNull();

      // Feed the rest: A
      decoder.feed(new Uint8Array([0x41]));
      const event = decoder.next() as KeyEvent;

      expect(event).toBeDefined();
      expect(event.type).toBe('key');
      expect(event.code).toBe('Up');
    });

    test('handles interleaved regular characters', () => {
      const decoder = new InputDecoder({ quirks: false });

      // Feed: a, ESC, b, [, c, A
      decoder.feed(new Uint8Array([0x61])); // a
      const event1 = decoder.next() as KeyEvent;
      expect(event1.code).toEqual({ char: 'a' });

      decoder.feed(new Uint8Array([0x1b])); // ESC
      expect(decoder.next()).toBeNull();

      decoder.feed(new Uint8Array([0x62])); // b - this should trigger Alt+b
      const event2 = decoder.next() as KeyEvent;
      expect(event2.code).toEqual({ char: 'b' });
      expect(event2.modifiers.alt).toBe(true);

      decoder.feed(new Uint8Array([0x5b])); // [ - regular character
      const bracketEvent = decoder.next() as KeyEvent;
      expect(bracketEvent.code).toEqual({ char: '[' });

      decoder.feed(new Uint8Array([0x1b])); // ESC - start new escape sequence
      expect(decoder.next()).toBeNull();

      decoder.feed(new Uint8Array([0x5b])); // [
      decoder.feed(new Uint8Array([0x41])); // A
      const event3 = decoder.next() as KeyEvent;
      expect(event3.code).toBe('Up');
    });
  });

  describe('Bracketed paste', () => {
    test('decodes paste events', () => {
      const decoder = new InputDecoder();

      // ESC [ 200 ~ hello world ESC [ 201 ~
      const pasteStart = new TextEncoder().encode('\x1B[200~');
      const content = new TextEncoder().encode('hello world');
      const pasteEnd = new TextEncoder().encode('\x1B[201~');

      decoder.feed(pasteStart);
      decoder.feed(content);
      decoder.feed(pasteEnd);

      const event = decoder.next();

      expect(event).toBeDefined();
      expect(event?.type).toBe('paste');
      expect((event as PasteEvent).content).toBe('hello world');
    });
  });

  describe('Edge cases', () => {
    test('handles empty input', () => {
      const decoder = new InputDecoder();
      decoder.feed(new Uint8Array([]));
      expect(decoder.next()).toBeNull();
    });

    test('handles invalid escape sequences', () => {
      const decoder = new InputDecoder();

      // ESC [ @ (invalid final character)
      decoder.feed(new Uint8Array([0x1b, 0x5b, 0x40]));

      // Check if events are available before consuming
      const hasEvents = decoder.hasEvents();
      const event = decoder.next();

      // Should still produce some event or reset cleanly
      expect(hasEvents).toBe(Boolean(event));
    });

    test('handles buffer overflow gracefully', () => {
      const decoder = new InputDecoder();

      // Feed a very long sequence
      const longSequence = new Uint8Array(300);
      longSequence.fill(0x61); // Fill with 'a'

      decoder.feed(longSequence);

      // Should produce multiple events
      let eventCount = 0;
      while (decoder.next()) {
        eventCount++;
      }

      expect(eventCount).toBeGreaterThan(0);
    });
  });
});
