/**
 * PixelQuest - Game State Manager
 * Class GameState: Tracks score, lives, coin count, particles, and renders
 * a retro HUD overlay on the canvas while synchronizing with the DOM HUD.
 */

class GameState {
  /**
   * @param {Object} [options]
   * @param {AudioSystem} [options.audio] - Audio system instance
   * @param {Function} [options.onModeChange] - Callback when mode changes
   * @param {Function} [options.onRespawn] - Callback when player respawns
   */
  constructor(options = {}) {
    this.audio = options.audio || (typeof window !== 'undefined' ? window.gameAudio : null);
    this.onModeChange = options.onModeChange || (() => {});
    this.onRespawn = options.onRespawn || (() => {});

    // Core Gameplay State
    this.score = 0;
    this.highScore = 0;
    this.lives = 3;
    this.maxLives = 3;
    this.coinsCollected = 0;
    this.totalCoins = 0;

    // Modes & Status: 'editor' | 'playing' | 'dying' | 'gameover' | 'victory'
    this.mode = 'editor';
    this.status = 'editor';

    // Timers
    this.deathTimer = 0;
    this.deathDuration = 0.85; // Seconds for death animation arc

    // Visual Particle System & Floating Labels
    this.particles = [];
    this.floatingTexts = [];

    // DOM Elements Cache for HUD Overlay
    this.hudElements = {
      score: null,
      lives: null,
      coins: null,
      modePill: null,
      audioBtn: null,
      audioIcon: null,
      gameOverScreen: null,
      gameOverScore: null,
      gameOverCoins: null,
      victoryScreen: null,
      victoryScore: null,
      victoryCoins: null,
    };

    // Load persisted high score
    this.loadHighScore();

    // Cache elements when DOM is ready
    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.initDOM());
      } else {
        this.initDOM();
      }
    }
  }

  /**
   * Loads persisted high score from localStorage
   */
  loadHighScore() {
    try {
      const saved = localStorage.getItem('pixelquest_highscore');
      this.highScore = saved ? parseInt(saved, 10) || 0 : 0;
    } catch (e) {
      this.highScore = 0;
    }
  }

  /**
   * Saves high score to localStorage if higher
   */
  checkHighScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      try {
        localStorage.setItem('pixelquest_highscore', String(this.highScore));
      } catch (e) {}
    }
  }

  /**
   * Caches HUD and modal elements from DOM
   */
  initDOM() {
    this.hudElements.score = document.getElementById('hud-score-val');
    this.hudElements.lives = document.getElementById('hud-lives-container');
    this.hudElements.coins = document.getElementById('hud-coins-val');
    this.hudElements.modePill = document.getElementById('hud-mode-pill');
    this.hudElements.audioBtn = document.getElementById('hud-audio-btn');
    this.hudElements.audioIcon = document.getElementById('hud-audio-icon');

    this.hudElements.gameOverScreen = document.getElementById('game-over-screen');
    this.hudElements.gameOverScore = document.getElementById('go-final-score');
    this.hudElements.gameOverCoins = document.getElementById('go-coins-collected');

    this.hudElements.victoryScreen = document.getElementById('victory-screen');
    this.hudElements.victoryScore = document.getElementById('vic-final-score');
    this.hudElements.victoryCoins = document.getElementById('vic-coins-collected');

    // Bind audio toggle button in retro HUD
    if (this.hudElements.audioBtn && this.audio) {
      this.hudElements.audioBtn.addEventListener('click', () => {
        const isMuted = this.audio.toggleMute();
        this.updateAudioButton(isMuted);
      });
      this.updateAudioButton(this.audio.isMuted());
    }

    this.updateHUD();
  }

  /**
   * Updates audio button icon and title in HUD
   * @param {boolean} isMuted
   */
  updateAudioButton(isMuted) {
    if (this.hudElements.audioIcon) {
      this.hudElements.audioIcon.textContent = isMuted ? '🔇' : '🔊';
    }
    if (this.hudElements.audioBtn) {
      this.hudElements.audioBtn.title = isMuted ? 'Unmute Sound (M)' : 'Mute Sound (M)';
      this.hudElements.audioBtn.classList.toggle('muted', isMuted);
    }
  }

  /**
   * Formats numbers to classic 6-digit arcade format (e.g. 000400)
   * @param {number} val
   * @returns {string}
   */
  formatScore(val) {
    return String(Math.max(0, val)).padStart(6, '0');
  }

  /**
   * Sets game mode: 'editor' or 'play'
   * @param {'editor'|'play'} newMode
   * @param {Level} level
   * @param {Player} player
   */
  setMode(newMode, level, player) {
    this.mode = newMode;
    this.hideModals();

    if (newMode === 'play') {
      this.status = 'playing';
      // Reset current play run state
      this.score = 0;
      this.lives = this.maxLives;
      this.coinsCollected = 0;
      this.deathTimer = 0;

      if (level) {
        level.createSnapshot();
        this.totalCoins = level.totalCoins;
      }

      if (player) {
        player.reset();
        player.makeInvulnerable(1.0);
      }

      if (this.audio) {
        this.audio.playRespawn();
      }
    } else {
      this.status = 'editor';
      this.deathTimer = 0;

      if (level) {
        level.restoreSnapshot();
        this.totalCoins = level.totalCoins;
        this.coinsCollected = 0;
      }

      if (player) {
        player.reset();
      }
    }

    this.updateHUD();
  }

  /**
   * Handles player collecting a coin
   * @param {number} col
   * @param {number} row
   * @param {number} x - Pixel X coordinate of coin
   * @param {number} y - Pixel Y coordinate of coin
   */
  handleCoinCollect(col, row, x, y) {
    if (this.status !== 'playing') return;

    this.coinsCollected++;
    const points = 100;
    this.score += points;
    this.checkHighScore();

    // Sound effect: two-tone chime
    if (this.audio) {
      this.audio.playCoin();
    }

    // Visual feedback: floating +100 text & sparkle particles
    this.spawnFloatingText('+100', x, y - 8, '#ffb703');
    this.spawnSparkleBurst(x, y, 12, '#ffb703');

    this.updateHUD();

    // Check Win Condition: All coins collected
    if (this.totalCoins > 0 && this.coinsCollected >= this.totalCoins) {
      this.triggerVictory();
    }
  }

  /**
   * Handles player colliding with a hazard (spike)
   * @param {Player} player
   * @param {number} hazardX
   * @param {number} hazardY
   */
  handleHazardCollision(player, hazardX, hazardY) {
    if (this.status !== 'playing' || !player || player.isDying || player.isInvulnerable) {
      return;
    }

    // Sound effect: aggressive 8-bit noise blast
    if (this.audio) {
      this.audio.playDeath();
    }

    // Trigger player death animation
    player.die();

    // Visual feedback: explosion debris & floating hit indicator
    this.spawnDeathBurst(player.x + 16, player.y + 16, 24);
    this.spawnFloatingText('-1 LIFE', player.x + 16, player.y - 12, '#ff2a85');

    // Decrement player lives
    this.lives = Math.max(0, this.lives - 1);
    this.status = 'dying';
    this.deathTimer = this.deathDuration;

    this.updateHUD();
  }

  /**
   * Respawns player at level spawn anchor after death animation
   * @param {Player} player
   * @param {Level} level
   */
  respawnPlayer(player, level) {
    if (!player || !level) return;

    const spawnX = level.spawnPoint.col * level.tileSize;
    const spawnY = level.spawnPoint.row * level.tileSize;

    player.reset(spawnX, spawnY);
    player.makeInvulnerable(1.6); // 1.6s invulnerability flicker

    this.status = 'playing';
    this.deathTimer = 0;

    // Sound effect: respawn warp chime
    if (this.audio) {
      this.audio.playRespawn();
    }

    this.spawnSparkleBurst(spawnX + 16, spawnY + 16, 16, '#00f59b');
    this.spawnFloatingText('RESPAWNED!', spawnX + 16, spawnY - 14, '#00f59b');

    this.updateHUD();

    if (this.onRespawn) {
      this.onRespawn(spawnX, spawnY);
    }
  }

  /**
   * Triggers Game Over state when lives reach 0
   */
  triggerGameOver() {
    this.status = 'gameover';
    this.checkHighScore();

    if (this.audio) {
      this.audio.playGameOver();
    }

    this.updateHUD();
    this.showGameOverModal();
  }

  /**
   * Triggers Level Complete / Victory when all coins are collected
   */
  triggerVictory() {
    this.status = 'victory';

    // Level completion bonus
    const completionBonus = 500;
    this.score += completionBonus;
    this.checkHighScore();

    if (this.audio) {
      this.audio.playVictory();
    }

    this.spawnFloatingText('VICTORY! +500', 400, 200, '#00f0ff', 24);
    this.spawnConfettiBurst(400, 160, 40);

    this.updateHUD();
    this.showVictoryModal();
  }

  /**
   * Restarts current level run with full lives and restored coins
   * @param {Level} level
   * @param {Player} player
   */
  retryLevel(level, player) {
    this.hideModals();
    this.score = 0;
    this.lives = this.maxLives;
    this.coinsCollected = 0;
    this.deathTimer = 0;
    this.status = 'playing';
    this.mode = 'play';

    if (level) {
      level.restoreSnapshot();
      this.totalCoins = level.totalCoins;
    }

    if (player && level) {
      const spawnX = level.spawnPoint.col * level.tileSize;
      const spawnY = level.spawnPoint.row * level.tileSize;
      player.reset(spawnX, spawnY);
      player.makeInvulnerable(1.2);
    }

    if (this.audio) {
      this.audio.playRespawn();
    }

    this.updateHUD();
  }

  /**
   * Displays Game Over modal overlay
   */
  showGameOverModal() {
    if (this.hudElements.gameOverScreen) {
      if (this.hudElements.gameOverScore) {
        this.hudElements.gameOverScore.textContent = this.formatScore(this.score);
      }
      if (this.hudElements.gameOverCoins) {
        this.hudElements.gameOverCoins.textContent = `${this.coinsCollected} / ${this.totalCoins}`;
      }
      this.hudElements.gameOverScreen.style.display = 'flex';
      this.hudElements.gameOverScreen.classList.add('visible');
    }
  }

  /**
   * Displays Victory modal overlay
   */
  showVictoryModal() {
    if (this.hudElements.victoryScreen) {
      if (this.hudElements.victoryScore) {
        this.hudElements.victoryScore.textContent = this.formatScore(this.score);
      }
      if (this.hudElements.victoryCoins) {
        this.hudElements.victoryCoins.textContent = `${this.coinsCollected} / ${this.totalCoins}`;
      }
      this.hudElements.victoryScreen.style.display = 'flex';
      this.hudElements.victoryScreen.classList.add('visible');
    }
  }

  /**
   * Hides all overlay modal dialogs
   */
  hideModals() {
    if (this.hudElements.gameOverScreen) {
      this.hudElements.gameOverScreen.style.display = 'none';
      this.hudElements.gameOverScreen.classList.remove('visible');
    }
    if (this.hudElements.victoryScreen) {
      this.hudElements.victoryScreen.style.display = 'none';
      this.hudElements.victoryScreen.classList.remove('visible');
    }
  }

  /**
   * Real-time update pass for timers, particles, and floating text
   * @param {number} dt - Delta time in seconds
   * @param {Player} player
   * @param {Level} level
   */
  update(dt, player, level) {
    // 1. Handle death timer countdown
    if (this.status === 'dying') {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) {
        if (this.lives > 0) {
          this.respawnPlayer(player, level);
        } else {
          this.triggerGameOver();
        }
      }
    }

    // 2. Update visual particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.gravity ?? 600) * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // 3. Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const t = this.floatingTexts[i];
      t.y += t.vy * dt;
      t.life -= dt;
      t.alpha = Math.max(0, t.life / t.maxLife);
      if (t.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  /**
   * Spawns sparkle burst for coin collection and warp effects
   */
  spawnSparkleBurst(x, y, count = 12, color = '#ffb703') {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 70 + Math.random() * 120;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        gravity: 250,
        size: 2 + Math.floor(Math.random() * 3),
        color,
        life: 0.45 + Math.random() * 0.35,
      });
    }
  }

  /**
   * Spawns multi-colored pixel burst on player death
   */
  spawnDeathBurst(x, y, count = 24) {
    const colors = ['#ff2a85', '#00f0ff', '#00f59b', '#ffffff', '#fbbf24'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 90 + Math.random() * 180;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        gravity: 650,
        size: 3 + Math.floor(Math.random() * 3),
        color: colors[i % colors.length],
        life: 0.6 + Math.random() * 0.4,
      });
    }
  }

  /**
   * Spawns celebratory victory confetti
   */
  spawnConfettiBurst(x, y, count = 40) {
    const colors = ['#00f0ff', '#ffb703', '#ff2a85', '#00f59b', '#ffffff'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 260;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 80,
        y: y + (Math.random() - 0.5) * 40,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 120,
        gravity: 400,
        size: 4 + Math.floor(Math.random() * 4),
        color: colors[i % colors.length],
        life: 1.0 + Math.random() * 0.8,
      });
    }
  }

  /**
   * Spawns floating animated score/status text
   */
  spawnFloatingText(text, x, y, color = '#ffffff', fontSize = 12) {
    this.floatingTexts.push({
      text,
      x,
      y,
      vy: -55, // Floats upward
      color,
      fontSize,
      life: 0.85,
      maxLife: 0.85,
      alpha: 1.0,
    });
  }

  /**
   * Renders visual particles, floating score labels, and retro canvas HUD overlay
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    // 1. Draw Particles
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }

    // 2. Draw Floating Texts
    for (let i = 0; i < this.floatingTexts.length; i++) {
      const t = this.floatingTexts[i];
      ctx.save();
      ctx.globalAlpha = t.alpha;
      ctx.font = `${t.fontSize}px "Press Start 2P", monospace`;
      ctx.textAlign = 'center';

      // Drop shadow for contrast
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillText(t.text, Math.round(t.x) + 1, Math.round(t.y) + 1);

      // Foreground text
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, Math.round(t.x), Math.round(t.y));
      ctx.restore();
    }
  }

  /**
   * Updates all retro HUD overlay indicators (Score, Lives, Coins, Mode)
   */
  updateHUD() {
    // 1. Score Counter
    if (this.hudElements.score) {
      this.hudElements.score.textContent = this.formatScore(this.score);
    }

    // 2. Lives with Retro Pixel Hearts
    if (this.hudElements.lives) {
      let heartsHtml = '';
      for (let i = 0; i < this.maxLives; i++) {
        const isAlive = i < this.lives;
        heartsHtml += `<span class="heart-icon ${isAlive ? 'active' : 'lost'}" title="${isAlive ? 'Life active' : 'Life lost'}">${isAlive ? '❤️' : '🖤'}</span>`;
      }
      this.hudElements.lives.innerHTML = heartsHtml;
      this.hudElements.lives.setAttribute('aria-label', `${this.lives} of ${this.maxLives} Lives`);
    }

    // 3. Coins Counter
    if (this.hudElements.coins) {
      this.hudElements.coins.textContent = `${this.coinsCollected}/${this.totalCoins}`;
    }

    // 4. Mode Status Badge
    if (this.hudElements.modePill) {
      if (this.status === 'gameover') {
        this.hudElements.modePill.textContent = 'GAME OVER';
        this.hudElements.modePill.className = 'hud-mode-pill status-gameover';
      } else if (this.status === 'victory') {
        this.hudElements.modePill.textContent = 'VICTORY!';
        this.hudElements.modePill.className = 'hud-mode-pill status-victory';
      } else if (this.mode === 'play') {
        this.hudElements.modePill.textContent = 'PLAY MODE';
        this.hudElements.modePill.className = 'hud-mode-pill status-play';
      } else {
        this.hudElements.modePill.textContent = 'EDITOR MODE';
        this.hudElements.modePill.className = 'hud-mode-pill status-editor';
      }
    }
  }
}

// Global browser attachments
if (typeof window !== 'undefined') {
  window.GameState = GameState;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GameState;
}
