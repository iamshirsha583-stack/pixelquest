/**
 * PixelQuest - Input Manager
 * Class InputHandler: Tracks keyboard states (WASD, Arrows, Space, Tab, Hotkeys 1-6)
 * and mouse coordinates relative to canvas.
 */

class InputHandler {
  /**
   * @param {HTMLCanvasElement} [canvas] - Target canvas element for relative mouse coordinates
   */
  constructor(canvas = null) {
    this.canvas = canvas;

    // Active key states (keyed by e.code and lowercased e.key)
    this.keys = new Map();

    // Mouse pointer state
    this.mouse = {
      x: 0,
      y: 0,
      tileX: 0,
      tileY: 0,
      isDown: false,
      button: 0, // 0: LMB, 2: RMB
      isDragging: false,
      tileSize: 32,
    };

    // Action Key Mapping
    this.actionMap = {
      left: ['ArrowLeft', 'KeyA', 'a', 'A'],
      right: ['ArrowRight', 'KeyD', 'd', 'D'],
      up: ['ArrowUp', 'KeyW', 'w', 'W'],
      down: ['ArrowDown', 'KeyS', 's', 'S'],
      jump: ['Space', ' ', 'ArrowUp', 'KeyW', 'w', 'W'],
    };

    // Bind event handlers
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleContextMenu = this.handleContextMenu.bind(this);

    this.attachListeners();
  }

  /**
   * Attaches window and canvas event listeners
   */
  attachListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    if (this.canvas) {
      this.canvas.addEventListener('mousedown', this.handleMouseDown);
      window.addEventListener('mousemove', this.handleMouseMove);
      window.addEventListener('mouseup', this.handleMouseUp);
      this.canvas.addEventListener('contextmenu', this.handleContextMenu);
    }
  }

  /**
   * Removes all attached listeners
   */
  destroy() {
    if (typeof window === 'undefined') return;

    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);

    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this.handleMouseDown);
      window.removeEventListener('mousemove', this.handleMouseMove);
      window.removeEventListener('mouseup', this.handleMouseUp);
      this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
    }
  }

  // --- Keyboard Event Handlers ---

  handleKeyDown(e) {
    // Avoid hijacking keystrokes when typing into text inputs
    if (e.target && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') {
      return;
    }

    this.keys.set(e.code, true);
    this.keys.set(e.key, true);
    this.keys.set(e.key.toLowerCase(), true);

    // Prevent default scrolling on game control keys
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key) || e.code === 'Space') {
      e.preventDefault();
    }
  }

  handleKeyUp(e) {
    this.keys.set(e.code, false);
    this.keys.set(e.key, false);
    this.keys.set(e.key.toLowerCase(), false);
  }

  // --- Pointer Event Handlers ---

  handleContextMenu(e) {
    e.preventDefault(); // Prevent native right-click context menu
  }

  handleMouseDown(e) {
    this.mouse.isDown = true;
    this.mouse.button = e.button;
    this.mouse.isDragging = false;
    this.updateMousePosition(e);
  }

  handleMouseMove(e) {
    if (this.mouse.isDown) {
      this.mouse.isDragging = true;
    }
    this.updateMousePosition(e);
  }

  handleMouseUp() {
    this.mouse.isDown = false;
    this.mouse.isDragging = false;
  }

  /**
   * Calculates canvas-relative mouse coordinates accounting for CSS scaling
   * @param {MouseEvent} e
   */
  updateMousePosition(e) {
    if (!this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    const rawX = (e.clientX - rect.left) * scaleX;
    const rawY = (e.clientY - rect.top) * scaleY;

    this.mouse.x = Math.max(0, Math.min(this.canvas.width, rawX));
    this.mouse.y = Math.max(0, Math.min(this.canvas.height, rawY));

    this.mouse.tileX = Math.floor(this.mouse.x / this.mouse.tileSize);
    this.mouse.tileY = Math.floor(this.mouse.y / this.mouse.tileSize);
  }

  // --- Query API ---

  /**
   * Checks if a specific key code or key name is currently pressed
   * @param {string} codeOrKey - e.g. 'Space', 'ArrowLeft', 'w', 'Tab', '1'
   * @returns {boolean}
   */
  isKeyDown(codeOrKey) {
    return Boolean(
      this.keys.get(codeOrKey) ||
      this.keys.get(codeOrKey.toLowerCase()) ||
      this.keys.get(codeOrKey.toUpperCase())
    );
  }

  /**
   * Checks if an action group is active (e.g. 'left', 'right', 'jump')
   * @param {'left'|'right'|'up'|'down'|'jump'} action
   * @returns {boolean}
   */
  isActionActive(action) {
    const keys = this.actionMap[action];
    if (!keys) return false;
    return keys.some(k => this.isKeyDown(k));
  }

  /**
   * Returns normalized horizontal movement axis (-1, 0, or 1)
   * @returns {number}
   */
  getHorizontalAxis() {
    let axis = 0;
    if (this.isActionActive('left')) axis -= 1;
    if (this.isActionActive('right')) axis += 1;
    return axis;
  }

  /**
   * Returns whether jump is currently held
   * @returns {boolean}
   */
  isJump() {
    return this.isActionActive('jump');
  }

  /**
   * Returns current mouse pointer state
   * @returns {Object}
   */
  getMouse() {
    return this.mouse;
  }
}

// Global browser attachments
if (typeof window !== 'undefined') {
  window.InputHandler = InputHandler;
  window.Input = InputHandler;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = InputHandler;
}
