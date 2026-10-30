const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// --- GEOGRAPHICALLY ACCURATE VAST BRITISH ISLES MAP ---
const coastlinePolygons = [
  {
    fill: "#2e7d32",
    stroke: "#d7ccc8",
    points: [
      { x: -4500, y: 4000 }, { x: -4000, y: 3800 }, { x: -3200, y: 3400 }, 
      { x: -2200, y: 3000 }, { x: -1200, y: 2700 }, { x: -450, y: 2600 },   
      { x: 0, y: 2500 },     { x: 700, y: 2500 },   { x: 1600, y: 2400 },   
      { x: 2400, y: 2200 },  { x: 3000, y: 1900 },  { x: 2800, y: 1300 },   
      { x: 2200, y: 1100 },  { x: 2000, y: 700 },   { x: 2700, y: 200 },    
      { x: 3100, y: -450 },  { x: 2700, y: -1000 }, { x: 1800, y: -1200 },  
      { x: 1600, y: -750 },  { x: 1300, y: -1300 }, { x: 1200, y: -1800 },  
      { x: 1400, y: -2700 }, { x: 1000, y: -3300 }, { x: -550, y: -3800 }, 
      { x: -2200, y: -2700 },{ x: -2800, y: -2100 },{ x: -3500, y: -1300 }, 
      { x: -3200, y: -700 }, { x: -3800, y: 0 },     { x: -3100, y: 700 },  
      { x: -2100, y: 1000 }, { x: -2000, y: 1550 }, { x: -2800, y: 2000 }, 
      { x: -3800, y: 2900 }
    ]
  },
  // Isle of Wight
  {
    fill: "#33691e",
    stroke: "#d7ccc8",
    points: [
      { x: 60, y: 2650 }, { x: 280, y: 2620 }, { x: 450, y: 2750 }, { x: 220, y: 2820 }
    ]
  }
];

// --- HISTORICAL DOCKYARDS & REPAIR PORTS ---
const ports = [
  { name: "Plymouth Sound", x: -3100, y: 3500, radius: 180, angle: 0.2 },
  { name: "Portsmouth Royal Dockyard", x: 700, y: 2600, radius: 180, angle: -0.1 },
  { name: "Dover Straits", x: 3000, y: 2000, radius: 180, angle: -0.4 },
  { name: "Bristol Harbor", x: -2000, y: 1650, radius: 180, angle: 0.5 }
];

// Wind System
const wind = {
  angle: Math.PI / 4, // Northeast
  speed: 1.8,
  changeTimer: 0
};

// Ocean Swell Animation
let waveOffset = 0;

// --- PLAYER SHIP (British 74-Gun Ship-of-the-Line) ---
const player = {
  x: -900,
  y: 3600,
  width: 32,
  height: 68,
  speed: 0,
  maxSpeed: 2.5,
  angle: Math.PI / 2,
  turnSpeed: 0.035,
  sailSetting: 1,
  health: 120,
  maxHealth: 120,
  cooldownLeft: 0,
  cooldownRight: 0,
  isDocked: false
};

// --- FLEETS ---
const enemies = [];
const allies = [];

function isPointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function checkLandCollision(x, y) {
  for (const coast of coastlinePolygons) {
    if (isPointInPolygon({ x, y }, coast.points)) return true;
  }
  return false;
}

function findSafeOceanPoint(baseX, baseY) {
  let testX = baseX;
  let testY = baseY;
  let radius = 60;
  while (checkLandCollision(testX, testY)) {
    testX = baseX + (Math.random() - 0.5) * radius * 2;
    testY = baseY + radius;
    radius += 120;
  }
  return { x: testX, y: testY };
}

function spawnSquadron(centerX, centerY, faction, formationType) {
  const count = 5;
  const safeCenter = findSafeOceanPoint(centerX, centerY);
  const spacing = 110;

  for (let i = 0; i < count; i++) {
    let offsetX = 0;
    let offsetY = 0;

    if (formationType === "LINE_AHEAD") {
      offsetY = (i - Math.floor(count / 2)) * spacing;
    } else if (formationType === "LINE_ABREAST") {
      offsetX = (i - Math.floor(count / 2)) * spacing;
    }

    const finalPos = findSafeOceanPoint(safeCenter.x + offsetX, safeCenter.y + offsetY);

    const ship = {
      id: Math.random(),
      x: finalPos.x,
      y: finalPos.y,
      width: 32,
      height: 68,
      speed: 1.35,
      angle: faction === "ENEMY" ? Math.PI : 0,
      health: 100,
      maxHealth: 100,
      cooldown: i * 25,
      pincerRole: i % 2 === 0 ? "PORT_PINCER" : "STARBOARD_PINCER"
    };

    if (faction === "ENEMY") enemies.push(ship);
    else allies.push(ship);
  }
}

spawnSquadron(1200, 3900, "ENEMY", "LINE_AHEAD");
spawnSquadron(3200, -300, "ENEMY", "LINE_ABREAST");
spawnSquadron(3800, 1500, "ENEMY", "LINE_AHEAD");

spawnSquadron(-1500, 3700, "ALLIED", "LINE_AHEAD");
spawnSquadron(-300, 3200, "ALLIED", "LINE_ABREAST");

const cannonballs = [];
const wakeParticles = [];
const splashParticles = [];
const keys = {};

let victoryMusicPlayed = false;
let defeatMusicPlayed = false;
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

// POLYPHONIC SYNTHESIZER: "RULE, BRITANNIA!" (D Major Polyphonic)
function playRuleBritannia() {
  if (victoryMusicPlayed) return;
  victoryMusicPlayed = true;

  const ac = getAudioContext();
  const t0 = ac.currentTime + 0.1;

  // D Major Treble Melody
  const melody = [
    { f: 293.66, d: 0.4 }, { f: 369.99, d: 0.4 }, { f: 440.00, d: 0.8 },
    { f: 440.00, d: 0.4 }, { f: 493.88, d: 0.4 }, { f: 440.00, d: 0.8 },
    { f: 392.00, d: 0.4 }, { f: 369.99, d: 0.4 }, { f: 329.63, d: 0.8 },
    { f: 440.00, d: 0.8 }, { f: 587.33, d: 1.2 }
  ];

  // Bass Line backing
  const bass = [
    { f: 146.83, d: 0.8 }, { f: 220.00, d: 0.8 }, { f: 220.00, d: 0.8 },
    { f: 196.00, d: 0.8 }, { f: 146.83, d: 0.8 }, { f: 146.83, d: 0.8 },
    { f: 220.00, d: 1.6 }
  ];

  let mTime = t0;
  melody.forEach(n => {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(n.f, mTime);
    g.gain.setValueAtTime(0.3, mTime);
    g.gain.exponentialRampToValueAtTime(0.001, mTime + n.d - 0.05);
    osc.connect(g);
    g.connect(ac.destination);
    osc.start(mTime);
    osc.stop(mTime + n.d);
    mTime += n.d;
  });

  let bTime = t0;
  bass.forEach(n => {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(n.f, bTime);
    g.gain.setValueAtTime(0.4, bTime);
    g.gain.exponentialRampToValueAtTime(0.001, bTime + n.d - 0.05);
    osc.connect(g);
    g.connect(ac.destination);
    osc.start(bTime);
    osc.stop(bTime + n.d);
    bTime += n.d;
  });
}

// POLYPHONIC SYNTHESIZER: "LA MARSEILLAISE" (G Major Fanfare)
function playLaMarseillaise() {
  if (defeatMusicPlayed) return;
  defeatMusicPlayed = true;

  const ac = getAudioContext();
  const t0 = ac.currentTime + 0.1;

  const melody = [
    { f: 293.66, d: 0.25 }, { f: 293.66, d: 0.25 }, { f: 293.66, d: 0.25 },
    { f: 392.00, d: 0.75 }, { f: 392.00, d: 0.75 }, { f: 440.00, d: 0.75 },
    { f: 440.00, d: 0.75 }, { f: 587.33, d: 1.00 }, { f: 493.88, d: 0.50 },
    { f: 392.00, d: 0.75 }, { f: 392.00, d: 0.25 }, { f: 493.88, d: 0.50 },
    { f: 392.00, d: 0.50 }, { f: 293.66, d: 1.00 }
  ];

  let time = t0;
  melody.forEach(n => {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(n.f, time);
    g.gain.setValueAtTime(0.25, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + n.d - 0.05);
    osc.connect(g);
    g.connect(ac.destination);
    osc.start(time);
    osc.stop(time + n.d);
    time += n.d;
  });
}

// Controls
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  keys[k] = true;

  if (k === "w" && player.sailSetting < 2) player.sailSetting++;
  if (k === "s" && player.sailSetting > -1) player.sailSetting--;

  if (k === "j" || e.key === "ArrowLeft") fireCannons("left");
  if (k === "l" || e.key === "ArrowRight") fireCannons("right");
  if (e.key === " " || k === "k") fireCannons("both");
});

window.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});

// REALISTIC MULTI-CANNON BROADSIDE VOLLEY (TRIPLE DECKER FLANKS)
function fireCannons(side) {
  const ballSpeed = 11.5;

  function spawnSideVolley(isPort) {
    const dir = isPort ? -1 : 1;
    const flankX = Math.cos(player.angle) * dir;
    const flankY = Math.sin(player.angle) * dir;

    // 8 Broadside guns per side staggered along the hull length
    [-22, -15, -8, -1, 6, 13, 20, 27].forEach((hullOffset) => {
      const spawnX = player.x + Math.sin(player.angle) * hullOffset + flankX * 20;
      const spawnY = player.y - Math.cos(player.angle) * hullOffset + flankY * 20;

      cannonballs.push({
        x: spawnX,
        y: spawnY,
        vx: flankX * ballSpeed + (Math.random() - 0.5) * 0.8,
        vy: flankY * ballSpeed + (Math.random() - 0.5) * 0.8,
        life: 80,
        faction: "PLAYER"
      });
    });
  }

  if ((side === "left" || side === "both") && player.cooldownLeft <= 0) {
    spawnSideVolley(true);
    player.cooldownLeft = 35;
  }
  if ((side === "right" || side === "both") && player.cooldownRight <= 0) {
    spawnSideVolley(false);
    player.cooldownRight = 35;
  }
}

// --- UPDATE LOGIC ---
function update() {
  if (player.health <= 0) return;

  waveOffset += 0.03;

  wind.changeTimer++;
  if (wind.changeTimer > 900) {
    wind.angle += (Math.random() - 0.5) * 0.3;
    wind.changeTimer = 0;
  }

  if (player.cooldownLeft > 0) player.cooldownLeft--;
  if (player.cooldownRight > 0) player.cooldownRight--;

  if (keys["a"]) player.angle -= player.turnSpeed;
  if (keys["d"]) player.angle += player.turnSpeed;

  // WIND PHYSICS & SAIL EFFECTIVENESS
  const facingX = Math.sin(player.angle);
  const facingY = -Math.cos(player.angle);
  const windX = Math.cos(wind.angle);
  const windY = Math.sin(wind.angle);

  // Dot product determines tailwind vs headwind
  const windDot = facingX * windX + facingY * windY;

  let targetSpeed = 0;
  let sailMultiplier = (windDot + 1.2) / 2.2; // Headwind slows down, tailwind boosts
  if (player.sailSetting === 1) targetSpeed = player.maxSpeed * 0.5 * sailMultiplier;
  if (player.sailSetting === 2) targetSpeed = player.maxSpeed * sailMultiplier;
  if (player.sailSetting === -1) targetSpeed = -player.maxSpeed * 0.3;

  player.speed += (targetSpeed - player.speed) * 0.04;

  // Wind Leeway Drift (Lateral drift caused by wind blowing against hull)
  const leewayX = windX * wind.speed * 0.12 * (player.sailSetting > 0 ? 1 : 0.4);
  const leewayY = windY * wind.speed * 0.12 * (player.sailSetting > 0 ? 1 : 0.4);

  const nextX = player.x + Math.sin(player.angle) * player.speed + leewayX;
  const nextY = player.y - Math.cos(player.angle) * player.speed + leewayY;

  if (checkLandCollision(nextX, nextY)) {
    player.health = Math.max(0, player.health - 15);
    player.x -= Math.sin(player.angle) * 18;
    player.y += Math.cos(player.angle) * 18;
    player.speed = -player.speed * 0.3;

    for (let i = 0; i < 10; i++) {
      splashParticles.push({
        x: nextX, y: nextY,
        vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6,
        radius: Math.random() * 4 + 2, color: "#8d6e63", life: 30
      });
    }
  } else {
    player.x = nextX;
    player.y = nextY;
  }

  // Expanded Foaming Wake Particles
  if (Math.abs(player.speed) > 0.1) {
    wakeParticles.push({
      x: player.x - Math.sin(player.angle) * 30,
      y: player.y + Math.cos(player.angle) * 30,
      radius: Math.random() * 4 + 4,
      alpha: 0.6
    });
  }

  // Ports
  player.isDocked = false;
  ports.forEach((port) => {
    if (Math.hypot(player.x - port.x, player.y - port.y) < port.radius) {
      player.isDocked = true;
      if (player.sailSetting === 0 && player.health < player.maxHealth) {
        player.health = Math.min(player.maxHealth, player.health + 0.3);
      }
    }
  });

  // Particles
  for (let i = wakeParticles.length - 1; i >= 0; i--) {
    const p = wakeParticles[i];
    p.radius += 0.15;
    p.alpha -= 0.018;
    if (p.alpha <= 0) wakeParticles.splice(i, 1);
  }
  for (let i = splashParticles.length - 1; i >= 0; i--) {
    const p = splashParticles[i];
    p.x += p.vx; p.y += p.vy; p.life--;
    if (p.life <= 0) splashParticles.splice(i, 1);
  }

  // ENEMY AI
  enemies.forEach((enemy) => {
    if (enemy.health <= 0) return;

    let target = player;
    let minDist = Math.hypot(player.x - enemy.x, player.y - enemy.y);

    if (minDist < 1600) {
      const flankOffset = 250;
      let targetX = target.x;
      let targetY = target.y;

      if (enemy.pincerRole === "PORT_PINCER") {
        targetX += Math.cos(target.angle) * flankOffset;
        targetY += Math.sin(target.angle) * flankOffset;
      } else {
        targetX -= Math.cos(target.angle) * flankOffset;
        targetY -= Math.sin(target.angle) * flankOffset;
      }

      const desiredAngle = Math.atan2(targetX - enemy.x, -(targetY - enemy.y)) + Math.PI / 2;
      let angleDiff = desiredAngle - enemy.angle;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      enemy.angle += angleDiff * 0.03;

      const rayDist = 180;
      const centerRayX = enemy.x + Math.sin(enemy.angle) * rayDist;
      const centerRayY = enemy.y - Math.cos(enemy.angle) * rayDist;

      if (checkLandCollision(centerRayX, centerRayY)) {
        enemy.angle += 0.12;
      } else {
        const eNextX = enemy.x + Math.sin(enemy.angle) * enemy.speed;
        const eNextY = enemy.y - Math.cos(enemy.angle) * enemy.speed;
        if (!checkLandCollision(eNextX, eNextY)) {
          enemy.x = eNextX;
          enemy.y = eNextY;
        }
      }
    }

    enemy.cooldown--;
    if (minDist < 550 && enemy.cooldown <= 0) {
      const isPort = Math.random() > 0.5;
      const dir = isPort ? -1 : 1;
      const flankX = Math.cos(enemy.angle) * dir;
      const flankY = Math.sin(enemy.angle) * dir;

      [-15, 0, 15].forEach(hullOffset => {
        cannonballs.push({
          x: enemy.x + Math.sin(enemy.angle) * hullOffset + flankX * 20,
          y: enemy.y - Math.cos(enemy.angle) * hullOffset + flankY * 20,
          vx: flankX * 9.0,
          vy: flankY * 9.0,
          life: 75,
          faction: "ENEMY"
        });
      });
      enemy.cooldown = 110;
    }
  });

  // ALLIED AI
  allies.forEach((ally) => {
    if (ally.health <= 0) return;

    let nearestEnemy = null;
    let minD = 99999;
    enemies.forEach(e => {
      if (e.health > 0) {
        const d = Math.hypot(e.x - ally.x, e.y - ally.y);
        if (d < minD) {
          minD = d;
          nearestEnemy = e;
        }
      }
    });

    if (nearestEnemy && minD < 1400) {
      const desiredAngle = Math.atan2(nearestEnemy.x - ally.x, -(nearestEnemy.y - ally.y)) + Math.PI / 2;
      let angleDiff = desiredAngle - ally.angle;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      ally.angle += angleDiff * 0.03;

      const aNextX = ally.x + Math.sin(ally.angle) * ally.speed;
      const aNextY = ally.y - Math.cos(ally.angle) * ally.speed;
      if (!checkLandCollision(aNextX, aNextY)) {
        ally.x = aNextX;
        ally.y = aNextY;
      }

      ally.cooldown = (ally.cooldown || 0) - 1;
      if (minD < 550 && ally.cooldown <= 0) {
        const isPort = Math.random() > 0.5;
        const dir = isPort ? -1 : 1;
        const flankX = Math.cos(ally.angle) * dir;
        const flankY = Math.sin(ally.angle) * dir;

        [-15, 0, 15].forEach(hullOffset => {
          cannonballs.push({
            x: ally.x + Math.sin(ally.angle) * hullOffset + flankX * 20,
            y: ally.y - Math.cos(ally.angle) * hullOffset + flankY * 20,
            vx: flankX * 9.0,
            vy: flankY * 9.0,
            life: 75,
            faction: "ALLY"
          });
        });
        ally.cooldown = 110;
      }
    }
  });

  // Cannonballs Mechanics
  for (let i = cannonballs.length - 1; i >= 0; i--) {
    const b = cannonballs[i];
    b.x += b.vx; b.y += b.vy; b.life--;

    if (checkLandCollision(b.x, b.y)) {
      b.life = 0;
      continue;
    }

    if (b.faction === "PLAYER" || b.faction === "ALLY") {
      enemies.forEach((enemy) => {
        if (enemy.health > 0 && Math.hypot(b.x - enemy.x, b.y - enemy.y) < 32) {
          enemy.health -= 15;
          b.life = 0;
        }
      });
    } else {
      if (Math.hypot(b.x - player.x, b.y - player.y) < 32) {
        player.health = Math.max(0, player.health - 10);
        b.life = 0;
      }
      allies.forEach((ally) => {
        if (ally.health > 0 && Math.hypot(b.x - ally.x, b.y - ally.y) < 32) {
          ally.health -= 12;
          b.life = 0;
        }
      });
    }

    if (b.life <= 0) cannonballs.splice(i, 1);
  }
}

// --- RENDERING VISUALS & SHIP DETAILS ---

// DRAW ANIMATED OCEAN WAVES
function drawOceanWaves() {
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1.5;

  const gridSize = 160;
  const startX = Math.floor((player.x - canvas.width) / gridSize) * gridSize;
  const endX = Math.ceil((player.x + canvas.width) / gridSize) * gridSize;
  const startY = Math.floor((player.y - canvas.height) / gridSize) * gridSize;
  const endY = Math.ceil((player.y + canvas.height) / gridSize) * gridSize;

  for (let x = startX; x < endX; x += gridSize) {
    for (let y = startY; y < endY; y += gridSize) {
      ctx.beginPath();
      ctx.arc(x + Math.sin(waveOffset + y * 0.01) * 15, y + Math.cos(waveOffset + x * 0.01) * 15, 20, 0, Math.PI * 0.8);
      ctx.stroke();
    }
  }
}

// HISTORICAL 1805 SHIP RENDERER (BRITISH ROYAL NAVY & FRENCH FLEETS)
function drawShip(x, y, angle, type, health, maxHealth) {
  if (health <= 0) return;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const w = 32, h = 68, hX = -w / 2, hY = -h / 2;

  // 1. Copper Bottom Hull Plating
  ctx.fillStyle = type === "ENEMY" ? "#3e2723" : "#b87333";
  ctx.fillRect(hX - 2, hY, w + 4, h);

  // 2. Main Wooden Hull (Trafalgar Scheme: Black & Yellow for French / Dark Oak for British)
  ctx.fillStyle = type === "ENEMY" ? "#1a1a1a" : "#3e2723";
  ctx.fillRect(hX, hY, w, h);

  // Yellow Gun Deck Stripes
  ctx.fillStyle = type === "ENEMY" ? "#fbc02d" : "#d7ccc8";
  ctx.fillRect(hX + 2, hY + 8, w - 4, 6);
  ctx.fillRect(hX + 2, hY + 24, w - 4, 6);
  ctx.fillRect(hX + 2, hY + 40, w - 4, 6);

  // 3. Triple-Deck Cannon Ports (6 Ports per flank)
  ctx.fillStyle = "#111";
  [-22, -12, -2, 8, 18, 28].forEach(py => {
    ctx.fillRect(hX - 5, hY + py, 5, 4);
    ctx.fillRect(hX + w, hY + py, 5, 4);
  });

  // Bow & Stern Quarterdeck
  ctx.beginPath();
  ctx.moveTo(hX, hY);
  ctx.lineTo(0, hY - 22);
  ctx.lineTo(hX + w, hY);
  ctx.closePath();
  ctx.fillStyle = type === "ENEMY" ? "#1a1a1a" : "#3e2723";
  ctx.fill();

  // Deck Details
  ctx.fillStyle = "#d7ccc8";
  ctx.fillRect(hX + 4, hY + 6, w - 8, h - 12);

  // 4. Triple Masts & Layered Square Sails
  ctx.fillStyle = "#f5f5f5";
  ctx.strokeStyle = "#424242";
  ctx.lineWidth = 1;

  // Fore-Mast Sail (Top)
  ctx.beginPath();
  ctx.fillRect(hX - 6, hY + 12, w + 12, 6);
  ctx.strokeRect(hX - 6, hY + 12, w + 12, 6);

  // Main-Mast Sail (Center)
  ctx.beginPath();
  ctx.fillRect(hX - 8, hY + 28, w + 16, 8);
  ctx.strokeRect(hX - 8, hY + 28, w + 16, 8);

  // Mizzen-Mast Sail (Rear)
  ctx.beginPath();
  ctx.fillRect(hX - 5, hY + 48, w + 10, 5);
  ctx.strokeRect(hX - 5, hY + 48, w + 10, 5);

  // 5. NATIONAL FLAGS AT STERN
  ctx.save();
  ctx.translate(0, hY + h + 6);

  if (type === "ENEMY") {
    // FRENCH TRICOLOUR FLAG (Blue, White, Red)
    ctx.fillStyle = "#0d47a1"; ctx.fillRect(-9, 0, 6, 10);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(-3, 0, 6, 10);
    ctx.fillStyle = "#b71c1c"; ctx.fillRect(3, 0, 6, 10);
  } else {
    // BRITISH ROYAL NAVY WHITE ENSIGN (Cross of St George with Union Jack)
    ctx.fillStyle = "#ffffff"; ctx.fillRect(-9, 0, 18, 11);
    ctx.fillStyle = "#b71c1c"; ctx.fillRect(-9, 4, 18, 3); ctx.fillRect(-1, 0, 3, 11);
    // Canton Union Jack corner
    ctx.fillStyle = "#0d47a1"; ctx.fillRect(-9, 0, 8, 5);
  }
  ctx.restore();

  // Health Bar
  ctx.rotate(-angle);
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(-22, -55, 44, 6);
  ctx.fillStyle = type === "ENEMY" ? "#e53935" : "#4caf50";
  ctx.fillRect(-22, -55, (health / maxHealth) * 44, 6);

  ctx.restore();
}

function drawPort(port) {
  ctx.save();
  ctx.translate(port.x, port.y);
  ctx.rotate(port.angle);

  ctx.fillStyle = "#4e342e";
  ctx.fillRect(-80, -12, 160, 24);
  ctx.fillRect(-12, -80, 24, 160);

  ctx.fillStyle = "#78909c";
  ctx.beginPath();
  ctx.arc(0, 0, 45, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d32f2f";
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, port.radius, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(76, 175, 80, 0.4)";
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.restore();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 15px Arial";
  ctx.fillText(port.name, port.x - 70, port.y - port.radius - 12);
}

function draw() {
  ctx.fillStyle = "#1e88e5";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2 - player.x, canvas.height / 2 - player.y);

  // 1. Ocean Waves
  drawOceanWaves();

  // 2. Landmasses
  coastlinePolygons.forEach((coast) => {
    ctx.beginPath();
    coast.points.forEach((pt, index) => {
      if (index === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.closePath();
    ctx.fillStyle = coast.fill;
    ctx.fill();
    ctx.lineWidth = 16;
    ctx.strokeStyle = coast.stroke;
    ctx.stroke();
  });

  // 3. Ports
  ports.forEach((port) => drawPort(port));

  // 4. Wakes & Splashes
  wakeParticles.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
    ctx.fill();
  });

  splashParticles.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
  });

  // 5. Cannonballs
  cannonballs.forEach((b) => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#111";
    ctx.fill();
  });

  // 6. Fleets
  allies.forEach((a) => drawShip(a.x, a.y, a.angle, "ALLY", a.health, a.maxHealth));
  enemies.forEach((e) => drawShip(e.x, e.y, e.angle, "ENEMY", e.health, e.maxHealth));
  drawShip(player.x, player.y, player.angle, "PLAYER", player.health, player.maxHealth);

  ctx.restore();

  drawHUD();
  drawMinimap();
}

function drawHUD() {
  // Wind Compass
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(15, 15, 120, 100);
  ctx.fillStyle = "#fff";
  ctx.font = "12px Arial";
  ctx.fillText("WIND DIRECTION", 22, 32);

  ctx.save();
  ctx.translate(75, 70);
  ctx.rotate(wind.angle);
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.lineTo(10, 15);
  ctx.lineTo(0, 8);
  ctx.lineTo(-10, 15);
  ctx.fillStyle = "#4fc3f7";
  ctx.fill();
  ctx.restore();

  if (player.isDocked) {
    ctx.fillStyle = "rgba(46, 125, 50, 0.85)";
    ctx.fillRect(canvas.width / 2 - 140, 20, 280, 40);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px Arial";
    ctx.fillText(player.sailSetting === 0 ? "REPAIRING HULL AT HARBOR..." : "DROP SAILS (S) TO DOCK & REPAIR", canvas.width / 2 - 120, 45);
  }

  // Victory Overlay
  const allEnemiesDefeated = enemies.length > 0 && enemies.every(e => e.health <= 0);
  if (allEnemiesDefeated) {
    playRuleBritannia();

    ctx.fillStyle = "rgba(10, 25, 50, 0.88)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffcc00";
    ctx.font = "bold 44px Georgia";
    ctx.fillText("RULE BRITANNIA!", canvas.width / 2 - 180, canvas.height / 2 - 20);
    ctx.fillStyle = "#fff";
    ctx.font = "20px Arial";
    ctx.fillText("The French fleet has been vanquished from the seas.", canvas.width / 2 - 230, canvas.height / 2 + 30);
  }

  // Defeat Overlay
  if (player.health <= 0) {
    playLaMarseillaise();

    ctx.fillStyle = "rgba(0,0,0,0.88)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#e53935";
    ctx.font = "bold 36px Arial";
    ctx.fillText("SHIP SUNK - GAME OVER", canvas.width / 2 - 210, canvas.height / 2 - 20);
    ctx.fillStyle = "#4fc3f7";
    ctx.font = "italic 22px Georgia";
    ctx.fillText("La Marseillaise plays for the victorious French fleet...", canvas.width / 2 - 240, canvas.height / 2 + 20);
  }
}

function drawMinimap() {
  const mapSize = 150;
  const mapX = canvas.width - mapSize - 15;
  const mapY = 15;
  const scale = 0.01;

  ctx.fillStyle = "rgba(10, 25, 50, 0.85)";
  ctx.fillRect(mapX, mapY, mapSize, mapSize);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.strokeRect(mapX, mapY, mapSize, mapSize);

  ctx.save();
  ctx.beginPath();
  ctx.rect(mapX, mapY, mapSize, mapSize);
  ctx.clip();

  const mapCenter = mapX + mapSize / 2;
  const mapMiddle = mapY + mapSize / 2;

  coastlinePolygons.forEach((coast) => {
    ctx.beginPath();
    coast.points.forEach((pt, index) => {
      const mx = mapCenter + (pt.x - player.x) * scale;
      const my = mapMiddle + (pt.y - player.y) * scale;
      if (index === 0) ctx.moveTo(mx, my);
      else ctx.lineTo(mx, my);
    });
    ctx.closePath();
    ctx.fillStyle = "#2e7d32";
    ctx.fill();
  });

  ports.forEach((port) => {
    const px = mapCenter + (port.x - player.x) * scale;
    const py = mapMiddle + (port.y - player.y) * scale;
    ctx.beginPath();
    ctx.arc(px, py, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "#4caf50";
    ctx.fill();
  });

  allies.forEach((a) => {
    if (a.health > 0) {
      const ax = mapCenter + (a.x - player.x) * scale;
      const ay = mapMiddle + (a.y - player.y) * scale;
      ctx.beginPath();
      ctx.arc(ax, ay, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = "#4caf50";
      ctx.fill();
    }
  });

  enemies.forEach((e) => {
    if (e.health > 0) {
      const ex = mapCenter + (e.x - player.x) * scale;
      const ey = mapMiddle + (e.y - player.y) * scale;
      ctx.beginPath();
      ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = "#ff1744";
      ctx.fill();
    }
  });

  ctx.beginPath();
  ctx.arc(mapCenter, mapMiddle, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = "#29b6f6";
  ctx.fill();

  ctx.restore();
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();
