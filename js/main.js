/**
 * PixelQuest - 2D Pixel-Art Platformer & Level Editor
 * Main Application Orchestrator
 * Connects AudioSystem, InputHandler, PhysicsEngine, Player, Level, Editor, GameState, and Engine.
 */

(() => {
  'use strict';

  // --- Dimensions & Constants ---
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 480;
  const TILE_SIZE = 32;
  const COLS = CANVAS_WIDTH / TILE_SIZE; // 25
  const ROWS = CANVAS_HEIGHT / TILE_SIZE; // 15

  // --- Subsystem State Reference ---
  const state = {
    mode: 'editor', // 'editor' | 'play'
    audio: null,
    input: null,
    physics: null,
    level: null,
    player: null,
    editor: null,
    gameState: null,
    engine: null,
  };

  // --- Cached DOM Elements ---
  const elements = {
    canvas: document.getElementById('game-canvas'),
    canvasWrapper: document.querySelector('.canvas-wrapper'),
    ctx: null,

    // Header Mode Elements
    modeBadge: document.getElementById('mode-badge'),
    modeText: document.getElementById('mode-text'),

    // Sidebar Controls
    btnModeEditor: document.getElementById('btn-mode-editor'),
    btnModePlay: document.getElementById('btn-mode-play'),
    toolButtons: document.querySelectorAll('.tile-tool-btn'),
    toggleGrid: document.getElementById('toggle-grid'),

    // Level Action Buttons
    btnResetLevel: document.getElementById('btn-reset-level'),
    btnExportJson: document.getElementById('btn-export-json'),
    btnImportTrigger: document.getElementById('btn-import-trigger'),
    importFileInput: document.getElementById('import-file-input'),
    btnClearCanvas: document.getElementById('btn-clear-canvas'),
    btnDemoLevel: document.getElementById('btn-demo-level'),

    // Top HUD Elements
    hudCoords: document.getElementById('hud-coordinates'),
    hudActiveTool: document.getElementById('hud-active-tool'),
    hudFps: document.getElementById('hud-fps'),

    // Status Summary & Toast
    statusSummary: document.getElementById('status-summary'),
    gameToast: document.getElementById('game-toast'),

    // Modals
    gameOverScreen: document.getElementById('game-over-screen'),
    btnGoRetry: document.getElementById('btn-go-retry'),
    btnGoEditor: document.getElementById('btn-go-editor'),

    victoryScreen: document.getElementById('victory-screen'),
    btnVicReplay: document.getElementById('btn-vic-replay'),
    btnVicEditor: document.getElementById('btn-vic-editor'),
  };

  /**
   * Resets player position and velocities to current level spawn anchor
   */
  function resetPlayerToSpawn() {
    if (!state.player || !state.level) return;
    const spawnX = state.level.spawnPoint.col * TILE_SIZE;
    const spawnY = state.level.spawnPoint.row * TILE_SIZE;
    state.player.reset(spawnX, spawnY);
    state.player.setSpawnPoint(spawnX, spawnY);
  }

  /**
   * Displays an interactive notification toast
   * @param {string} message
   * @param {'info'|'success'|'danger'} [type='info']
   */
  let toastTimeout = null;
  function showToast(message, type = 'info') {
    if (!elements.gameToast) return;
    elements.gameToast.textContent = message;
    elements.gameToast.className = `game-toast visible ${type}`;
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      elements.gameToast.className = 'game-toast';
    }, 2500);
  }

  /**
   * Toggles game mode between 'editor' and 'play'
   * @param {'editor'|'play'} mode
   */
  function setMode(mode) {
    if (state.mode === mode) return;
    state.mode = mode;

    if (mode === 'play') {
      if (elements.btnModePlay) elements.btnModePlay.classList.add('active');
      if (elements.btnModeEditor) elements.btnModeEditor.classList.remove('active');
      if (elements.modeBadge) elements.modeBadge.classList.add('play-active');
      if (elements.modeText) elements.modeText.textContent = 'PLAY MODE';
      if (elements.statusSummary) {
        elements.statusSummary.textContent = 'Play Mode: [A/D / ←/→] Move, [Space/W] Jump, [M] Mute, [R] Retry. Collect all coins!';
      }

      // Disable editor painting interactions
      if (state.editor) state.editor.disable();

      // Synchronize GameState
      if (state.gameState) {
        state.gameState.setMode('play', state.level, state.player);
      } else {
        resetPlayerToSpawn();
      }

      showToast('Switched to Play Mode! (Tab to edit)', 'success');
    } else {
      if (elements.btnModeEditor) elements.btnModeEditor.classList.add('active');
      if (elements.btnModePlay) elements.btnModePlay.classList.remove('active');
      if (elements.modeBadge) elements.modeBadge.classList.remove('play-active');
      if (elements.modeText) elements.modeText.textContent = 'EDITOR MODE';
      if (elements.statusSummary) {
        elements.statusSummary.textContent = 'Editor: Left click paints, right click erases. Select tools from the left palette.';
      }

      // Enable editor interactions
      if (state.editor) state.editor.enable();

      // Synchronize GameState
      if (state.gameState) {
        state.gameState.setMode('editor', state.level, state.player);
      } else {
        resetPlayerToSpawn();
      }

      showToast('Switched to Level Editor (Tab to play)', 'info');
    }
  }

  /**
   * Toggles between editor and play mode
   */
  function toggleMode() {
    setMode(state.mode === 'editor' ? 'play' : 'editor');
  }

  /**
   * Sets the active painting tool in the editor and UI palette
   * @param {string} toolId
   */
  function setActiveTool(toolId) {
    if (state.editor) state.editor.setActiveTool(toolId);

    elements.toolButtons.forEach(btn => {
      const isSelected = btn.getAttribute('data-tool') === toolId;
      btn.classList.toggle('active', isSelected);
      btn.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    });

    const tileId = Editor.TOOL_MAP[toolId] ?? Level.TILES.GROUND;
    if (elements.hudActiveTool) {
      elements.hudActiveTool.textContent = `Tool: ${Level.TILE_NAMES[tileId] || toolId}`;
    }
  }

  /**
   * Exports the current level to a downloadable JSON file
   */
  function exportLevelJSON() {
    if (!state.level) return;
    const jsonString = state.level.exportToJSON();
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `pixelquest-level-${Date.now()}.json`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);

    if (state.audio) {
      state.audio.playBlip();
    }
    showToast('Level exported to JSON successfully! 💾', 'success');
  }

  /**
   * Imports a .json file into the level and switches immediately to Play Mode
   * @param {File} file
   */
  function handleImportFile(file) {
    if (!file || !state.level) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
      showToast('Please select a valid .json level file', 'danger');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const ok = state.level.loadFromJSON(event.target.result);
        if (ok) {
          // Switch immediately to play mode
          setMode('play');

          if (state.gameState) {
            state.gameState.retryLevel(state.level, state.player);
          } else {
            resetPlayerToSpawn();
          }

          if (state.audio) {
            state.audio.playRespawn();
          }

          showToast('Level JSON imported! Playing now! 🎮', 'success');
        } else {
          showToast('Failed to load level JSON: Invalid grid structure', 'danger');
        }
      } catch (err) {
        console.error('Import parse error:', err);
        showToast('Error parsing level JSON file', 'danger');
      }
    };
    reader.readAsText(file);
  }

  /**
   * Configures canvas drag & drop for instant JSON level upload
   */
  function setupDragAndDrop() {
    const target = elements.canvasWrapper || elements.canvas;
    if (!target) return;

    ['dragenter', 'dragover'].forEach(name => {
      target.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        target.classList.add('drag-active');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      target.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        target.classList.remove('drag-active');
      });
    });

    target.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleImportFile(e.dataTransfer.files[0]);
      }
    });
  }

  /**
   * Global keyboard hotkeys:
   * Tab (mode switch), 1-6 (tool select), G (grid toggle), M (mute), R (retry)
   */
  function setupKeyboardListeners() {
    window.addEventListener('keydown', (e) => {
      // Ignore keystrokes when typing into standard input fields
      if (e.target && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') return;

      // Modal Space / Enter retry shortcuts
      if (state.gameState && (state.gameState.status === 'gameover' || state.gameState.status === 'victory')) {
        if (e.code === 'Space' || e.key === 'Enter') {
          e.preventDefault();
          state.gameState.retryLevel(state.level, state.player);
          return;
        }
      }

      // Hotkey: Tab (mode switch)
      if (e.key === 'Tab') {
        e.preventDefault();
        if (state.audio) state.audio.playBlip();
        toggleMode();
        return;
      }

      // Hotkey: M for mute toggle
      if (e.key.toLowerCase() === 'm') {
        if (state.audio) {
          const isMuted = state.audio.toggleMute();
          if (state.gameState) state.gameState.updateAudioButton(isMuted);
          showToast(`Audio: ${isMuted ? 'MUTED 🔇' : 'ACTIVE 🔊'}`, 'info');
        }
        return;
      }

      // Hotkey: G for grid toggle
      if (e.key.toLowerCase() === 'g') {
        if (state.editor) {
          const visible = state.editor.toggleGrid();
          if (elements.toggleGrid) elements.toggleGrid.checked = visible;
          if (state.audio) state.audio.playBlip();
          showToast(`Grid lines: ${visible ? 'ON' : 'OFF'}`, 'info');
        }
        return;
      }

      // Hotkey: R for quick level retry (Play mode)
      if (e.key.toLowerCase() === 'r') {
        if (state.mode === 'play' && state.gameState) {
          state.gameState.retryLevel(state.level, state.player);
          showToast('Level restarted!', 'info');
        }
        return;
      }

      // Hotkeys: 1-6 for tool selection
      const toolKeyMap = {
        '1': 'ground',
        '2': 'platform',
        '3': 'spike',
        '4': 'coin',
        '5': 'player',
        '6': 'eraser',
      };

      if (toolKeyMap[e.key]) {
        setActiveTool(toolKeyMap[e.key]);
        if (state.audio) state.audio.playBlip();
      }
    });
  }

  /**
   * Initializes UI element event listeners
   */
  function initUIListeners() {
    // 1. Top Mode Badge toggle (Play/Edit)
    if (elements.modeBadge) {
      elements.modeBadge.addEventListener('click', () => {
        if (state.audio) state.audio.playBlip();
        toggleMode();
      });
      elements.modeBadge.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (state.audio) state.audio.playBlip();
          toggleMode();
        }
      });
    }

    // Sidebar Mode Buttons
    if (elements.btnModeEditor) {
      elements.btnModeEditor.addEventListener('click', () => {
        if (state.audio) state.audio.playBlip();
        setMode('editor');
      });
    }

    if (elements.btnModePlay) {
      elements.btnModePlay.addEventListener('click', () => {
        if (state.audio) state.audio.playBlip();
        setMode('play');
      });
    }

    // 2. Tile Tool Buttons (1-6)
    elements.toolButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.getAttribute('data-tool');
        setActiveTool(tool);
        if (state.audio) state.audio.playBlip();
      });
    });

    // 3. Grid Toggle Checkbox
    if (elements.toggleGrid) {
      elements.toggleGrid.addEventListener('change', (e) => {
        if (state.editor) state.editor.toggleGrid(e.target.checked);
        if (state.audio) state.audio.playBlip();
      });
    }

    // 4. Reset Level Button
    if (elements.btnResetLevel) {
      elements.btnResetLevel.addEventListener('click', () => {
        if (confirm('Reset level to default platformer layout? Any custom edits will be replaced.')) {
          state.level.loadPreset();
          resetPlayerToSpawn();
          if (state.gameState) state.gameState.setMode(state.mode, state.level, state.player);
          showToast('Level reset to default layout', 'danger');
        }
      });
    }

    // 5. Clear Grid Button
    if (elements.btnClearCanvas) {
      elements.btnClearCanvas.addEventListener('click', () => {
        if (confirm('Clear entire grid?')) {
          state.level.clear();
          resetPlayerToSpawn();
          if (state.gameState) state.gameState.setMode(state.mode, state.level, state.player);
          showToast('Grid cleared', 'info');
        }
      });
    }

    // 6. Demo Level Preset Button
    if (elements.btnDemoLevel) {
      elements.btnDemoLevel.addEventListener('click', () => {
        state.level.loadPreset();
        resetPlayerToSpawn();
        if (state.gameState) state.gameState.setMode(state.mode, state.level, state.player);
        showToast('Loaded demo level preset', 'info');
      });
    }

    // 7. Export JSON Button
    if (elements.btnExportJson) {
      elements.btnExportJson.addEventListener('click', exportLevelJSON);
    }

    // 8. Import JSON Trigger & File Reader
    if (elements.btnImportTrigger && elements.importFileInput) {
      elements.btnImportTrigger.addEventListener('click', () => {
        if (state.audio) state.audio.playBlip();
        elements.importFileInput.click();
      });

      elements.importFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          handleImportFile(e.target.files[0]);
          e.target.value = ''; // Reset input to allow re-selecting same file
        }
      });
    }

    // 9. Modal Action Buttons (Game Over & Victory)
    if (elements.btnGoRetry) {
      elements.btnGoRetry.addEventListener('click', () => {
        if (state.gameState) state.gameState.retryLevel(state.level, state.player);
      });
    }

    if (elements.btnGoEditor) {
      elements.btnGoEditor.addEventListener('click', () => {
        setMode('editor');
      });
    }

    if (elements.btnVicReplay) {
      elements.btnVicReplay.addEventListener('click', () => {
        if (state.gameState) state.gameState.retryLevel(state.level, state.player);
      });
    }

    if (elements.btnVicEditor) {
      elements.btnVicEditor.addEventListener('click', () => {
        setMode('editor');
      });
    }

    setupDragAndDrop();
    setupKeyboardListeners();
  }

  // =========================================================================
  // Game Loop: Update & Render
  // =========================================================================

  /**
   * Physics, GameState, and Entities update pass
   * @param {number} dt - Delta time in seconds
   */
  function update(dt) {
    // 1. Update GameState (particles, floating text popups, death countdown)
    if (state.gameState) {
      state.gameState.update(dt, state.player, state.level);
    }

    // 2. Update Player and Physics in Play Mode
    if (state.mode === 'play' && state.player && state.player.alive) {
      const p = state.player;

      if (p.isDying) {
        // Player dying tumble arc (input ignored)
        p.update(dt, null);
      } else {
        // Normal movement & jump input
        p.update(dt, state.input);

        // Clamp inside screen boundaries (keeps player inside 800x480 viewport)
        PhysicsEngine.resolveBoundaries(p, { x: 0, y: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT });

        // Resolve Grid Tile Collisions & Triggers
        const events = state.level.resolveCollisions(p, PhysicsEngine);

        // Handle Coin Collection
        if (events.coinCollected && state.gameState) {
          state.gameState.handleCoinCollect(events.coinCol, events.coinRow, events.coinX, events.coinY);
        }

        // Handle Lethal Hazard Hit
        if (events.hitHazard && state.gameState) {
          state.gameState.handleHazardCollision(p, events.hazardX, events.hazardY);
        }
      }
    }

    // 3. Update real-time dynamic FPS indicator
    if (state.engine && elements.hudFps) {
      elements.hudFps.textContent = `${state.engine.getFps()} FPS`;
    }

    // 4. Update editor hover tile coordinates
    if (state.editor && state.mode === 'editor' && elements.hudCoords) {
      const { col, row } = state.editor.hoverTile;
      if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
        elements.hudCoords.textContent = `Tile: X: ${col}, Y: ${row}`;
      }
    }
  }

  /**
   * Main rendering loop pass
   */
  function render() {
    const ctx = elements.ctx;
    if (!ctx) return;

    // Ensure pixel crispness (disable bilinear smoothing)
    ctx.imageSmoothingEnabled = false;

    // 1. Draw Retro Arcade Background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    bgGradient.addColorStop(0, '#0d1326');
    bgGradient.addColorStop(0.5, '#12182e');
    bgGradient.addColorStop(1, '#1b223d');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Distant background star twinkling
    const animTicks = state.engine ? state.engine.getTotalTime() * 60 : 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    for (let i = 0; i < 35; i++) {
      const starX = (i * 97 + 23) % CANVAS_WIDTH;
      const starY = (i * 59 + 17) % (CANVAS_HEIGHT - 120);
      const twinkle = (animTicks + i * 10) % 60 < 30 ? 1 : 2;
      ctx.fillRect(starX, starY, twinkle, twinkle);
    }

    // 2. Render Level Tile Map
    if (state.level) {
      state.level.render(ctx, animTicks);
    }

    // 3. Render Player Character
    if (state.mode === 'play' && state.player) {
      state.player.draw(ctx);
    } else if (state.mode === 'editor' && state.player) {
      // Semi-transparent ghost preview at spawn in editor mode
      ctx.save();
      ctx.globalAlpha = 0.55;
      state.player.draw(ctx);
      ctx.restore();
    }

    // 4. Render Level Editor Overlay (Grid Lines & Hover Ghost Cursor)
    if (state.editor) {
      state.editor.renderOverlay(ctx);
    }

    // 5. Render Particle System & Floating Score Popups from GameState
    if (state.gameState) {
      state.gameState.render(ctx);
    }
  }

  // =========================================================================
  // Bootstrap Application
  // =========================================================================

  function init() {
    if (!elements.canvas) {
      console.error('PixelQuest: Canvas element (#game-canvas) not found.');
      return;
    }

    elements.ctx = elements.canvas.getContext('2d', { alpha: false });
    elements.ctx.imageSmoothingEnabled = false;

    // 1. Initialize Audio System
    state.audio = window.gameAudio || new AudioSystem();

    // 2. Initialize Input Handler
    state.input = new InputHandler(elements.canvas);

    // 3. Physics Reference
    state.physics = PhysicsEngine;

    // 4. Initialize Level Grid (25x15, 32px)
    state.level = new Level({
      cols: COLS,
      rows: ROWS,
      tileSize: TILE_SIZE,
    });

    // 5. Initialize Player at spawn coordinate
    const spawnX = state.level.spawnPoint.col * TILE_SIZE;
    const spawnY = state.level.spawnPoint.row * TILE_SIZE;
    state.player = new Player(spawnX, spawnY);

    // Bind Jump Sound effect to Player
    state.player.onJump = () => {
      if (state.audio) {
        state.audio.playJump();
      }
    };

    // 6. Initialize Game State Manager
    state.gameState = new GameState({
      audio: state.audio,
      onRespawn: () => {
        resetPlayerToSpawn();
      },
    });
    state.gameState.totalCoins = state.level.totalCoins;
    state.gameState.updateHUD();

    // 7. Initialize Interactive Level Editor
    state.editor = new Editor(state.level, elements.canvas, {
      input: state.input,
      onTileChanged: (col, row, tileType, isErase) => {
        if (state.audio) {
          state.audio.playBlip();
        }
        if (tileType === Level.TILES.SPAWN) {
          resetPlayerToSpawn();
          showToast(`Spawn relocated to (${col}, ${row})`, 'info');
        }
        // Update coin count in GameState
        if (state.gameState) {
          state.gameState.totalCoins = state.level.totalCoins;
          state.gameState.updateHUD();
        }
      },
    });

    // 8. Bind all UI Listeners & Set Initial Tool
    initUIListeners();
    setActiveTool('ground');

    // 9. Instantiate and start Engine loop at target 60 FPS
    state.engine = new Engine({
      canvas: elements.canvas,
      ctx: elements.ctx,
      input: state.input,
      physics: state.physics,
      player: state.player,
      bounds: { x: 0, y: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
      enablePlayerPhysics: false, // Custom update resolution in update()
      targetFps: 60,
      update: (dt) => update(dt),
      render: () => render(),
    });

    state.engine.start();

    // Expose global debug references
    window.gameEngine = state.engine;
    window.gameLevel = state.level;
    window.gameEditor = state.editor;
    window.gamePlayer = state.player;
    window.gameState = state.gameState;
    window.gameAudio = state.audio;
    window.gameInput = state.input;

    console.log('PixelQuest: Engine, Level, Editor, GameState, and Audio initialized successfully.');
  }

  // Launch when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
