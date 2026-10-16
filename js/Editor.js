/**
 * PixelQuest - Interactive Level Editor
 * Class Editor: Handles mouse painting/erasing on canvas grid during 'EDIT' mode,
 * displaying tile highlight cursor overlays, ghost previews, and grid lines.
 */

class Editor {
  /**
   * Tool to Tile ID mapping
   */
  static TOOL_MAP = {
    'ground': 1,   // Level.TILES.GROUND
    'platform': 2, // Level.TILES.PLATFORM
    'spike': 3,    // Level.TILES.SPIKE
    'coin': 4,     // Level.TILES.COIN
    'player': 5,   // Level.TILES.SPAWN
    'eraser': 0,   // Level.TILES.AIR
  };

  /**
   * @param {Level} level - Target level instance
   * @param {HTMLCanvasElement} canvas - Game canvas element
   * @param {Object} [options]
   * @param {InputHandler} [options.input] - Input manager instance
   * @param {Function} [options.onTileChanged] - Callback invoked when a tile is painted/erased
   */
  constructor(level, canvas, options = {}) {
    this.level = level;
    this.canvas = canvas;
    this.input = options.input || null;
    this.onTileChanged = options.onTileChanged || (() => {});

    // State
    this.enabled = true; // Active in Edit Mode
    this.activeTool = 'ground';
    this.showGrid = true;
    this.isPainting = false;
    this.paintButton = 0; // 0: LMB (paint), 2: RMB (erase)
    this.hoverTile = { col: -1, row: -1 };

    // Bind event handlers
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleMouseLeave = this.handleMouseLeave.bind(this);
    this.handleContextMenu = this.handleContextMenu.bind(this);

    this.attachEvents();
  }

  /**
   * Attaches pointer events to the canvas
   */
  attachEvents() {
    if (!this.canvas) return;

    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave);
    this.canvas.addEventListener('contextmenu', this.handleContextMenu);
  }

  /**
   * Cleans up event listeners
   */
  destroy() {
    if (!this.canvas) return;

    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
  }

  /**
   * Prevents default context menu on right clicks
   */
  handleContextMenu(e) {
    e.preventDefault();
  }

  /**
   * Computes canvas-relative tile coordinates from a mouse event
   * @param {MouseEvent} e
   * @returns {{col: number, row: number, x: number, y: number}}
   */
  getTileFromEvent(e) {
    if (!this.canvas) return { col: -1, row: -1, x: 0, y: 0 };

    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { col: -1, row: -1, x: 0, y: 0 };

    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const col = Math.floor(x / this.level.tileSize);
    const row = Math.floor(y / this.level.tileSize);

    return { col, row, x, y };
  }

  /**
   * Pointer down handler: begins painting or erasing
   */
  handleMouseDown(e) {
    if (!this.enabled) return;

    this.isPainting = true;
    this.paintButton = e.button;

    const { col, row } = this.getTileFromEvent(e);
    this.hoverTile = { col, row };

    this.paintAt(col, row, e.button === 2);
  }

  /**
   * Pointer move handler: paints along drag path and updates hover coords
   */
  handleMouseMove(e) {
    const { col, row } = this.getTileFromEvent(e);
    this.hoverTile = { col, row };

    if (!this.enabled || !this.isPainting) return;

    this.paintAt(col, row, this.paintButton === 2);
  }

  /**
   * Pointer up handler: concludes active stroke
   */
  handleMouseUp() {
    this.isPainting = false;
  }

  /**
   * Mouse leave handler: clears hover target
   */
  handleMouseLeave() {
    this.hoverTile = { col: -1, row: -1 };
  }

  /**
   * Paints or erases tile at specified grid coordinates
   * @param {number} col
   * @param {number} row
   * @param {boolean} [isRightClick=false]
   */
  paintAt(col, row, isRightClick = false) {
    if (col < 0 || col >= this.level.cols || row < 0 || row >= this.level.rows) return;

    const isErase = isRightClick || this.activeTool === 'eraser';
    const tileType = isErase ? Level.TILES.AIR : (Editor.TOOL_MAP[this.activeTool] ?? Level.TILES.GROUND);

    const prevTile = this.level.getTile(col, row);
    if (prevTile !== tileType) {
      this.level.setTile(col, row, tileType);
      this.onTileChanged(col, row, tileType, isErase);
    }
  }

  /**
   * Enables Edit Mode interactions
   */
  enable() {
    this.enabled = true;
  }

  /**
   * Disables Edit Mode interactions (used during Play Mode)
   */
  disable() {
    this.enabled = false;
    this.isPainting = false;
    this.hoverTile = { col: -1, row: -1 };
  }

  /**
   * Sets active tile painting tool
   * @param {string} tool - 'ground', 'platform', 'spike', 'coin', 'player', 'eraser'
   */
  setActiveTool(tool) {
    this.activeTool = tool;
  }

  /**
   * Toggles grid overlay visibility
   * @param {boolean} [visible]
   * @returns {boolean} New visibility state
   */
  toggleGrid(visible = !this.showGrid) {
    this.showGrid = visible;
    return this.showGrid;
  }

  // =========================================================================
  // Editor Overlay Rendering
  // =========================================================================

  /**
   * Renders grid lines and hover tile ghost cursor
   * @param {CanvasRenderingContext2D} ctx
   */
  renderOverlay(ctx) {
    const s = this.level.tileSize;

    // 1. Overlay Grid Lines
    if (this.showGrid && this.enabled) {
      if (typeof this.level.drawGridOverlay === 'function') {
        this.level.drawGridOverlay(ctx);
      } else {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= this.level.width; x += s) {
          ctx.moveTo(x + 0.5, 0);
          ctx.lineTo(x + 0.5, this.level.height);
        }
        for (let y = 0; y <= this.level.height; y += s) {
          ctx.moveTo(0, y + 0.5);
          ctx.lineTo(this.level.width, y + 0.5);
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    // 2. Hover Tile Cursor & Ghost Preview
    if (this.enabled) {
      const { col, row } = this.hoverTile;
      if (col >= 0 && col < this.level.cols && row >= 0 && row < this.level.rows) {
        const px = col * s;
        const py = row * s;

        ctx.save();

        // Neon outline
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 1, py + 1, s - 2, s - 2);

        // Tool ghost preview
        ctx.globalAlpha = 0.4;
        const toolTile = Editor.TOOL_MAP[this.activeTool] ?? Level.TILES.GROUND;
        switch (toolTile) {
          case Level.TILES.GROUND:
            this.level.drawGroundTile(ctx, px, py);
            break;
          case Level.TILES.PLATFORM:
            this.level.drawPlatformTile(ctx, px, py);
            break;
          case Level.TILES.SPIKE:
            this.level.drawSpikeTile(ctx, px, py);
            break;
          case Level.TILES.COIN:
            this.level.drawCoinTile(ctx, px, py, 0);
            break;
          case Level.TILES.SPAWN:
            this.level.drawSpawnTile(ctx, px, py);
            break;
          case Level.TILES.AIR:
            ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
            ctx.fillRect(px, py, s, s);
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(px + 6, py + 6);
            ctx.lineTo(px + s - 6, py + s - 6);
            ctx.moveTo(px + s - 6, py + 6);
            ctx.lineTo(px + 6, py + s - 6);
            ctx.stroke();
            break;
        }

        ctx.restore();
      }
    }
  }
}

// Global browser attachments
if (typeof window !== 'undefined') {
  window.Editor = Editor;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Editor;
}
