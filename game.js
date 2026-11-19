const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    const levelDisplay = document.getElementById('levelDisplay');
    const timeDisplay = document.getElementById('timeDisplay');
    const livesDisplay = document.getElementById('livesDisplay');
    const rotationDisplay = document.getElementById('rotationDisplay');
    const statusDisplay = document.getElementById('statusDisplay');
    const overlay = document.getElementById('overlay');
    const overlayTitle = document.getElementById('overlayTitle');
    const overlayDesc = document.getElementById('overlayDesc');
    const overlayBtn = document.getElementById('overlayBtn');
    const fastForwardBtn = document.getElementById('fastForwardBtn');
    const newGameBtn = document.getElementById('newGameBtn');
    const soundBtn = document.getElementById('soundBtn');
    const backgroundMusic = document.getElementById('backgroundMusic');
    const musicVolume = document.getElementById('musicVolume');
    const themeSelect = document.getElementById('themeSelect');
    const startThemeSelect = document.getElementById('startThemeSelect');
    const leaderboardBtn = document.getElementById('leaderboardBtn');
    const startLeaderboardBtn = document.getElementById('startLeaderboardBtn');
    const leaderboardModal = document.getElementById('leaderboardModal');
    const closeLeaderboardBtn = document.getElementById('closeLeaderboardBtn');
    const leaderboardList = document.getElementById('leaderboardList');
    const leaderboardEmpty = document.getElementById('leaderboardEmpty');
    const leaderboardMessage = document.getElementById('leaderboardMessage');
    const leaderSummary = document.getElementById('leaderSummary');
    const gameStartScreen = document.getElementById('gameStartScreen');
    const startForm = document.getElementById('startForm');
    const playerNameInput = document.getElementById('playerNameInput');
    const startError = document.getElementById('startError');
    const practiceBtn = document.getElementById('practiceBtn');
    const practiceIndicator = document.getElementById('practiceIndicator');
    const gameUi = document.querySelectorAll('.top-actions, .header, .hud, .controls, .canvas-wrapper, .leaderboard-modal');

    // Directions: 0 = Up, 1 = Right, 2 = Down, 3 = Left
    const DIRS = [
      { dx: 0, dy: -1, opp: 2 },
      { dx: 1, dy: 0,  opp: 3 },
      { dx: 0, dy: 1,  opp: 0 },
      { dx: -1, dy: 0, opp: 1 }
    ];

    const THEME_PALETTES = {
      default: {
        tileA: '#3f6640', tileB: '#385c39', gridLine: 'rgba(0,0,0,0.15)', trainTile: 'rgba(251,191,36,0.15)',
        rock: '#6b7280', rockShadow: '#4b5563', start: '#2563eb', startText: '#93c5fd',
        goal: '#dc2626', goalBorder: '#fef08a', trackBed: '#5c3a21', trackCore: '#1f2937', trackRail: '#d1d5db',
        trainShadow: 'rgba(0,0,0,0.35)', trainBody: '#f59e0b', trainCab: '#b45309', trainWheel: '#111827',
        headlightStart: 'rgba(254,240,138,0.5)', headlightEnd: 'rgba(254,240,138,0)'
      },
      night: {
        tileA: '#293850', tileB: '#202d42', gridLine: 'rgba(170,195,230,0.18)', trainTile: 'rgba(145,180,255,0.18)',
        rock: '#61708a', rockShadow: '#3c4b65', start: '#315aa8', startText: '#c7d9ff',
        goal: '#a93255', goalBorder: '#ffe3a3', trackBed: '#4c3f5e', trackCore: '#1b263b', trackRail: '#d9e3f2',
        trainShadow: 'rgba(0,0,0,0.45)', trainBody: '#9fb9ff', trainCab: '#5b7fc7', trainWheel: '#101827',
        headlightStart: 'rgba(190,210,255,0.6)', headlightEnd: 'rgba(190,210,255,0)'
      },
      neon: {
        tileA: '#101c2d', tileB: '#0c1625', gridLine: 'rgba(53,255,255,0.2)', trainTile: 'rgba(0,255,220,0.2)',
        rock: '#4b4772', rockShadow: '#222344', start: '#123d63', startText: '#67f7ff',
        goal: '#9a1f61', goalBorder: '#ff75c3', trackBed: '#ff4dba', trackCore: '#140d2a', trackRail: '#5cfff7',
        trainShadow: 'rgba(0,0,0,0.5)', trainBody: '#ffdf4a', trainCab: '#ff8e31', trainWheel: '#160e2b',
        headlightStart: 'rgba(83,255,255,0.65)', headlightEnd: 'rgba(83,255,255,0)'
      }
    };

    const LEADERBOARD_STORAGE_KEY = 'railrushLeaderboardV1';
    const LEADERBOARD_API_URL = 'api/leaderboard.php';
    const CAN_USE_LEADERBOARD_API = window.location.protocol === 'http:' || window.location.protocol === 'https:';
    let activePalette = THEME_PALETTES.neon;
    let leaderboardRecords = [];
    let leaderboardStorageMessage = '';
    let leaderboardOpen = false;
    let gridSize = 7;
    let tileSize = canvas.width / gridSize;
    let grid = [];
    let solutionPath = [];
    let solutionCellKeys = new Set();
    let solutionRevealed = false;
    let initialGrid = [];
    let level = 1;
    let lives = 3;
    let elapsedTime = 0;
    let rotationCount = 0;
    let playerName = '';
    let gameStarted = false;
    let practiceMode = false;

    // Game state: 'PREP', 'MOVING', 'WIN', 'LOSE'
    let gameState = 'PREP';
    let prepTimer = 4.0;
    let fastForward = false;
    let soundEnabled = true;
    let audioContext = null;
    let trainAudio = null;
    backgroundMusic.volume = Number(musicVolume.value) / 100;
    musicVolume.addEventListener('input', () => {
      backgroundMusic.volume = Number(musicVolume.value) / 100;
    });

    function startBackgroundMusic() {
      if (!soundEnabled) return;
      const playback = backgroundMusic.play();
      if (playback && typeof playback.catch === 'function') {
        playback.catch((error) => {
          console.error('Unable to start background music.', error);
        });
      }
    }

    // Train state
    let train = {
      gx: 0,
      gy: 0,
      entryDir: 3,
      exitDir: 1,
      progress: 0,
      speed: 0.35,
      x: 0,
      y: 0,
      angle: 0
    };

    let particles = [];
    let lastTime = 0;

    function getConnections(tile) {
      const r = tile.rot % 4;
      if (tile.type === 'STRAIGHT' || tile.type === 'START' || tile.type === 'GOAL') {
        return [[(0 + r) % 4, (2 + r) % 4]];
      }
      if (tile.type === 'CURVE') {
        return [[(0 + r) % 4, (1 + r) % 4]];
      }
      if (tile.type === 'CROSS') {
        return [[0, 2], [1, 3]];
      }
      return [];
    }

    function applyTheme(theme) {
      const selectedTheme = Object.prototype.hasOwnProperty.call(THEME_PALETTES, theme) ? theme : 'default';
      activePalette = THEME_PALETTES[selectedTheme];
      document.body.dataset.theme = selectedTheme;
      themeSelect.value = selectedTheme;
      startThemeSelect.value = selectedTheme;
    }

    function getExitDirection(tile, entryDir) {
      const pairs = getConnections(tile);
      for (const [a, b] of pairs) {
        if (a === entryDir) return b;
        if (b === entryDir) return a;
      }
      return -1;
    }

    function unlockAudio() {
      if (!soundEnabled) return null;
      if (!audioContext) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
          soundEnabled = false;
          soundBtn.disabled = true;
          soundBtn.textContent = '🔇 Audio unavailable';
          soundBtn.setAttribute('aria-pressed', 'false');
          return null;
        }
        audioContext = new AudioContextClass();
      }

      if (audioContext.state === 'suspended') {
        audioContext.resume().catch((error) => {
          console.error('Unable to start game audio.', error);
          soundEnabled = false;
          soundBtn.textContent = '🔇 Sound Off';
          soundBtn.setAttribute('aria-pressed', 'false');
          stopTrainSound();
        });
      }
      return audioContext;
    }

    function playRotationSound() {
      const context = unlockAudio();
      if (!context) return;
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(620, now);
      oscillator.frequency.exponentialRampToValueAtTime(260, now + 0.08);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.09, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.1);
    }

    function playGoalSound() {
      const context = unlockAudio();
      if (!context) return;
      const now = context.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
        const start = now + index * 0.13;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.16, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.38);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.4);
      });
    }

    function startTrainSound() {
      if (!audioContext || !soundEnabled || trainAudio) return;
      const oscillator = audioContext.createOscillator();
      const modulation = audioContext.createOscillator();
      const modulationGain = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();
      const gain = audioContext.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.value = 68;
      modulation.frequency.value = 7;
      modulationGain.gain.value = 7;
      filter.type = 'lowpass';
      filter.frequency.value = 190;
      gain.gain.value = 0.0001;
      modulation.connect(modulationGain);
      modulationGain.connect(oscillator.frequency);
      oscillator.connect(filter);
      filter.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      modulation.start();
      gain.gain.setTargetAtTime(0.045, audioContext.currentTime, 0.12);
      trainAudio = { oscillator, modulation, gain };
    }

    function stopTrainSound() {
      if (!trainAudio || !audioContext) return;
      const sound = trainAudio;
      trainAudio = null;
      const stopAt = audioContext.currentTime + 0.16;
      sound.gain.gain.setTargetAtTime(0.0001, audioContext.currentTime, 0.035);
      sound.oscillator.stop(stopAt);
      sound.modulation.stop(stopAt);
    }

    themeSelect.addEventListener('change', () => applyTheme(themeSelect.value));
    startThemeSelect.addEventListener('change', () => applyTheme(startThemeSelect.value));
    applyTheme('neon');

    function generateLevel() {
      gridSize = Math.min(9, 6 + Math.floor((level - 1) / 2));
      tileSize = canvas.width / gridSize;
      grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(null));

      let path = [];
      let success = false;

      while (!success) {
        path = [];
        const visited = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));
        const startY = Math.floor(Math.random() * (gridSize - 2)) + 1;

        function dfs(x, y) {
          visited[y][x] = true;
          path.push({ x, y });

          if (x === gridSize - 1 && path.length >= gridSize + 2) {
            return true;
          }

          const neighbors = [
            { dx: 1, dy: 0 },
            { dx: 0, dy: -1 },
            { dx: 0, dy: 1 },
            { dx: -1, dy: 0 }
          ].sort(() => Math.random() - 0.5);

          for (const n of neighbors) {
            const nx = x + n.dx;
            const ny = y + n.dy;
            if (
              nx >= 1 && nx < gridSize &&
              ny >= 0 && ny < gridSize &&
              !visited[ny][nx]
            ) {
              if (nx === gridSize - 1 && path.length < gridSize + 1) continue;
              if (dfs(nx, ny)) return true;
            }
          }

          path.pop();
          visited[y][x] = false;
          return false;
        }

        visited[startY][0] = true;
        path.push({ x: 0, y: startY });
        success = dfs(1, startY);
      }

      solutionPath = path.map(({ x, y }) => ({ x, y }));
      solutionCellKeys = new Set(solutionPath.map(({ x, y }) => y * gridSize + x));
      for (let i = 0; i < path.length; i++) {
        const curr = path[i];
        if (i === 0) {
          grid[curr.y][curr.x] = { type: 'START', rot: 1, locked: true };
        } else if (i === path.length - 1) {
          const prev = path[i - 1];
          const entryDir = getDirBetween(curr, prev);
          grid[curr.y][curr.x] = { type: 'GOAL', rot: entryDir, locked: true };
        } else {
          const prev = path[i - 1];
          const next = path[i + 1];
          const d1 = getDirBetween(curr, prev);
          const d2 = getDirBetween(curr, next);

          if ((d1 + 2) % 4 === d2) {
            const correctRot = (d1 === 0 || d1 === 2) ? 0 : 1;
            const randomRot = (correctRot + 1) % 2;
            grid[curr.y][curr.x] = { type: 'STRAIGHT', rot: randomRot, locked: false };
          } else {
            let correctRot = 0;
            const set = new Set([d1, d2]);
            if (set.has(0) && set.has(1)) correctRot = 0;
            else if (set.has(1) && set.has(2)) correctRot = 1;
            else if (set.has(2) && set.has(3)) correctRot = 2;
            else if (set.has(3) && set.has(0)) correctRot = 3;

            const randomRot = (correctRot + Math.floor(Math.random() * 3) + 1) % 4;
            grid[curr.y][curr.x] = { type: 'CURVE', rot: randomRot, locked: false };
          }
        }
      }

      const decoyTypes = ['STRAIGHT', 'CURVE', 'CURVE', 'CROSS', 'ROCK'];
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          if (!grid[y][x]) {
            const t = decoyTypes[Math.floor(Math.random() * decoyTypes.length)];
            grid[y][x] = {
              type: t,
              rot: Math.floor(Math.random() * 4),
              locked: t === 'ROCK',
            };
          }
        }
      }

      initialGrid = grid.map((row) => row.map((tile) => ({ ...tile })));
      resetLevel();
    }

    function resetLevel() {
      stopTrainSound();
      grid = initialGrid.map((row) => row.map((tile) => ({ ...tile })));
      tileSize = canvas.width / gridSize;
      const startNode = solutionPath[0];
      train = {
        gx: startNode.x,
        gy: startNode.y,
        entryDir: 3,
        exitDir: 1,
        progress: 0.5,
        speed: Math.min(0.75, 0.30 + (level - 1) * 0.045),
        x: (startNode.x + 0.5) * tileSize,
        y: (startNode.y + 0.5) * tileSize,
        angle: 0
      };

      prepTimer = Math.max(2.0, 4.5 - level * 0.25);
      solutionRevealed = false;
      gameState = 'PREP';
      particles = [];
      fastForward = false;
      smokeTimer = 0;
      overlay.classList.remove('active');
      updateHUD();
    }

    function getDirBetween(from, to) {
      if (to.y < from.y) return 0;
      if (to.x > from.x) return 1;
      if (to.y > from.y) return 2;
      if (to.x < from.x) return 3;
      return 0;
    }

    function updateHUD() {
      levelDisplay.textContent = level;
      timeDisplay.textContent = formatElapsedTime(elapsedTime);
      livesDisplay.textContent = `${lives} / 3`;
      rotationDisplay.textContent = rotationCount;
      if (gameState === 'PREP') {
        statusDisplay.textContent = `Departing in ${prepTimer.toFixed(1)}s`;
        statusDisplay.style.color = '#fbbf24';
      } else if (gameState === 'MOVING') {
        statusDisplay.textContent = fastForward ? 'Full Speed!' : 'Moving';
        statusDisplay.style.color = '#34d399';
      } else if (gameState === 'WIN') {
        statusDisplay.textContent = 'Arrived!';
        statusDisplay.style.color = '#10b981';
      } else if (lives === 0) {
        statusDisplay.textContent = 'Game Over';
        statusDisplay.style.color = '#ef4444';
      } else {
        statusDisplay.textContent = 'Derailed!';
        statusDisplay.style.color = '#ef4444';
      }
    }

    function formatElapsedTime(seconds) {
      const tenths = Math.floor(seconds * 10);
      const minutes = Math.floor(tenths / 600);
      const wholeSeconds = Math.floor((tenths % 600) / 10);
      const decimal = tenths % 10;
      return `${String(minutes).padStart(2, '0')}:${String(wholeSeconds).padStart(2, '0')}.${decimal}`;
    }

    function compareLeaderboardRecords(a, b) {
      return b.level - a.level || a.time - b.time || a.rotations - b.rotations;
    }

    function isValidLeaderboardRecord(record) {
      return record &&
        Number.isInteger(record.level) && record.level >= 1 &&
        Number.isFinite(record.time) && record.time >= 0 &&
        Number.isInteger(record.rotations) && record.rotations >= 0;
    }

    function normalizeLeaderboardRecords(records) {
      if (!Array.isArray(records) || !records.every(isValidLeaderboardRecord)) {
        throw new Error('Leaderboard data has an invalid format.');
      }

      return records.map((record) => ({
        level: record.level,
        time: Math.floor(record.time * 10) / 10,
        rotations: record.rotations,
        name: typeof record.name === 'string' && record.name.trim()
          ? record.name.trim().slice(0, 8)
          : 'Player'
      })).sort(compareLeaderboardRecords).slice(0, 5);
    }

    function saveLocalLeaderboard(records) {
      try {
        window.localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(records));
        return true;
      } catch (error) {
        console.error('Unable to save local leaderboard.', error);
        return false;
      }
    }

    function loadLeaderboard() {
      try {
        const serializedRecords = window.localStorage.getItem(LEADERBOARD_STORAGE_KEY);
        if (!serializedRecords) return [];

        return normalizeLeaderboardRecords(JSON.parse(serializedRecords));
      } catch (error) {
        console.error('Unable to load the leaderboard.', error);
        leaderboardStorageMessage = 'Saved leaderboard data could not be read. New runs will be saved here when possible.';
        return [];
      }
    }

    function createRunId() {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
      }
      return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }

    async function syncLeaderboardFromServer() {
      if (!CAN_USE_LEADERBOARD_API) return;

      try {
        const response = await fetch(LEADERBOARD_API_URL, {
          headers: { Accept: 'application/json' },
          cache: 'no-store'
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data || !data.ok || !Array.isArray(data.scores)) {
          throw new Error((data && data.error) || 'Could not load leaderboard from server.');
        }
        leaderboardRecords = normalizeLeaderboardRecords(data.scores);
        leaderboardStorageMessage = '';
        saveLocalLeaderboard(leaderboardRecords);
      } catch (error) {
        console.error('Unable to fetch MySQL leaderboard.', error);
        leaderboardStorageMessage = 'Database API unavailable; showing browser-saved scores.';
      }
      renderLeaderboard();
    }

    function renderLeaderboard() {
      const leader = leaderboardRecords[0];
      leaderSummary.textContent = leader
        ? `🏆 Top 1: ${leader.name} · Level ${leader.level} · ${formatElapsedTime(leader.time)} · ${leader.rotations} rotations`
        : '🏆 Top 1: No runs recorded yet';

      leaderboardList.textContent = '';
      leaderboardEmpty.hidden = leaderboardRecords.length > 0;
      leaderboardRecords.forEach((record, index) => {
        const row = document.createElement('li');
        row.className = 'leaderboard-row';

        const rank = document.createElement('span');
        rank.className = 'leaderboard-rank';
        rank.textContent = `#${index + 1}`;

        const details = document.createElement('div');
        const nameText = document.createElement('div');
        nameText.className = 'leaderboard-name';
        nameText.textContent = record.name;

        const levelText = document.createElement('div');
        levelText.className = 'leaderboard-level';
        levelText.textContent = `Level ${record.level} reached`;

        const stats = document.createElement('div');
        stats.className = 'leaderboard-stats';
        stats.textContent = `${formatElapsedTime(record.time)} · ${record.rotations} rotations`;

        details.append(nameText, levelText, stats);
        row.append(rank, details);
        leaderboardList.append(row);
      });

      leaderboardMessage.textContent = leaderboardStorageMessage;
      leaderboardMessage.hidden = !leaderboardStorageMessage;
    }

    async function recordRun() {
      if (practiceMode) return;

      const entry = {
        run_id: createRunId(),
        name: playerName,
        level,
        time: Math.floor(elapsedTime * 10) / 10,
        rotations: rotationCount
      };
      leaderboardRecords = normalizeLeaderboardRecords([...leaderboardRecords, entry]);
      const savedLocally = saveLocalLeaderboard(leaderboardRecords);

      if (!CAN_USE_LEADERBOARD_API) {
        leaderboardStorageMessage = savedLocally
          ? ''
          : 'This run is visible for this session, but could not be saved in this browser.';
        renderLeaderboard();
        return;
      }

      leaderboardStorageMessage = '';
      renderLeaderboard();

      try {
        const response = await fetch(LEADERBOARD_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify(entry)
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data || !data.ok || !Array.isArray(data.scores)) {
          throw new Error((data && data.error) || 'Could not save score to server.');
        }
        leaderboardRecords = normalizeLeaderboardRecords(data.scores);
        leaderboardStorageMessage = '';
        saveLocalLeaderboard(leaderboardRecords);
      } catch (error) {
        console.error('Unable to save score to MySQL leaderboard.', error);
        leaderboardStorageMessage = 'Could not sync with database API; run saved locally in this browser.';
      }
      renderLeaderboard();
    }

    function openLeaderboard() {
      leaderboardOpen = true;
      fastForward = false;
      stopTrainSound();
      renderLeaderboard();
      syncLeaderboardFromServer();
      if (!gameStarted) {
        gameStartScreen.setAttribute('aria-hidden', 'true');
        gameStartScreen.setAttribute('inert', '');
      }
      leaderboardModal.removeAttribute('inert');
      leaderboardModal.classList.add('active');
      leaderboardModal.setAttribute('aria-hidden', 'false');
      closeLeaderboardBtn.focus();
    }

    function closeLeaderboard() {
      if (!leaderboardOpen) return;
      leaderboardOpen = false;
      leaderboardModal.classList.remove('active');
      leaderboardModal.setAttribute('aria-hidden', 'true');
      leaderboardModal.setAttribute('inert', '');
      if (!gameStarted) {
        gameStartScreen.setAttribute('aria-hidden', 'false');
        gameStartScreen.removeAttribute('inert');
      }
      (gameStarted ? leaderboardBtn : startLeaderboardBtn).focus();
      if (gameState === 'MOVING') startTrainSound();
    }

    function revealSolution() {
      solutionRevealed = true;
      for (let index = 1; index < solutionPath.length - 1; index++) {
        const cell = solutionPath[index];
        const entry = getDirBetween(cell, solutionPath[index - 1]);
        const exit = getDirBetween(cell, solutionPath[index + 1]);
        const tile = grid[cell.y][cell.x];
        const correctRotation = [0, 1, 2, 3].find((rotation) =>
          getExitDirection({ ...tile, rot: rotation }, entry) === exit
        );
        if (correctRotation === undefined) {
          throw new Error(`Unable to reveal route tile ${index + 1}.`);
        }
        tile.rot = correctRotation;
      }
    }

    function beginGame({ practice, name = '' }) {
      practiceMode = practice;
      playerName = practice ? '' : name.slice(0, 8);
      startError.hidden = true;
      playerNameInput.value = playerName;
      startNewGame();
      gameStarted = true;
      practiceIndicator.hidden = !practiceMode;
      gameStartScreen.hidden = true;
      gameStartScreen.setAttribute('aria-hidden', 'true');
      gameUi.forEach((element) => element.removeAttribute('inert'));
      unlockAudio();
      startBackgroundMusic();
    }

    startForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = playerNameInput.value.trim();
      if (!name) {
        startError.textContent = 'Enter a player name before starting.';
        startError.hidden = false;
        playerNameInput.focus();
        return;
      }

      beginGame({ practice: false, name });
    });

    practiceBtn.addEventListener('click', () => beginGame({ practice: true }));

    playerNameInput.addEventListener('input', () => {
      if (playerNameInput.value.trim()) startError.hidden = true;
    });

    leaderboardBtn.addEventListener('click', openLeaderboard);
    startLeaderboardBtn.addEventListener('click', openLeaderboard);
    closeLeaderboardBtn.addEventListener('click', closeLeaderboard);
    leaderboardModal.addEventListener('click', (event) => {
      if (event.target === leaderboardModal) closeLeaderboard();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeLeaderboard();
    });

    canvas.addEventListener('pointerdown', (e) => {
      if (gameState === 'WIN' || gameState === 'LOSE') return;
      unlockAudio();
      if (gameState === 'MOVING') startTrainSound();

      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const gx = Math.floor(mx * canvas.width / rect.width / tileSize);
      const gy = Math.floor(my * canvas.height / rect.height / tileSize);

      if (gx < 0 || gx >= gridSize || gy < 0 || gy >= gridSize) return;

      if (gx === train.gx && gy === train.gy) return;

      const tile = grid[gy][gx];
      if (!tile.locked) {
        tile.rot = (tile.rot + 1) % 4;
        rotationCount++;
        updateHUD();
        playRotationSound();
      }
    });

    fastForwardBtn.addEventListener('mousedown', () => {
      unlockAudio();
      if (gameState === 'MOVING') startTrainSound();
      fastForward = true;
    });
    window.addEventListener('mouseup', () => (fastForward = false));
    fastForwardBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      unlockAudio();
      if (gameState === 'MOVING') startTrainSound();
      fastForward = true;
    });
    window.addEventListener('touchend', () => (fastForward = false));

    soundBtn.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      soundBtn.textContent = soundEnabled ? '🔊 Sound On' : '🔇 Sound Off';
      soundBtn.setAttribute('aria-pressed', String(soundEnabled));
      if (soundEnabled) {
        unlockAudio();
        startBackgroundMusic();
        if (gameState === 'MOVING') startTrainSound();
      } else {
        stopTrainSound();
        backgroundMusic.pause();
      }
    });

    function startNewGame() {
      level = 1;
      lives = 3;
      elapsedTime = 0;
      rotationCount = 0;
      generateLevel();
    }

    function returnToStartScreen() {
      stopTrainSound();
      fastForward = false;
      gameStarted = false;
      overlay.classList.remove('active');
      gameStartScreen.hidden = false;
      gameStartScreen.setAttribute('aria-hidden', 'false');
      playerNameInput.value = playerName;
      startError.hidden = true;
      gameUi.forEach((element) => element.setAttribute('inert', ''));
    }

    newGameBtn.addEventListener('click', startNewGame);

    overlayBtn.addEventListener('click', () => {
      if (gameState === 'WIN') {
        level++;
        generateLevel();
        return;
      }
      if (lives === 0) {
        returnToStartScreen();
        return;
      }
      resetLevel();
    });

    function spawnSmoke(x, y) {
      particles.push({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 15,
        vy: -20 - Math.random() * 15,
        life: 0.8,
        maxLife: 0.8,
        color: 'rgba(243, 244, 246, 0.65)',
        isSmoke: true
      });
    }

    let smokeTimer = 0;

    function update(dt) {
      if (!gameStarted || leaderboardOpen) return;
      if (gameState === 'MOVING') elapsedTime += dt;

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
      }

      if (gameState === 'PREP') {
        prepTimer -= fastForward ? dt * 4 : dt;
        if (prepTimer <= 0) {
          prepTimer = 0;
          gameState = 'MOVING';
          startTrainSound();
        }
        updateHUD();
        return;
      }

      if (gameState !== 'MOVING') {
        updateHUD();
        return;
      }

      const currentSpeed = fastForward ? train.speed * 3.5 : train.speed;
      train.progress += currentSpeed * dt;

      smokeTimer += dt;
      if (smokeTimer > 0.12) {
        smokeTimer = 0;
        spawnSmoke(train.x, train.y);
      }

      if (train.progress >= 1.0) {
        train.progress -= 1.0;

        const dirObj = DIRS[train.exitDir];
        const nextGx = train.gx + dirObj.dx;
        const nextGy = train.gy + dirObj.dy;

        if (nextGx < 0 || nextGx >= gridSize || nextGy < 0 || nextGy >= gridSize) {
          triggerLose('The train ran off the edge of the map!');
          return;
        }

        const nextTile = grid[nextGy][nextGx];
        const newEntryDir = dirObj.opp;

        if (nextTile.type === 'GOAL') {
          if (nextTile.rot === newEntryDir) {
            train.gx = nextGx;
            train.gy = nextGy;
            train.entryDir = newEntryDir;
            train.exitDir = (newEntryDir + 2) % 4;
            train.progress = 0.5;
            updateTrainCoords();
            triggerWin();
            return;
          } else {
            triggerLose('The train crashed into the side of the destination station!');
            return;
          }
        }

        const newExitDir = getExitDirection(nextTile, newEntryDir);
        if (newExitDir === -1) {
          triggerLose('The track was disconnected and the train derailed!');
          return;
        }

        train.gx = nextGx;
        train.gy = nextGy;
        train.entryDir = newEntryDir;
        train.exitDir = newExitDir;
      }

      updateTrainCoords();
      updateHUD();
    }

    function updateTrainCoords() {
      const cx = (train.gx + 0.5) * tileSize;
      const cy = (train.gy + 0.5) * tileSize;
      const half = tileSize * 0.5;

      const entryVec = DIRS[train.entryDir];
      const exitVec = DIRS[train.exitDir];

      const startX = cx + entryVec.dx * half;
      const startY = cy + entryVec.dy * half;
      const endX = cx + exitVec.dx * half;
      const endY = cy + exitVec.dy * half;

      const t = train.progress;
      const invT = 1 - t;
      train.x = invT * invT * startX + 2 * invT * t * cx + t * t * endX;
      train.y = invT * invT * startY + 2 * invT * t * cy + t * t * endY;

      const dx = 2 * invT * (cx - startX) + 2 * t * (endX - cx);
      const dy = 2 * invT * (cy - startY) + 2 * t * (endY - cy);
      train.angle = Math.atan2(dy, dx);
    }

    function triggerWin() {
      stopTrainSound();
      playGoalSound();
      gameState = 'WIN';
      updateHUD();
      overlayTitle.textContent = '🎉 Station Reached!';
      overlayTitle.className = 'win-text';
      overlayDesc.textContent = `Level ${level} completed in ${formatElapsedTime(elapsedTime)}.`;
      overlayBtn.textContent = 'Next Level';
      overlay.classList.add('active');
    }

    function triggerLose(reason) {
      stopTrainSound();
      gameState = 'LOSE';
      lives = Math.max(0, lives - 1);
      if (lives === 0) {
        revealSolution();
        recordRun();
      }
      updateHUD();
      overlayTitle.textContent = lives === 0 ? '💥 Game Over!' : '💥 Train Derailed!';
      overlayTitle.className = 'lose-text';
      overlayDesc.textContent = lives === 0
        ? `${reason} No attempts left. The solution is highlighted on the board.`
        : `${reason} ${lives} ${lives === 1 ? 'attempt' : 'attempts'} remaining.`;
      overlayBtn.textContent = lives === 0 ? 'Back to Start' : 'Retry Level';
      overlay.classList.add('active');
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          drawTile(x, y, grid[y][x]);
        }
      }

      drawTrain();
      drawParticles();
    }

    function drawTile(gx, gy, tile) {
      const px = gx * tileSize;
      const py = gy * tileSize;
      const cx = px + tileSize / 2;
      const cy = py + tileSize / 2;

      ctx.fillStyle = (gx + gy) % 2 === 0 ? activePalette.tileA : activePalette.tileB;
      ctx.fillRect(px, py, tileSize, tileSize);

      if (solutionRevealed && solutionCellKeys.has(gy * gridSize + gx)) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.3)';
        ctx.fillRect(px, py, tileSize, tileSize);
        ctx.strokeStyle = '#6ee7b7';
        ctx.lineWidth = 3;
        ctx.strokeRect(px + 2, py + 2, tileSize - 4, tileSize - 4);
      }

      ctx.strokeStyle = activePalette.gridLine;
      ctx.lineWidth = 1;
      ctx.strokeRect(px, py, tileSize, tileSize);

      if (gx === train.gx && gy === train.gy) {
        ctx.fillStyle = activePalette.trainTile;
        ctx.fillRect(px, py, tileSize, tileSize);
      }

      if (tile.type === 'ROCK') {
        ctx.fillStyle = activePalette.rock;
        ctx.beginPath();
        ctx.arc(cx, cy, tileSize * 0.32, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = activePalette.rockShadow;
        ctx.beginPath();
        ctx.arc(cx + 4, cy + 4, tileSize * 0.22, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      const connections = getConnections(tile);
      connections.forEach(([d1, d2]) => {
        drawTrackSegment(cx, cy, d1, d2);
      });

      if (tile.type === 'START') {
        ctx.fillStyle = activePalette.start;
        ctx.fillRect(px + tileSize * 0.15, py + tileSize * 0.2, tileSize * 0.55, tileSize * 0.6);
        ctx.fillStyle = activePalette.startText;
        ctx.font = `bold ${Math.floor(tileSize * 0.22)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('START', px + tileSize * 0.42, cy);
      } else if (tile.type === 'GOAL') {
        ctx.fillStyle = activePalette.goal;
        ctx.beginPath();
        ctx.arc(cx, cy, tileSize * 0.34, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = activePalette.goalBorder;
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.floor(tileSize * 0.22)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('GOAL', cx, cy);
      }

    }

    function drawTrackSegment(cx, cy, d1, d2) {
      const half = tileSize / 2;
      const p1 = { x: cx + DIRS[d1].dx * half, y: cy + DIRS[d1].dy * half };
      const p2 = { x: cx + DIRS[d2].dx * half, y: cy + DIRS[d2].dy * half };

      ctx.strokeStyle = activePalette.trackBed;
      ctx.lineWidth = tileSize * 0.26;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.quadraticCurveTo(cx, cy, p2.x, p2.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = activePalette.trackCore;
      ctx.lineWidth = tileSize * 0.14;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.quadraticCurveTo(cx, cy, p2.x, p2.y);
      ctx.stroke();

      ctx.strokeStyle = activePalette.trackRail;
      ctx.lineWidth = tileSize * 0.08;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.quadraticCurveTo(cx, cy, p2.x, p2.y);
      ctx.stroke();
    }

    function drawTrain() {
      ctx.save();
      ctx.translate(train.x, train.y);
      ctx.rotate(train.angle);

      const w = tileSize * 0.46;
      const h = tileSize * 0.26;

      ctx.fillStyle = activePalette.trainShadow;
      ctx.fillRect(-w / 2 + 2, -h / 2 + 3, w, h);

      ctx.fillStyle = activePalette.trainBody;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 4);
      ctx.fill();

      ctx.fillStyle = activePalette.trainCab;
      ctx.fillRect(-w / 2 + 2, -h / 2 + 2, w * 0.45, h - 4);

      ctx.fillStyle = activePalette.trainWheel;
      ctx.beginPath();
      ctx.arc(w * 0.25, 0, h * 0.24, 0, Math.PI * 2);
      ctx.fill();

      if (gameState === 'MOVING' || gameState === 'PREP') {
        const grad = ctx.createLinearGradient(w / 2, 0, w / 2 + tileSize * 0.45, 0);
        grad.addColorStop(0, activePalette.headlightStart);
        grad.addColorStop(1, activePalette.headlightEnd);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(w / 2, -3);
        ctx.lineTo(w / 2 + tileSize * 0.45, -14);
        ctx.lineTo(w / 2 + tileSize * 0.45, 14);
        ctx.lineTo(w / 2, 3);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }

    function drawParticles() {
      for (const p of particles) {
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        const radius = p.isSmoke ? (1 - alpha) * 8 + 3 : 3;
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function gameLoop(timestamp) {
      const dt = Math.min(0.05, (timestamp - lastTime) / 1000);
      lastTime = timestamp;

      update(dt);
      draw();

      requestAnimationFrame(gameLoop);
    }

    leaderboardRecords = loadLeaderboard();
    renderLeaderboard();
    syncLeaderboardFromServer();
    generateLevel();
    requestAnimationFrame((t) => {
      lastTime = t;
      gameLoop(t);
    });
