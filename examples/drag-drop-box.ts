#!/usr/bin/env bun

/**
 * Clean drag-and-drop box demo - now that color reset is fixed
 */

import { input, Terminal } from '../src/index.ts';
import type { MouseEvent } from '../src/input/types.ts';
import type { Color } from '../src/types.ts';

interface Box {
  x: number;
  y: number;
  size: number;
}

class DragDropDemo {
  private term: Terminal;
  private box: Box;
  private isDragging = false;
  private isHovering = false;
  private isHoveringExit = false;
  isMoving = false; // Made public for animation loop
  isFollowing = false; // Made public for animation loop
  private dragOffset = { x: 0, y: 0 };
  private minSize = 3;
  private maxSize = 12;
  private lastCursorPos = { x: 0, y: 0 };
  private blinkStartTime = Date.now();

  // Animation state
  private moveAnimation: {
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    startTime: number;
    duration: number;
  } | null = null;

  // Crosshair state
  private crosshair: {
    x: number;
    y: number;
    startTime: number;
    duration: number;
  } | null = null;

  constructor(term: Terminal) {
    this.term = term;

    // Initialize box in center of screen
    const initialSize = 5;
    this.box = {
      x: Math.floor((term.cols - this.getWidth(initialSize)) / 2),
      y: Math.floor((term.rows - this.getHeight(initialSize)) / 2),
      size: initialSize,
    };

    // Listen for resize events
    term.on('resize', () => {
      this.constrainBoxPosition();
      this.render();
    });
  }

  private getWidth(size: number): number {
    return size * 2; // Width is double the size
  }

  private getHeight(size: number): number {
    return size; // Height equals size
  }

  private constrainBoxPosition() {
    // Keep box within terminal bounds
    const maxX = this.term.cols - this.getWidth(this.box.size);
    const maxY = this.term.rows - this.getHeight(this.box.size);

    this.box.x = Math.max(0, Math.min(this.box.x, maxX));
    this.box.y = Math.max(3, Math.min(this.box.y, maxY - 1)); // Leave room for header and footer
  }

  private isInsideBox(x: number, y: number): boolean {
    // Mouse coordinates are 1-based, so we need to convert to 0-based
    const mouseX = x - 1;
    const mouseY = y - 1;
    const width = this.getWidth(this.box.size);
    const height = this.getHeight(this.box.size);

    return (
      mouseX >= this.box.x &&
      mouseX < this.box.x + width &&
      mouseY >= this.box.y &&
      mouseY < this.box.y + height
    );
  }

  private resizeBox(delta: number) {
    // Store center position before resize
    const oldWidth = this.getWidth(this.box.size);
    const oldHeight = this.getHeight(this.box.size);
    const centerX = this.box.x + Math.floor(oldWidth / 2);
    const centerY = this.box.y + Math.floor(oldHeight / 2);

    // Calculate new size with limits
    const newSize = Math.max(
      this.minSize,
      Math.min(this.maxSize, this.box.size + delta)
    );

    // Only resize if size actually changes
    if (newSize !== this.box.size) {
      this.box.size = newSize;

      // Recenter box at the same position
      const newWidth = this.getWidth(newSize);
      const newHeight = this.getHeight(newSize);
      this.box.x = centerX - Math.floor(newWidth / 2);
      this.box.y = centerY - Math.floor(newHeight / 2);

      // Ensure box stays within bounds after resize
      this.constrainBoxPosition();
    }
  }

  private startMovingTo(targetX: number, targetY: number) {
    const width = this.getWidth(this.box.size);
    const height = this.getHeight(this.box.size);

    // Calculate target position to center box at click point
    let targetBoxX = targetX - Math.floor(width / 2);
    let targetBoxY = targetY - Math.floor(height / 2);

    // Constrain target box position to terminal bounds
    const maxX = this.term.cols - width;
    const maxY = this.term.rows - height;
    targetBoxX = Math.max(0, Math.min(targetBoxX, maxX));
    targetBoxY = Math.max(3, Math.min(targetBoxY, maxY - 1)); // Leave room for header and footer

    // Calculate actual crosshair position (center of constrained box)
    const constrainedCrosshairX = targetBoxX + Math.floor(width / 2);
    const constrainedCrosshairY = targetBoxY + Math.floor(height / 2);

    // Calculate distance for duration
    const dx = targetBoxX - this.box.x;
    const dy = targetBoxY - this.box.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Duration based on distance (min 500ms, max 1500ms)
    const duration = Math.min(1500, Math.max(500, distance * 20));

    this.moveAnimation = {
      startX: this.box.x,
      startY: this.box.y,
      targetX: targetBoxX,
      targetY: targetBoxY,
      startTime: Date.now(),
      duration,
    };

    // Show crosshair at constrained position
    this.crosshair = {
      x: constrainedCrosshairX,
      y: constrainedCrosshairY,
      startTime: Date.now(),
      duration, // Same duration as movement
    };

    this.isMoving = true;
  }

  private updateAnimation() {
    if (!(this.moveAnimation && this.isMoving)) {
      return false;
    }

    const now = Date.now();
    const elapsed = now - this.moveAnimation.startTime;
    const progress = Math.min(1, elapsed / this.moveAnimation.duration);

    if (progress >= 1) {
      // Animation complete
      this.box.x = this.moveAnimation.targetX;
      this.box.y = this.moveAnimation.targetY;
      this.constrainBoxPosition();
      this.isMoving = false;
      this.moveAnimation = null;
      return true;
    }

    // Ease-in-out curve: 3t² - 2t³
    const eased = progress * progress * (3 - 2 * progress);

    // Interpolate position
    this.box.x = Math.round(
      this.moveAnimation.startX +
        (this.moveAnimation.targetX - this.moveAnimation.startX) * eased
    );
    this.box.y = Math.round(
      this.moveAnimation.startY +
        (this.moveAnimation.targetY - this.moveAnimation.startY) * eased
    );

    return true;
  }

  hasCrosshair(): boolean {
    return this.crosshair !== null;
  }

  private updateFollowMode() {
    if (!this.isFollowing) {
      return;
    }

    const width = this.getWidth(this.box.size);
    const height = this.getHeight(this.box.size);

    // Calculate box center
    const boxCenterX = this.box.x + Math.floor(width / 2);
    const boxCenterY = this.box.y + Math.floor(height / 2);

    // Calculate distance to cursor
    const dx = this.lastCursorPos.x - boxCenterX;
    const dy = this.lastCursorPos.y - boxCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Skip if cursor is exactly at center
    if (distance < 1) {
      return;
    }

    // Speed based on distance, but much slower
    // Max speed of 0.5 cells per frame (capped), only when very far (40+ cells away)
    const speed = Math.min(0.5, distance / 40);

    // Calculate normalized direction
    const dirX = dx / distance;
    const dirY = dy / distance;

    // Move towards cursor with fractional accumulation for smooth slow movement
    const moveX = dirX * speed;
    const moveY = dirY * speed;

    // For slow movement, use probability-based movement
    // This ensures smooth movement even at fractional speeds
    if (Math.abs(moveX) >= 1) {
      this.box.x += moveX > 0 ? 1 : -1;
    } else if (
      Math.abs(moveX) > 0.1 &&
      distance > 1.5 &&
      Math.random() < Math.abs(moveX)
    ) {
      // Use probability for fractional movement
      this.box.x += moveX > 0 ? 1 : -1;
    }

    if (Math.abs(moveY) >= 1) {
      this.box.y += moveY > 0 ? 1 : -1;
    } else if (
      Math.abs(moveY) > 0.1 &&
      distance > 1.5 &&
      Math.random() < Math.abs(moveY)
    ) {
      // Use probability for fractional movement
      this.box.y += moveY > 0 ? 1 : -1;
    }

    // Constrain position
    this.constrainBoxPosition();
  }

  isBoxMovingInFollowMode(): boolean {
    if (!this.isFollowing) {
      return false;
    }

    const width = this.getWidth(this.box.size);
    const height = this.getHeight(this.box.size);
    const boxCenterX = this.box.x + Math.floor(width / 2);
    const boxCenterY = this.box.y + Math.floor(height / 2);

    const dx = this.lastCursorPos.x - boxCenterX;
    const dy = this.lastCursorPos.y - boxCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    return distance > 2; // Moving when more than 2 cells away
  }

  private isInsideExitButton(x: number, y: number): boolean {
    // Exit button is in the upper-right corner
    const buttonX = this.term.cols - 6; // " Exit " is 6 chars wide
    const buttonY = 0;
    const mouseX = x - 1; // Convert to 0-based
    const mouseY = y - 1;

    return mouseY === buttonY && mouseX >= buttonX && mouseX < this.term.cols;
  }

  handleMouseEvent(event: MouseEvent) {
    switch (event.kind) {
      case 'move':
        // Update cursor position for follow mode
        this.lastCursorPos.x = event.x - 1;
        this.lastCursorPos.y = event.y - 1;

        // Check hover states
        this.isHoveringExit = this.isInsideExitButton(event.x, event.y);

        if (!(this.isMoving || this.isFollowing)) {
          this.isHovering = this.isInsideBox(event.x, event.y);
        }
        break;

      case 'down':
        // Check if clicking on exit button
        if (event.button === 1 && this.isInsideExitButton(event.x, event.y)) {
          // Exit the application
          process.exit(0);
        } else if (
          event.button === 1 &&
          this.isInsideBox(event.x, event.y) &&
          !this.isMoving
        ) {
          // Left click - start dragging
          this.isDragging = true;
          // Convert 1-based mouse coords to 0-based
          this.dragOffset.x = event.x - 1 - this.box.x;
          this.dragOffset.y = event.y - 1 - this.box.y;
        } else if (event.button === 2 && !this.isMoving) {
          if (this.isInsideBox(event.x, event.y)) {
            // Right click inside box - toggle follow mode
            this.isFollowing = !this.isFollowing;
            if (this.isFollowing) {
              this.blinkStartTime = Date.now();
            }
          } else if (!this.isFollowing) {
            // Right click outside box - start animated movement
            this.startMovingTo(event.x - 1, event.y - 1);
          }
        }
        break;

      case 'up':
        this.isDragging = false;
        break;

      case 'drag':
        if (this.isDragging && event.button === 1) {
          // Convert 1-based mouse coords to 0-based
          this.box.x = event.x - 1 - this.dragOffset.x;
          this.box.y = event.y - 1 - this.dragOffset.y;
          this.constrainBoxPosition();
        }
        break;

      case 'scroll':
        if (this.isInsideBox(event.x, event.y) && !this.isMoving) {
          // Mouse wheel events: button is "WheelUp" or "WheelDown"
          if (event.button === 'WheelUp') {
            this.resizeBox(1); // Enlarge
          } else if (event.button === 'WheelDown') {
            this.resizeBox(-1); // Shrink
          }
        }
        break;
      default:
        // Other mouse events not handled
        break;
    }
  }

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Comprehensive render function for interactive demo
  render() {
    // Clear the terminal buffer
    this.term.clear();

    // Update animation
    this.updateAnimation();

    // Update follow mode
    this.updateFollowMode();

    // Update crosshair
    if (this.crosshair) {
      const elapsed = Date.now() - this.crosshair.startTime;
      if (elapsed > this.crosshair.duration) {
        this.crosshair = null;
      }
    }

    // Header - no background color needed!
    this.term.putText(
      0,
      0,
      'Drag & Drop Demo - Right click box to follow cursor, right click elsewhere to move',
      { fg: '#ebdbb2' }
    );

    // Exit button in upper-right corner
    const exitButtonX = this.term.cols - 6;
    this.term.putText(0, exitButtonX, ' Exit ', {
      fg: '#ffffff',
      bg: this.isHoveringExit ? '#fb4934' : '#cc241d', // Brighter red on hover
      bold: true,
    });

    let state: string;
    if (this.isFollowing) {
      state = 'Following';
    } else if (this.isMoving) {
      state = 'Moving';
    } else if (this.isDragging) {
      state = 'Dragging';
    } else if (this.isHovering) {
      state = 'Hovering';
    } else {
      state = 'Idle';
    }
    this.term.putText(
      1,
      0,
      `Position: (${this.box.x}, ${this.box.y}) | State: ${state} | Size: ${this.box.size}`,
      { fg: '#928374' }
    );

    // Determine box color based on state
    let boxColor: Color;
    if (this.isFollowing) {
      boxColor = '#689d6a'; // Green for follow mode
    } else if (this.isMoving) {
      boxColor = '#b16286'; // Purple/magenta for moving
    } else if (this.isDragging) {
      boxColor = '#d73502'; // Dark red/orange
    } else if (this.isHovering) {
      boxColor = '#d79921'; // Dark yellow/amber
    } else {
      boxColor = '#458588'; // Dark blue
    }

    // Draw crosshair first (so box can overdraw it)
    if (this.crosshair) {
      const elapsed = Date.now() - this.crosshair.startTime;
      const progress = elapsed / this.crosshair.duration;

      // Fade from white to dim
      let color: Color;
      if (progress < 0.3) {
        color = '#ffffff'; // White
      } else if (progress < 0.6) {
        color = '#c0c0c0'; // Light gray
      } else if (progress < 0.9) {
        color = '#808080'; // Medium gray
      } else {
        color = '#404040'; // Dark gray
      }

      // Simple cross character
      this.term.putChar(this.crosshair.y, this.crosshair.x, '✚', { fg: color });
    }

    // Draw the box after crosshair (to overdraw it when they overlap)
    const width = this.getWidth(this.box.size);
    const height = this.getHeight(this.box.size);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        this.term.putChar(this.box.y + y, this.box.x + x, ' ', {
          bg: boxColor,
        });
      }
    }

    // Draw eyes (always shown if box is big enough)
    if (width >= 5 && height >= 3) {
      const eyeY = this.box.y + Math.floor(height / 3);
      const leftEyeX = this.box.x + Math.floor(width / 3) - 1;
      const rightEyeX = this.box.x + Math.floor((2 * width) / 3);

      // Determine eye character based on state
      let eyeChar: string;

      if (this.isDragging) {
        // X eyes when being dragged
        eyeChar = 'x';
      } else if (this.isFollowing) {
        const isMoving = this.isBoxMovingInFollowMode();
        const blinkTime = (Date.now() - this.blinkStartTime) % 3000; // 3 second cycle
        const isBlinking = blinkTime > 2700; // Blink for last 300ms of cycle

        if (isBlinking) {
          eyeChar = '_';
        } else if (isMoving) {
          // Eyes look in direction of movement
          const boxCenterX = this.box.x + Math.floor(width / 2);
          if (this.lastCursorPos.x < boxCenterX - 2) {
            eyeChar = '<';
          } else if (this.lastCursorPos.x > boxCenterX + 2) {
            eyeChar = '>';
          } else {
            eyeChar = 'O';
          }
        } else {
          eyeChar = 'O';
        }
      } else {
        // Normal eyes when idle
        const blinkTime = Date.now() % 4000; // 4 second cycle when not following
        const isBlinking = blinkTime > 3700; // Blink for last 300ms
        eyeChar = isBlinking ? '_' : 'O';
      }

      // Draw eyes
      this.term.putChar(eyeY, leftEyeX, eyeChar, {
        fg: '#ffffff',
        bg: boxColor,
        bold: true,
      });
      this.term.putChar(eyeY, rightEyeX, eyeChar, {
        fg: '#ffffff',
        bg: boxColor,
        bold: true,
      });
    }

    // Footer - no background color needed!
    this.term.putText(this.term.rows - 1, 0, 'Press Ctrl+C to exit', {
      fg: '#928374',
    });

    // Render to screen
    this.term.render();
  }
}

async function main() {
  const term = Terminal.open();
  const demo = new DragDropDemo(term);
  let stream: input.InputEventStream | null = null;

  try {
    // Clear screen and hide cursor
    term.clearScreen();
    term.hideCursor();

    // Configure input with mouse support
    await input.configureInput(term, {
      mouse: true,
      mouseProtocol: 'sgr',
      kittyKeyboard: true,
      bracketedPaste: false,
      focusEvents: false,
    });

    // Initial render
    demo.render();

    // Create event stream
    stream = input.createEventStream();

    // Animation loop
    let animationFrame: ReturnType<typeof setInterval> | null = null;

    const startAnimationLoop = () => {
      if (!animationFrame) {
        animationFrame = setInterval(() => {
          if (demo.isMoving || demo.hasCrosshair() || demo.isFollowing) {
            demo.render();
          } else if (animationFrame) {
            // Stop animation loop when not moving, no crosshair, and not following
            clearInterval(animationFrame);
            animationFrame = null;
          }
        }, 16); // ~60 FPS
      }
    };

    // Handle events
    for await (const event of stream) {
      if (event.type === 'mouse') {
        demo.handleMouseEvent(event);
        demo.render();

        // Start animation loop if moving, showing crosshair, or following
        if (
          (demo.isMoving || demo.hasCrosshair() || demo.isFollowing) &&
          !animationFrame
        ) {
          startAnimationLoop();
        }
      } else if (
        event.type === 'key' &&
        event.modifiers.ctrl &&
        typeof event.code === 'object' &&
        event.code.char === 'c'
      ) {
        // Check for exit
        if (animationFrame) {
          clearInterval(animationFrame);
        }
        break;
      }
    }
  } catch (_error) {
    // Exit gracefully
  } finally {
    // Cleanup
    if (stream) {
      stream.close();
    }
    term.showCursor();
    term.clearScreen();
    await input.resetTerminal(term);
    term.close();
    process.exit(0);
  }
}

main().catch((_error) => {
  process.exit(1);
});
