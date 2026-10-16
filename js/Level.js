/**
 * PixelQuest - Level & Tile Map System
 * Class Level: Manages a 25x15 grid matrix with 32px tile size (800x480).
 * Tile types: 0 (Air), 1 (Ground), 2 (Platform), 3 (Spike), 4 (Coin), 5 (Player Spawn).
 * Provides drawing methods for grid overlay lines and textured tile graphics,
 * and implements exportToJSON() and loadFromJSON(jsonString) serialization.
 */

class Level {
  // Tile Type Definitions
  static TILES = {
    AIR: 0,
    GROUND: 1,
    PLATFORM: 2,
    SPIKE: 3,
    COIN: 4,
    SPAWN: 5,
  };

  static TILE_NAMES = {
    0: 'Air (Eraser)',
    1: 'Solid Ground',
    2: 'Platform',
    3: 'Hazard (Spike)',
    4: 'Collectible Coin',
    5: 'Player Spawn',
  };

  /**
   * @param {Object} [options]
   * @param {number} [options.cols=25]
   * @param {number} [options.rows=15]
   * @param {number} [options.tileSize=32]
   */
  constructor(options = {}) {
    this.cols = options.cols || 25;
    this.rows = options.rows || 15;
    this.tileSize = options.tileSize || 32;

    this.width = this.cols * this.tileSize; // 800px
    this.height = this.rows * this.tileSize; // 480px

    this.spawnPoint = { col: 2, row: 12 };
    this.grid = this.createEmptyGrid();

    this.totalCoins = 0;
    this.coinsCollected = 0;

    // Snapshot state for Play/Edit restoration
    this.snapshotGrid = null;
    this.snapshotSpawn = null;
    this.snapshotTotalCoins = 0;

    // Load initial demo layout
    this.loadPreset();
  }

  /**
   * Creates an empty 2D grid matrix filled with AIR (0)
   * @returns {number[][]}
   */
  createEmptyGrid() {
    return Array.from({ length: this.rows }, () => new Array(this.cols).fill(Level.TILES.AIR));
  }

  /**
   * Loads the default demo platformer layout
   */
  loadPreset() {
    this.grid = this.createEmptyGrid();

    // Solid floor
    for (let c = 0; c < this.cols; c++) {
      this.grid[14][c] = Level.TILES.GROUND;
      this.grid[13][c] = Level.TILES.GROUND;
    }

    // Left and right boundary walls
    for (let r = 0; r < this.rows; r++) {
      this.grid[r][0] = Level.TILES.GROUND;
      this.grid[r][this.cols - 1] = Level.TILES.GROUND;
    }

    // Spike hazard pit in the floor
    for (let c = 11; c <= 14; c++) {
      this.grid[13][c] = Level.TILES.SPIKE;
    }

    // Floating jump-through platforms
    for (let c = 4; c <= 7; c++) this.grid[10][c] = Level.TILES.PLATFORM;
    for (let c = 9; c <= 12; c++) this.grid[8][c] = Level.TILES.PLATFORM;
    for (let c = 14; c <= 18; c++) this.grid[6][c] = Level.TILES.PLATFORM;
    for (let c = 19; c <= 22; c++) this.grid[9][c] = Level.TILES.PLATFORM;

    // Obstacle block
    for (let r = 10; r <= 12; r++) {
      this.grid[r][8] = Level.TILES.GROUND;
    }

    // Collectible gold coins
    this.grid[9][5] = Level.TILES.COIN;
    this.grid[9][6] = Level.TILES.COIN;
    this.grid[7][10] = Level.TILES.COIN;
    this.grid[7][11] = Level.TILES.COIN;
    this.grid[5][15] = Level.TILES.COIN;
    this.grid[5][16] = Level.TILES.COIN;
    this.grid[5][17] = Level.TILES.COIN;
    this.grid[8][20] = Level.TILES.COIN;
    this.grid[8][21] = Level.TILES.COIN;

    // Player Spawn Beacon
    this.spawnPoint = { col: 2, row: 12 };
    this.grid[12][2] = Level.TILES.SPAWN;

    this.countCoins();
    this.createSnapshot();
  }

  /**
   * Resets entire map to empty with basic floor and spawn
   */
  clear() {
    this.grid = this.createEmptyGrid();
    for (let c = 0; c < this.cols; c++) {
      this.grid[14][c] = Level.TILES.GROUND;
    }
    this.spawnPoint = { col: 2, row: 13 };
    this.grid[13][2] = Level.TILES.SPAWN;
    this.countCoins();
    this.createSnapshot();
  }

  /**
   * Returns tile type at grid coordinate
   * @param {number} col
   * @param {number} row
   * @returns {number}
   */
  getTile(col, row) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      return Level.TILES.AIR;
    }
    return this.grid[row][col];
  }

  /**
   * Sets tile type at grid coordinate
   * @param {number} col
   * @param {number} row
   * @param {number} tileType
   */
  setTile(col, row, tileType) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return;

    // Enforce only one Player Spawn on the map
    if (tileType === Level.TILES.SPAWN) {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (this.grid[r][c] === Level.TILES.SPAWN) {
            this.grid[r][c] = Level.TILES.AIR;
          }
        }
      }
      this.spawnPoint = { col, row };
    }

    this.grid[row][col] = tileType;
    this.countCoins();
  }

  /**
   * Counts active coins on the map
   */
  countCoins() {
    let count = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] === Level.TILES.COIN) count++;
      }
    }
    this.totalCoins = count;
    this.coinsCollected = 0;
  }

  /**
   * Serializes current level to JSON string
   * @returns {string} Formatted JSON
   */
  exportToJSON() {
    const data = {
      name: 'PixelQuest Custom Level',
      version: '1.0',
      timestamp: new Date().toISOString(),
      dimensions: {
        cols: this.cols,
        rows: this.rows,
        tileSize: this.tileSize,
        width: this.width,
        height: this.height,
      },
      spawnPoint: this.spawnPoint,
      grid: this.grid,
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Deserializes level from JSON string
   * @param {string|Object} jsonString
   * @returns {boolean} Success state
   */
  loadFromJSON(jsonString) {
    try {
      const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;

      if (!data || !data.grid || !Array.isArray(data.grid) || data.grid.length !== this.rows) {
        throw new Error('Invalid grid matrix dimensions in JSON');
      }

      this.grid = data.grid.map(row => [...row]);

      // Restore spawn point
      if (data.spawnPoint && typeof data.spawnPoint.col === 'number') {
        this.spawnPoint = { col: data.spawnPoint.col, row: data.spawnPoint.row };
      } else if (data.spawnPoint && typeof data.spawnPoint.x === 'number') {
        this.spawnPoint = { col: data.spawnPoint.x, row: data.spawnPoint.y };
      } else {
        // Scan grid for spawn tile
        let found = false;
        for (let r = 0; r < this.rows; r++) {
          for (let c = 0; c < this.cols; c++) {
            if (this.grid[r][c] === Level.TILES.SPAWN) {
              this.spawnPoint = { col: c, row: r };
              found = true;
              break;
            }
          }
          if (found) break;
        }
        if (!found) this.spawnPoint = { col: 2, row: 12 };
      }

      this.countCoins();
      this.createSnapshot();
      return true;
    } catch (err) {
      console.error('Level loadFromJSON failed:', err);
      return false;
    }
  }

  /**
   * Captures an immutable snapshot of current level tile grid
   */
  createSnapshot() {
    this.snapshotGrid = this.grid.map(row => [...row]);
    this.snapshotSpawn = { ...this.spawnPoint };
    this.countCoins();
    this.snapshotTotalCoins = this.totalCoins;
  }

  /**
   * Restores level tile grid and coins from previous snapshot
   */
  restoreSnapshot() {
    if (this.snapshotGrid) {
      this.grid = this.snapshotGrid.map(row => [...row]);
      this.spawnPoint = { ...this.snapshotSpawn };
      this.totalCoins = this.snapshotTotalCoins;
      this.coinsCollected = 0;
    }
  }

  /**
   * Resolves player physics collisions and trigger events with tiles
   * @param {Object} player
   * @param {Object} physics - PhysicsEngine reference
   * @returns {{coinCollected: boolean, hitHazard: boolean, coinCol: number, coinRow: number, coinX: number, coinY: number, hazardX: number, hazardY: number}}
   */
  resolveCollisions(player, physics) {
    const events = {
      coinCollected: false,
      hitHazard: false,
      coinCol: -1,
      coinRow: -1,
      coinX: 0,
      coinY: 0,
      hazardX: 0,
      hazardY: 0,
    };

    if (!player || !player.alive) return events;

    // Scan bounding tile bounds around player
    const leftCol = Math.max(0, Math.floor(player.x / this.tileSize));
    const rightCol = Math.min(this.cols - 1, Math.floor((player.x + player.width) / this.tileSize));
    const topRow = Math.max(0, Math.floor(player.y / this.tileSize));
    const bottomRow = Math.min(this.rows - 1, Math.floor((player.y + player.height) / this.tileSize));

    for (let r = topRow; r <= bottomRow; r++) {
      for (let c = leftCol; c <= rightCol; c++) {
        const tile = this.grid[r][c];
        const tileRect = {
          x: c * this.tileSize,
          y: r * this.tileSize,
          width: this.tileSize,
          height: this.tileSize,
        };

        // Solid Ground block
        if (tile === Level.TILES.GROUND) {
          physics.resolveAABB(player, tileRect);
        }

        // Semi-solid jump-through platform
        else if (tile === Level.TILES.PLATFORM) {
          physics.resolvePlatform(player, {
            x: tileRect.x,
            y: tileRect.y + 4,
            width: tileRect.width,
            height: 8,
          });
        }

        // Collectible Coin Trigger
        else if (tile === Level.TILES.COIN) {
          const coinBox = {
            x: tileRect.x + 8,
            y: tileRect.y + 8,
            width: 16,
            height: 16,
          };
          if (physics.checkAABB(player, coinBox)) {
            this.grid[r][c] = Level.TILES.AIR;
            this.coinsCollected++;
            events.coinCollected = true;
            events.coinCol = c;
            events.coinRow = r;
            events.coinX = tileRect.x + 16;
            events.coinY = tileRect.y + 16;
          }
        }

        // Lethal Spike Hazard Trigger
        else if (tile === Level.TILES.SPIKE) {
          if (!player.isInvulnerable && !player.isDying) {
            const spikeBox = {
              x: tileRect.x + 4,
              y: tileRect.y + 14,
              width: 24,
              height: 18,
            };
            if (physics.checkAABB(player, spikeBox)) {
              events.hitHazard = true;
              events.hazardX = tileRect.x + 16;
              events.hazardY = tileRect.y + 16;
            }
          }
        }
      }
    }

    return events;
  }

  // =========================================================================
  // Canvas Rendering & Visual Assets
  // =========================================================================

  /**
   * Renders the grid overlay lines across the 25x15 canvas
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} [color='rgba(255, 255, 255, 0.08)']
   */
  drawGridOverlay(ctx, color = 'rgba(255, 255, 255, 0.08)') {
    const s = this.tileSize;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let x = 0; x <= this.width; x += s) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, this.height);
    }
    for (let y = 0; y <= this.height; y += s) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(this.width, y + 0.5);
    }

    ctx.stroke();
    ctx.restore();
  }

  /**
   * Renders the tile grid to the canvas context
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} [animTicks=0]
   */
  render(ctx, animTicks = 0) {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const tile = this.grid[r][c];
        if (tile === Level.TILES.AIR) continue;

        const px = c * this.tileSize;
        const py = r * this.tileSize;

        switch (tile) {
          case Level.TILES.GROUND:
            this.drawGroundTile(ctx, px, py);
            break;
          case Level.TILES.PLATFORM:
            this.drawPlatformTile(ctx, px, py);
            break;
          case Level.TILES.SPIKE:
            this.drawSpikeTile(ctx, px, py);
            break;
          case Level.TILES.COIN:
            this.drawCoinTile(ctx, px, py, animTicks);
            break;
          case Level.TILES.SPAWN:
            this.drawSpawnTile(ctx, px, py);
            break;
        }
      }
    }
  }

  /**
   * Solid Ground Block: Soil base with lush grass top edge
   */
  drawGroundTile(ctx, px, py) {
    const s = this.tileSize;

    // Dirt foundation
    ctx.fillStyle = '#2f2015';
    ctx.fillRect(px, py, s, s);

    // Inner earthy variation
    ctx.fillStyle = '#3f2b1d';
    ctx.fillRect(px + 4, py + 12, 8, 8);
    ctx.fillRect(px + 18, py + 18, 10, 8);

    // Pebble stones
    ctx.fillStyle = '#573d2a';
    ctx.fillRect(px + 8, py + 22, 4, 4);
    ctx.fillRect(px + 20, py + 10, 6, 4);

    // Grass turf top
    ctx.fillStyle = '#22733b';
    ctx.fillRect(px, py, s, 8);

    ctx.fillStyle = '#39ad5a';
    ctx.fillRect(px, py, s, 3);

    // Hanging grass blades
    ctx.fillStyle = '#22733b';
    ctx.fillRect(px + 2, py + 8, 4, 3);
    ctx.fillRect(px + 10, py + 8, 5, 4);
    ctx.fillRect(px + 20, py + 8, 4, 3);
    ctx.fillRect(px + 28, py + 8, 3, 2);

    // Bright grass highlight
    ctx.fillStyle = '#68d391';
    ctx.fillRect(px + 2, py, 6, 2);
    ctx.fillRect(px + 14, py, 8, 2);
  }

  /**
   * Semi-solid jump-through Platform: Cyber girder
   */
  drawPlatformTile(ctx, px, py) {
    const s = this.tileSize;

    // Girder beam
    ctx.fillStyle = '#d97706';
    ctx.fillRect(px, py + 4, s, 8);

    // Neon amber upper rim
    ctx.fillStyle = '#fde047';
    ctx.fillRect(px, py + 2, s, 3);

    // Metallic underside
    ctx.fillStyle = '#78350f';
    ctx.fillRect(px, py + 11, s, 3);

    // Steel rivets
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px + 3, py + 5, 2, 2);
    ctx.fillRect(px + s - 5, py + 5, 2, 2);
  }

  /**
   * Lethal Spikes: Sharp metallic red/magenta blades
   */
  drawSpikeTile(ctx, px, py) {
    const s = this.tileSize;
    const spikeWidth = 10;
    const spikeHeight = 18;
    const baseY = py + s;

    for (let i = 0; i < 3; i++) {
      const sx = px + 1 + i * 10;

      // Dark shadow silhouette
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.moveTo(sx, baseY);
      ctx.lineTo(sx + spikeWidth / 2, baseY - spikeHeight);
      ctx.lineTo(sx + spikeWidth, baseY);
      ctx.fill();

      // Sharp Red/Magenta Hazard blade
      ctx.fillStyle = '#ff2a85';
      ctx.beginPath();
      ctx.moveTo(sx + 2, baseY);
      ctx.lineTo(sx + spikeWidth / 2, baseY - spikeHeight);
      ctx.lineTo(sx + spikeWidth - 2, baseY);
      ctx.fill();

      // Gleaming edge highlight
      ctx.fillStyle = '#fecdd3';
      ctx.beginPath();
      ctx.moveTo(sx + spikeWidth / 2, baseY - spikeHeight);
      ctx.lineTo(sx + spikeWidth / 2 + 1, baseY - spikeHeight + 10);
      ctx.lineTo(sx + spikeWidth / 2 - 1, baseY - spikeHeight + 10);
      ctx.fill();
    }
  }

  /**
   * Collectible Coin: Sparkling gold coin with rotating shimmer
   */
  drawCoinTile(ctx, px, py, animTicks) {
    const cx = px + this.tileSize / 2;
    const cy = py + this.tileSize / 2;
    const bob = Math.sin((animTicks + px) * 0.08) * 2;

    // Glowing aura
    ctx.fillStyle = 'rgba(255, 183, 3, 0.2)';
    ctx.beginPath();
    ctx.arc(cx, cy + bob, 11, 0, Math.PI * 2);
    ctx.fill();

    // Outer coin rim
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.arc(cx, cy + bob, 8, 0, Math.PI * 2);
    ctx.fill();

    // Inner bright gold core
    ctx.fillStyle = '#ffb703';
    ctx.beginPath();
    ctx.arc(cx, cy + bob, 6, 0, Math.PI * 2);
    ctx.fill();

    // Shimmer star
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(cx - 2, cy + bob - 4, 2, 4);
    ctx.fillRect(cx - 4, cy + bob - 2, 4, 2);
  }

  /**
   * Player Spawn Beacon: Neon pedestal & pennant flag
   */
  drawSpawnTile(ctx, px, py) {
    const cx = px + this.tileSize / 2;
    const baseY = py + this.tileSize - 2;

    // Pedestal glow
    ctx.fillStyle = 'rgba(0, 245, 155, 0.25)';
    ctx.fillRect(px + 4, baseY - 4, 24, 4);

    ctx.fillStyle = '#00f59b';
    ctx.fillRect(px + 6, baseY - 2, 20, 2);

    // Mast
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 2, py + 6, 3, 22);

    // Pennant Flag
    ctx.fillStyle = '#00f59b';
    ctx.beginPath();
    ctx.moveTo(cx + 1, py + 6);
    ctx.lineTo(cx + 14, py + 12);
    ctx.lineTo(cx + 1, py + 18);
    ctx.fill();

    // 'P' symbol badge
    ctx.fillStyle = '#05060a';
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillText('P', cx + 3, py + 14);
  }
}

// Global browser attachments
if (typeof window !== 'undefined') {
  window.Level = Level;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Level;
}
