/**
 * PixelQuest - Physics & Collision Engine
 * Class PhysicsEngine: Implements Axis-Aligned Bounding Box (AABB) collision detection
 * and overlap resolution against screen boundaries and grid tiles.
 */

class PhysicsEngine {
  /**
   * Tests whether two axis-aligned bounding boxes overlap
   * @param {{x: number, y: number, width: number, height: number}} a
   * @param {{x: number, y: number, width: number, height: number}} b
   * @returns {boolean}
   */
  static checkAABB(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  /**
   * Calculates horizontal and vertical overlap depths between two rectangles
   * @param {{x: number, y: number, width: number, height: number}} a
   * @param {{x: number, y: number, width: number, height: number}} b
   * @returns {{overlapX: number, overlapY: number}}
   */
  static getOverlap(a, b) {
    if (!this.checkAABB(a, b)) {
      return { overlapX: 0, overlapY: 0 };
    }

    const overlapX = Math.min(a.x + a.width - b.x, b.x + b.width - a.x);
    const overlapY = Math.min(a.y + a.height - b.y, b.y + b.height - a.y);

    return { overlapX, overlapY };
  }

  /**
   * Resolves collision overlap between a moving entity and a static obstacle
   * @param {Object} entity - Dynamic entity with x, y, width, height, vx, vy, isGrounded
   * @param {{x: number, y: number, width: number, height: number}} obstacle - Static solid rectangle
   * @returns {boolean} Whether a collision resolution occurred
   */
  static resolveAABB(entity, obstacle) {
    const { overlapX, overlapY } = this.getOverlap(entity, obstacle);
    if (overlapX <= 0 || overlapY <= 0) return false;

    // Resolve along the axis with the smallest penetration depth
    if (overlapX < overlapY) {
      // Horizontal collision (Wall)
      if (entity.x < obstacle.x) {
        // Collided with left face of obstacle (moving right)
        entity.x -= overlapX;
        if (entity.vx > 0) entity.vx = 0;
      } else {
        // Collided with right face of obstacle (moving left)
        entity.x += overlapX;
        if (entity.vx < 0) entity.vx = 0;
      }
    } else {
      // Vertical collision (Floor or Ceiling)
      if (entity.y < obstacle.y) {
        // Collided with top surface of obstacle (landing on floor)
        entity.y -= overlapY;
        if (entity.vy > 0) {
          entity.vy = 0;
          entity.isGrounded = true;
        }
      } else {
        // Collided with bottom surface of obstacle (head hitting ceiling)
        entity.y += overlapY;
        if (entity.vy < 0) entity.vy = 0;
      }
    }

    return true;
  }

  /**
   * Resolves collision against one-way / jump-through platform
   * @param {Object} entity - Dynamic entity
   * @param {{x: number, y: number, width: number, height: number}} platform - Semi-solid platform
   * @returns {boolean}
   */
  static resolvePlatform(entity, platform) {
    // Only collide when moving downwards and entity was previously above platform
    if (entity.vy <= 0) return false;

    const previousBottom = entity.y + entity.height - entity.vy;
    const platformTop = platform.y;

    if (
      previousBottom <= platformTop + 10 &&
      entity.y + entity.height >= platformTop &&
      entity.x + entity.width > platform.x &&
      entity.x < platform.x + platform.width
    ) {
      entity.y = platformTop - entity.height;
      entity.vy = 0;
      entity.isGrounded = true;
      return true;
    }

    return false;
  }

  /**
   * Clamps an entity within screen boundary limits
   * @param {Object} entity - Dynamic entity (x, y, width, height, vx, vy, isGrounded)
   * @param {{x: number, y: number, width: number, height: number}} bounds - Boundary box (e.g. 800x480)
   * @returns {{hitLeft: boolean, hitRight: boolean, hitTop: boolean, hitBottom: boolean}}
   */
  static resolveBoundaries(entity, bounds = { x: 0, y: 0, width: 800, height: 480 }) {
    const collisions = {
      hitLeft: false,
      hitRight: false,
      hitTop: false,
      hitBottom: false,
    };

    // Left screen wall
    if (entity.x < bounds.x) {
      entity.x = bounds.x;
      if (entity.vx < 0) entity.vx = 0;
      collisions.hitLeft = true;
    }

    // Right screen wall
    const maxRight = bounds.x + bounds.width - entity.width;
    if (entity.x > maxRight) {
      entity.x = maxRight;
      if (entity.vx > 0) entity.vx = 0;
      collisions.hitRight = true;
    }

    // Ceiling boundary
    if (entity.y < bounds.y) {
      entity.y = bounds.y;
      if (entity.vy < 0) entity.vy = 0;
      collisions.hitTop = true;
    }

    // Floor boundary
    const maxBottom = bounds.y + bounds.height - entity.height;
    if (entity.y >= maxBottom) {
      entity.y = maxBottom;
      if (entity.vy > 0) {
        entity.vy = 0;
        entity.isGrounded = true;
      }
      collisions.hitBottom = true;
    }

    return collisions;
  }

  /**
   * Resolves entity collisions against all relevant grid tiles in a level
   * @param {Object} entity
   * @param {Object} level
   * @returns {{coinCollected: boolean, hitHazard: boolean, coinCol: number, coinRow: number, coinX: number, coinY: number, hazardX: number, hazardY: number}}
   */
  static resolveTileCollisions(entity, level) {
    if (typeof level.resolveCollisions === 'function') {
      return level.resolveCollisions(entity, this);
    }
    return {
      coinCollected: false,
      hitHazard: false,
      coinCol: -1,
      coinRow: -1,
      coinX: 0,
      coinY: 0,
      hazardX: 0,
      hazardY: 0,
    };
  }
}

// Global browser attachments
if (typeof window !== 'undefined') {
  window.PhysicsEngine = PhysicsEngine;
  window.Physics = PhysicsEngine;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PhysicsEngine;
}
