/**
 * PixelQuest - Game Engine Core
 * Class Engine: Manages requestAnimationFrame, calculates Delta Time (Δt)
 * for 60 FPS physics normalization, and calculates dynamic FPS metrics.
 */

class Engine {
  /**
   * @param {Object} options
   * @param {HTMLCanvasElement} [options.canvas] - Canvas element reference
   * @param {CanvasRenderingContext2D} [options.ctx] - Canvas 2D context
   * @param {Function} [options.update] - Function called on each update step with dt (seconds)
   * @param {Function} [options.render] - Function called on each frame to draw graphics
   * @param {InputHandler} [options.input] - Input manager instance
   * @param {PhysicsEngine} [options.physics] - Physics manager class/instance
   * @param {Player} [options.player] - Player entity instance
   * @param {{x: number, y: number, width: number, height: number}} [options.bounds] - Screen boundary rectangle
   * @param {boolean} [options.enablePlayerPhysics=false] - Whether Engine updates player physics automatically
   * @param {number} [options.targetFps=60] - Expected baseline FPS
   * @param {number} [options.maxDeltaTime=0.1] - Delta time cap in seconds (100ms)
   */
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.ctx = options.ctx || (this.canvas ? this.canvas.getContext('2d') : null);

    this.onUpdate = options.update || ((dt, engine) => {});
    this.onRender = options.render || ((ctx, engine) => {});

    // Subsystem Integrations
    const InputClass = typeof InputHandler !== 'undefined' ? InputHandler : (typeof Input !== 'undefined' ? Input : null);
    const PhysicsClass = typeof PhysicsEngine !== 'undefined' ? PhysicsEngine : (typeof Physics !== 'undefined' ? Physics : null);
    const PlayerClass = typeof Player !== 'undefined' ? Player : null;

    this.input = options.input || (InputClass ? new InputClass(this.canvas) : null);
    this.physics = options.physics || PhysicsClass;
    this.player = options.player || (PlayerClass ? new PlayerClass(64, 384) : null);
    this.bounds = options.bounds || { x: 0, y: 0, width: 800, height: 480 };
    this.enablePlayerPhysics = options.enablePlayerPhysics !== undefined ? options.enablePlayerPhysics : false;

    // Timing configurations
    this.targetFps = options.targetFps || 60;
    this.maxDeltaTime = options.maxDeltaTime || 0.1; // 100ms maximum delta step

    // Loop state
    this.isRunning = false;
    this.rafId = null;

    // Timing metrics
    this.lastTime = 0;
    this.deltaTime = 0; // In seconds
    this.totalTime = 0; // Total running time in seconds

    // FPS calculations
    this.fps = this.targetFps;
    this.frameCount = 0;
    this.fpsLastSample = 0;
    this.fpsSampleInterval = 500; // Recalculate FPS every 500ms for smooth display

    // Cross-environment animation frame adapters
    this.requestFrame = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame.bind(window)
      : (cb) => setTimeout(() => cb(performance.now()), 1000 / this.targetFps);
    this.cancelFrame = typeof cancelAnimationFrame === 'function'
      ? cancelAnimationFrame.bind(window)
      : (id) => clearTimeout(id);

    // Bind frame loop
    this.loop = this.loop.bind(this);
  }

  /**
   * Starts the animation loop
   */
  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastTime = performance.now();
    this.fpsLastSample = this.lastTime;
    this.frameCount = 0;
    this.deltaTime = 0;

    this.rafId = this.requestFrame(this.loop);
  }

  /**
   * Stops the animation loop
   */
  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.rafId !== null) {
      this.cancelFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Core frame callback executed on every requestAnimationFrame tick
   * @param {DOMHighResTimeStamp} currentTime
   */
  loop(currentTime) {
    if (!this.isRunning) return;

    // 1. Calculate raw delta time in seconds
    let dt = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Prevent negative or NaN delta time
    if (Number.isNaN(dt) || dt <= 0) {
      dt = 1 / this.targetFps;
    }

    // 2. Clamp delta time to avoid large position jumps when window loses focus
    if (dt > this.maxDeltaTime) {
      dt = this.maxDeltaTime;
    }

    this.deltaTime = dt;
    this.totalTime += dt;

    // 3. Compute dynamic FPS metrics
    this.frameCount++;
    const elapsedSinceFpsSample = currentTime - this.fpsLastSample;
    if (elapsedSinceFpsSample >= this.fpsSampleInterval) {
      this.fps = Math.round((this.frameCount * 1000) / elapsedSinceFpsSample);
      this.frameCount = 0;
      this.fpsLastSample = currentTime;
    }

    // 4. Update phase (framerate-independent physics and game state)
    this.update(dt);

    // 5. Render phase (graphics drawing)
    this.render();

    // 6. Request next frame
    this.rafId = this.requestFrame(this.loop);
  }

  /**
   * Performs the update pass
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    // If enabled, automatically resolve player movement & boundary collisions
    if (this.player && this.enablePlayerPhysics) {
      this.player.update(dt, this.input);

      if (this.physics && this.bounds) {
        this.physics.resolveBoundaries(this.player, this.bounds);
      }
    }

    // Delegate to custom game logic update pass
    this.onUpdate(dt, this);
  }

  /**
   * Performs the render pass
   */
  render() {
    this.onRender(this.ctx, this);
  }

  /**
   * Returns active player instance
   * @returns {Player|null}
   */
  getPlayer() {
    return this.player;
  }

  /**
   * Sets or swaps active player entity
   * @param {Player} player
   */
  setPlayer(player) {
    this.player = player;
  }

  /**
   * Returns input manager
   * @returns {InputHandler|null}
   */
  getInput() {
    return this.input;
  }

  /**
   * Returns physics engine reference
   * @returns {PhysicsEngine|null}
   */
  getPhysics() {
    return this.physics;
  }

  /**
   * Returns current measured FPS
   * @returns {number}
   */
  getFps() {
    return this.fps;
  }

  /**
   * Returns last frame's delta time in seconds
   * @returns {number}
   */
  getDeltaTime() {
    return this.deltaTime;
  }

  /**
   * Returns total running time in seconds
   * @returns {number}
   */
  getTotalTime() {
    return this.totalTime;
  }
}

// Global browser attachments
if (typeof window !== 'undefined') {
  window.Engine = Engine;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Engine;
}
