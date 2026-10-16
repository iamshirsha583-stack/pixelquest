/**
 * PixelQuest - Player Entity
 * Class Player: Position, velocity, jump logic, gravity application, movement updates,
 * and retro 32x32 pixel-art drawing logic with reset(x, y) spawn restore.
 */

class Player {
  /**
   * @param {number} [x=64] - Initial horizontal coordinate
   * @param {number} [y=384] - Initial vertical coordinate
   */
  constructor(x = 64, y = 384) {
    // Spatial dimensions (32x32 px standard retro tile match)
    this.x = x;
    this.y = y;
    this.width = 32;
    this.height = 32;

    // Movement & Physics
    this.vx = 0;
    this.vy = 0;
    this.speed = 190; // Pixels per second
    this.jumpForce = -470; // Instant upward impulse
    this.gravity = 1100; // Downward gravity acceleration (px/s^2)
    this.terminalVelocity = 620; // Terminal fall velocity
    this.isGrounded = false;

    // State & Animation
    this.facing = 'right'; // 'left' | 'right'
    this.alive = true;
    this.isDying = false;
    this.deathTimer = 0;
    this.isInvulnerable = false;
    this.invulnerableTimer = 0;
    this.animTimer = 0;
    this.spawnPoint = { x, y };

    // Jump audio callback hook
    this.onJump = null;
  }

  /**
   * Updates player physics, inputs, and animation state
   * @param {number} dt - Delta time in seconds
   * @param {Object} [input] - Input manager instance
   */
  update(dt, input = null) {
    if (!this.alive) return;

    // Handle death animation arc
    if (this.isDying) {
      this.deathTimer -= dt;
      this.vy += this.gravity * 0.9 * dt;
      this.y += this.vy * dt;
      if (this.deathTimer <= 0) {
        this.deathTimer = 0;
        this.isDying = false;
      }
      return;
    }

    // Update invulnerability blink timer after respawn
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
      if (this.invulnerableTimer <= 0) {
        this.invulnerableTimer = 0;
        this.isInvulnerable = false;
      }
    }

    // 1. Process Horizontal Movement Input
    if (input) {
      const axis = typeof input.getHorizontalAxis === 'function'
        ? input.getHorizontalAxis()
        : 0;

      if (axis !== 0) {
        this.vx = axis * this.speed;
        this.facing = axis > 0 ? 'right' : 'left';
        this.animTimer += dt;
      } else {
        this.vx = 0;
      }

      // Check jump input
      if (typeof input.isJump === 'function' && input.isJump()) {
        this.jump();
      }
    }

    // 2. Apply Gravity Acceleration
    this.vy += this.gravity * dt;
    if (this.vy > this.terminalVelocity) {
      this.vy = this.terminalVelocity;
    }

    // 3. Integrate Velocity into Position
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Reset grounded flag; confirmed by collision resolution
    this.isGrounded = false;
  }

  /**
   * Executes a jump if player is grounded
   * @returns {boolean} Whether the jump occurred
   */
  jump() {
    if (this.isGrounded && !this.isDying) {
      this.vy = this.jumpForce;
      this.isGrounded = false;
      if (typeof this.onJump === 'function') {
        this.onJump();
      }
      return true;
    }
    return false;
  }

  /**
   * Triggers the player death animation pop
   */
  die() {
    this.isDying = true;
    this.deathTimer = 0.8;
    this.vy = -340; // Arcade pop upward
    this.vx = 0;
    this.isGrounded = false;
  }

  /**
   * Grants temporary invulnerability after respawn
   * @param {number} [duration=1.5] - Duration in seconds
   */
  makeInvulnerable(duration = 1.5) {
    this.isInvulnerable = true;
    this.invulnerableTimer = duration;
  }

  /**
   * Restores player spawn positions and resets kinematic state
   * @param {number} [x]
   * @param {number} [y]
   */
  reset(x = this.spawnPoint.x, y = this.spawnPoint.y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.isGrounded = false;
    this.alive = true;
    this.isDying = false;
    this.deathTimer = 0;
    this.isInvulnerable = false;
    this.invulnerableTimer = 0;
    this.animTimer = 0;
  }

  /**
   * Sets new spawn anchor coordinate
   * @param {number} x
   * @param {number} y
   */
  setSpawnPoint(x, y) {
    this.spawnPoint = { x, y };
  }

  /**
   * Renders the retro pixel character with distinct face and cyber attire
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    // Invulnerability blink effect
    if (this.isInvulnerable && !this.isDying) {
      if (Math.floor(Date.now() / 90) % 2 === 0) {
        return; // Blink invisible
      }
    }

    const px = Math.round(this.x);
    const py = Math.round(this.y);

    ctx.save();

    // Death animation: spin and tumble
    if (this.isDying) {
      const centerX = px + this.width / 2;
      const centerY = py + this.height / 2;
      ctx.translate(centerX, centerY);
      ctx.rotate((0.8 - this.deathTimer) * 12);
      ctx.translate(-this.width / 2, -this.height / 2);
    } else if (this.facing === 'left') {
      // Mirror horizontally if facing left
      ctx.translate(px + this.width, py);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(px, py);
    }

    // Walking animation bob calculation
    const isMoving = Math.abs(this.vx) > 10 && this.isGrounded;
    const walkBob = isMoving ? Math.sin(this.animTimer * 14) * 2 : 0;
    const legOffset = isMoving ? Math.sin(this.animTimer * 14) * 4 : 0;

    // 1. Soft Ground Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(4, 30, 24, 2);

    // 2. Midnight Violet Cape
    ctx.fillStyle = '#4c1d95';
    ctx.fillRect(4, 12 + walkBob, 6, 12);
    ctx.fillStyle = '#6d28d9';
    ctx.fillRect(5, 13 + walkBob, 4, 10);

    // 3. Cyber Armor Body (Neon Emerald & Slate)
    ctx.fillStyle = '#0f172a'; // Under-suit
    ctx.fillRect(8, 12 + walkBob, 16, 12);

    ctx.fillStyle = '#059669'; // Emerald breastplate
    ctx.fillRect(10, 13 + walkBob, 12, 9);

    // Glowing Power Core Amulet (Cyan)
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(14, 15 + walkBob, 4, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(15, 16 + walkBob, 2, 2);

    // Golden Belt & Buckle
    ctx.fillStyle = '#b45309';
    ctx.fillRect(8, 22 + walkBob, 16, 2);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(14, 21 + walkBob, 4, 4);

    // 4. Arms & Gauntlets
    ctx.fillStyle = '#047857';
    ctx.fillRect(6, 14 + walkBob, 3, 6); // Left arm
    ctx.fillRect(23, 14 + walkBob, 3, 6); // Right arm
    ctx.fillStyle = '#00f59b';
    ctx.fillRect(6, 18 + walkBob, 3, 3); // Gauntlet
    ctx.fillRect(23, 18 + walkBob, 3, 3);

    // 5. Head & Helmet (Obsidian with Neon Cyan Visor Headband)
    ctx.fillStyle = '#1e293b'; // Helmet crown
    ctx.fillRect(8, 2 + walkBob, 16, 4);
    ctx.fillRect(6, 4 + walkBob, 20, 3);

    // Glowing Neon Cyan Headband
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(6, 6 + walkBob, 20, 2);

    // 6. Distinct Face (Warm Skin, Expressive Eyes & Smile)
    ctx.fillStyle = '#fed7aa'; // Face skin
    ctx.fillRect(8, 8 + walkBob, 16, 6);

    // Cute Cheeks Blush
    ctx.fillStyle = '#fca5a5';
    ctx.fillRect(9, 11 + walkBob, 2, 1);
    ctx.fillRect(21, 11 + walkBob, 2, 1);

    // Expressive Pixel Eyes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(12, 9 + walkBob, 3, 3); // Left eye
    ctx.fillRect(18, 9 + walkBob, 3, 3); // Right eye

    ctx.fillStyle = '#0f172a'; // Pupils
    ctx.fillRect(13, 9 + walkBob, 2, 2);
    ctx.fillRect(19, 9 + walkBob, 2, 2);

    // Hero Smile
    ctx.fillStyle = '#9a3412';
    ctx.fillRect(15, 12 + walkBob, 3, 1);

    // 7. Legs & High-Top Boots
    if (!this.isGrounded) {
      // Airborne Jump Pose (Legs tucked)
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(9, 24, 5, 4);
      ctx.fillRect(18, 24, 5, 4);

      ctx.fillStyle = '#00f59b';
      ctx.fillRect(8, 27, 6, 4);
      ctx.fillRect(18, 26, 6, 4);
    } else {
      // Grounded Walk / Idle Pose
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(9, 24, 5, 4 + legOffset); // Left leg
      ctx.fillRect(18, 24, 5, 4 - legOffset); // Right leg

      // Neon High-Top Boots
      ctx.fillStyle = '#00f59b';
      ctx.fillRect(8, 27 + legOffset, 6, 4);
      ctx.fillRect(18, 27 - legOffset, 6, 4);

      // Boot Sole Highlight
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(9, 29 + legOffset, 4, 1);
      ctx.fillRect(19, 29 - legOffset, 4, 1);
    }

    // Hazard hit flash effect when dying
    if (this.isDying) {
      ctx.fillStyle = 'rgba(255, 42, 133, 0.45)';
      ctx.fillRect(2, 2, 28, 28);
    }

    ctx.restore();
  }
}

// Global browser attachments
if (typeof window !== 'undefined') {
  window.Player = Player;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Player;
}
