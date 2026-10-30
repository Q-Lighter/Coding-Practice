const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// --- GEOGRAPHICALLY ACCURATE & VAST ENGLAND & WALES COASTLINE ---
const coastlinePolygons = [
  {
    fill: "#2e7d32",
    stroke: "#d7ccc8",
    points: [
      { x: -3500, y: 3200 }, { x: -3100, y: 3100 }, { x: -2500, y: 2800 }, 
      { x: -1700, y: 2500 }, { x: -900, y: 2200 },  { x: -350, y: 2100 },   
      { x: 0, y: 2050 },     { x: 550, y: 2050 },   { x: 1300, y: 2000 },   
      { x: 1950, y: 1850 },  { x: 2400, y: 1550 },  { x: 2300, y: 1100 },   
      { x: 1750, y: 900 },   { x: 1650, y: 550 },   { x: 2200, y: 150 },    
      { x: 2500, y: -350 },  { x: 2200, y: -800 },  { x: 1450, y: -950 },   
      { x: 1280, y: -600 },  { x: 1100, y: -1000 }, { x: 1000, y: -1450 },  
      { x: 1180, y: -2200 }, { x: 800, y: -2700 },  { x: -450, y: -3100 }, 
      { x: -1800, y: -2200 },{ x: -2250, y: -1700 },{ x: -2800, y: -1100 }, 
      { x: -2600, y: -550 }, { x: -3100, y: 0 },     { x: -2500, y: 550 },  
      { x: -1700, y: 800 },  { x: -1600, y: 1250 },  { x: -2250, y: 1600 }, 
      { x: -3100, y: 2350 }
    ]
  },
  // Isle of Wight
  {
    fill: "#33691e",
    stroke: "#d7ccc8",
    points: [
      { x: 50, y: 2150 }, { x: 220, y: 2130 }, { x: 360, y: 2240 }, { x: 180, y: 2300 }
    ]
  }
];

// --- HISTORICAL PORTS ---
const ports = [
  { name: "Plymouth Sound", x: -2500, y: 2850, radius: 140, angle: 0.2 },
  { name: "Portsmouth Royal Dockyard", x: 550, y: 2120, radius: 140, angle: -0.1 },
  { name: "Dover Straits", x: 2400, y: 1650, radius: 140, angle: -0.4 },
  { name: "Bristol Harbor", x: -1600, y: 1350, radius: 140, angle: 0.5 }
];

// Wind System
const wind = { angle: Math.PI / 4, changeTimer: 0 };

// --- PLAYER SHIP ---
const player = {
  x: -700,
  y: 2900, // Starts out in deep waters of English Channel
  width: 28,
  height: 52,
  speed: 0,
  maxSpeed: 2.3,
  angle: Math.PI / 2,
  turnSpeed: 0.038,
  sailSetting: 1,
  health: 100,
  maxHealth: 100,
  cooldownLeft: 0,
  cooldownRight: 0,
  isDocked: false
};

// --- FLEETS (SQUADRONS & ENCIRCLEMENT AI) ---
const enemies = [];
const allies = [];

// Point-in-Polygon Detection
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

// GUARANTEED OCEAN SPAWN GENERATOR
function findSafeOceanPoint(baseX, baseY) {
  let testX = baseX;
  let testY = baseY;
  let radius = 50;

  while (checkLandCollision(testX, testY)) {
    // Spiral outward toward open water if base point touches land
    testX = baseX + (Math.random() - 0.5) * radius * 2;
    testY = baseY + radius;
    radius += 100;
  }
  return { x: testX, y: testY };
}

// HISTORICAL SQUADRON FORMATION GENERATOR (Line Ahead / Line Abreast)
function spawnSquadron(centerX, centerY, faction, formationType) {
  const count = 5; // 5 Ships of the Line per Squadron
  const safeCenter = findSafeOceanPoint(centerX, centerY);

  const spacing = 80;
  for (let i = 0; i < count; i++) {
    let offsetX = 0;
    let offsetY = 0;

    if (formationType === "LINE_AHEAD") {
      // Single-file line of battle
      offsetY = (i - Math.floor(count / 2)) * spacing;
    } else if (formationType === "LINE_ABREAST") {
      // Parallel wall formation
      offsetX = (i - Math.floor(count / 2)) * spacing;
    }

    const finalPos = findSafeOceanPoint(safeCenter.x + offsetX, safeCenter.y + offsetY);

    const ship = {
      id: Math.random(),
      x: finalPos.x,
      y: finalPos.y,
      width: 28,
      height: 52,
      speed: 1.25,
      angle: faction === "ENEMY" ? Math.PI : 0,
      health: 80,
      maxHealth: 80,
      cooldown: i * 25,
      pincerRole: i % 2 === 0 ? "PORT_PINCER" : "STARBOARD_PINCER" // Encirclement roles
    };

    if (faction === "ENEMY") enemies.push(ship);
    else allies.push(ship);
  }
}

// Spawn Historical Fleets in Deep Waters
spawnSquadron(1000, 3200, "ENEMY", "LINE_AHEAD");   // Channel Armada
spawnSquadron(2600, -200, "ENEMY", "LINE_ABREAST");  // North Sea Squadron
spawnSquadron(3200, 1200, "ENEMY", "LINE_AHEAD");   // Dover Blockade

spawnSquadron(-1200, 3000, "ALLIED", "LINE_AHEAD");  // Royal Navy Escort
spawnSquadron(-200, 2600, "ALLIED", "LINE_ABREAST");

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

function playRuleBritannia() {
  if (victoryMusicPlayed) return;
  victoryMusicPlayed = true;

  const ctxAudio = getAudioContext();
  const melody = [
    { f: 392.00, d: 0.4 }, { f: 493.88, d: 0.4 }, { f: 587.33, d: 0.8 },
    { f: 587.33, d: 0.4 }, { f: 659.25, d: 0.4 }, { f: 587.33, d: 0.8 },
    { f: 523.25, d: 0.4 }, { f: 493.88, d: 0.4 }, { f: 440.00, d: 0.8 },
    { f: 587.33, d: 0.8 }
  ];

  let time = ctxAudio.currentTime + 0.1;
  melody.forEach(n => {
    const osc = ctxAudio.createOscillator();
    const g = ctxAudio.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(n.f, time);
    g.gain.setValueAtTime(0.25, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + n.d - 0.05);
    osc.connect(g);
    g.connect(ctxAudio.destination);
    osc.start(time);
    osc.stop(time + n.d);
    time += n.d;
  });
}

function playLaMarseillaise() {
  if (defeatMusicPlayed) return;
  defeatMusicPlayed = true;

  const ctxAudio = getAudioContext();
  const melody = [
    { f: 293.66, d: 0.3 }, { f: 293.66, d: 0.3 }, { f: 293.66, d: 0.3 },
    { f: 392.00, d: 0.8 }, { f: 392.00, d: 0.8 }, { f: 440.00, d: 0.8 },
    { f: 440.00, d: 0.8 }, { f: 587.33, d: 1.0 }, { f: 493.88, d: 0.5 },
    { f: 392.00, d: 0.8 }
  ];

  let time = ctxAudio.currentTime + 0.1;
  melody.forEach(n => {
    const osc = ctxAudio.createOscillator();
    const g = ctxAudio.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(n.f, time);
    g.gain.setValueAtTime(0.2, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + n.d - 0.05);
    osc.connect(g);
    g.connect(ctxAudio.destination);
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

// Broadside Cannons
function fireCannons(side) {
  const ballSpeed = 10.5;

  function spawnSideVolley(isPort) {
    const dir = isPort ? -1 : 1;
    const flankX = Math.cos(player.angle) * dir;
    const flankY = Math.sin(player.angle) * dir;

    [-14, 14].forEach((hullOffset) => {
      const spawnX = player.x + Math.sin(player.angle) * hullOffset + flankX * 18;
      const spawnY = player.y - Math.cos(player.angle) * hullOffset + flankY * 18;

      cannonballs.push({
        x: spawnX,
        y: spawnY,
        vx: flankX * ballSpeed,
        vy: flankY * ballSpeed,
        life: 75,
        faction: "PLAYER"
      });
    });
  }

  if ((side === "left" || side === "both") && player.cooldownLeft <= 0) {
    spawnSideVolley(true);
    player.cooldownLeft = 32;
  }
  if ((side === "right" || side === "both") && player.cooldownRight <= 0) {
    spawnSideVolley(false);
    player.cooldownRight = 32;
  }
}

// --- UPDATE LOGIC ---
function update() {
  if (player.health <= 0) return;

  wind.changeTimer++;
  if (wind.changeTimer > 900) {
    wind.angle += (Math.random() - 0.5) * 0.3;
    wind.changeTimer = 0;
  }

  if (player.cooldownLeft > 0) player.cooldownLeft--;
  if (player.cooldownRight > 0) player.cooldownRight--;

  if (keys["a"]) player.angle -= player.turnSpeed;
  if (keys["d"]) player.angle += player.turnSpeed;

  let targetSpeed = 0;
  if (player.sailSetting === 1) targetSpeed = player.maxSpeed * 0.5;
  if (player.sailSetting === 2) targetSpeed = player.maxSpeed;
  if (player.sailSetting === -1) targetSpeed = -player.maxSpeed * 0.3;

  player.speed += (targetSpeed - player.speed) * 0.04;

  const nextX = player.x + Math.sin(player.angle) * player.speed;
  const nextY = player.y - Math.cos(player.angle) * player.speed;

  if (checkLandCollision(nextX, nextY)) {
    player.health = Math.max(0, player.health - 15);
    player.x -= Math.sin(player.angle) * 18;
    player.y += Math.cos(player.angle) * 18;
    player.speed = -player.speed * 0.3;

    for (let i = 0; i < 8; i++) {
      splashParticles.push({
        x: nextX, y: nextY,
        vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5,
        radius: Math.random() * 4 + 2, color: "#8d6e63", life: 25
      });
    }
  } else {
    player.x = nextX;
    player.y = nextY;
  }

  if (Math.abs(player.speed) > 0.1) {
    wakeParticles.push({
      x: player.x - Math.sin(player.angle) * 22,
      y: player.y + Math.cos(player.angle) * 22,
      radius: Math.random() * 3 + 3,
      alpha: 0.5
    });
  }

  // Ports
  player.isDocked = false;
  ports.forEach((port) => {
    if (Math.hypot(player.x - port.x, player.y - port.y) < port.radius) {
      player.isDocked = true;
      if (player.sailSetting === 0 && player.health < player.maxHealth) {
        player.health = Math.min(player.maxHealth, player.health + 0.25);
      }
    }
  });

  // Particles
  for (let i = wakeParticles.length - 1; i >= 0; i--) {
    const p = wakeParticles[i];
    p.radius += 0.1;
    p.alpha -= 0.02;
    if (p.alpha <= 0) wakeParticles.splice(i, 1);
  }
  for (let i = splashParticles.length - 1; i >= 0; i--) {
    const p = splashParticles[i];
    p.x += p.vx; p.y += p.vy; p.life--;
    if (p.life <= 0) splashParticles.splice(i, 1);
  }

  // --- COORDINATED ENCIRCLEMENT ENEMY AI ---
  enemies.forEach((enemy) => {
    if (enemy.health <= 0) return;

    let target = player;
    let minDist = Math.hypot(player.x - enemy.x, player.y - enemy.y);

    if (minDist < 1400) {
      // Calculate pincer flank coordinates around the target
      const flankOffset = 220;
      let targetX = target.x;
      let targetY = target.y;

      if (enemy.pincerRole === "PORT_PINCER") {
        targetX += Math.cos(target.angle) * flankOffset;
        targetY += Math.sin(target.angle) * flankOffset;
      } else {
        targetX -= Math.cos(target.angle) * flankOffset;
        targetY -= Math.sin(target.angle) * flankOffset;
      }

      // Desired angle to achieve broadside pincer
      const desiredAngle = Math.atan2(targetX - enemy.x, -(targetY - enemy.y)) + Math.PI / 2;
      let angleDiff = desiredAngle - enemy.angle;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      enemy.angle += angleDiff * 0.03;

      // Anti-Stranding Sensor Array (Center, Left, Right Rays)
      const rayDist = 160;
      const centerRayX = enemy.x + Math.sin(enemy.angle) * rayDist;
      const centerRayY = enemy.y - Math.cos(enemy.angle) * rayDist;
      const leftRayX = enemy.x + Math.sin(enemy.angle - 0.5) * rayDist;
      const leftRayY = enemy.y - Math.cos(enemy.angle - 0.5) * rayDist;
      const rightRayX = enemy.x + Math.sin(enemy.angle + 0.5) * rayDist;
      const rightRayY = enemy.y - Math.cos(enemy.angle + 0.5) * rayDist;

      if (checkLandCollision(centerRayX, centerRayY) || checkLandCollision(leftRayX, leftRayY) || checkLandCollision(rightRayX, rightRayY)) {
        // Hard emergency turn toward deep ocean
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

    // Coordinated Broadside Firing
    enemy.cooldown--;
    if (minDist < 520 && enemy.cooldown <= 0) {
      const isPort = Math.random() > 0.5;
      const dir = isPort ? -1 : 1;
      const flankX = Math.cos(enemy.angle) * dir;
      const flankY = Math.sin(enemy.angle) * dir;

      cannonballs.push({
        x: enemy.x + flankX * 18,
        y: enemy.y + flankY * 18,
        vx: flankX * 8.5,
        vy: flankY * 8.5,
        life: 70,
        faction: "ENEMY"
      });
      enemy.cooldown = 100;
    }
  });

  // --- ALLIED AI ---
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

    if (nearestEnemy && minD < 1200) {
      const desiredAngle = Math.atan2(nearestEnemy.x - ally.x, -(nearestEnemy.y - ally.y)) + Math.PI / 2;
      let angleDiff = desiredAngle - ally.angle;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      ally.angle += angleDiff * 0.03;

      const rayDist = 140;
      const centerRayX = ally.x + Math.sin(ally.angle) * rayDist;
      const centerRayY = ally.y - Math.cos(ally.angle) * rayDist;

      if (checkLandCollision(centerRayX, centerRayY)) {
        ally.angle += 0.12;
      } else {
        const aNextX = ally.x + Math.sin(ally.angle) * ally.speed;
        const aNextY = ally.y - Math.cos(ally.angle) * ally.speed;
        if (!checkLandCollision(aNextX, aNextY)) {
          ally.x = aNextX;
          ally.y = aNextY;
        }
      }

      ally.cooldown = (ally.cooldown || 0) - 1;
      if (minD < 500 && ally.cooldown <= 0) {
        const isPort = Math.random() > 0.5;
        const dir = isPort ? -1 : 1;
        const flankX = Math.cos(ally.angle) * dir;
        const flankY = Math.sin(ally.angle) * dir;

        cannonballs.push({
          x: ally.x + flankX * 18,
          y: ally.y + flankY * 18,
          vx: flankX * 8.5,
          vy: flankY * 8.5,
          life: 70,
          faction: "ALLY"
        });
        ally.cooldown = 100;
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
        if (enemy.health > 0 && Math.hypot(b.x - enemy.x, b.y - enemy.y) < 28) {
          enemy.health -= 20;
          b.life = 0;
        }
      });
    } else {
      if (Math.hypot(b.x - player.x, b.y - player.y) < 28) {
        player.health = Math.max(0, player.health - 12);
        b.life = 0;
      }
      allies.forEach((ally) => {
        if (ally.health > 0 && Math.hypot(b.x - ally.x, b.y - ally.y) < 28) {
          ally.health -= 15;
          b.life = 0;
        }
      });
    }

    if (b.life <= 0) cannonballs.splice(i, 1);
  }
}

// --- RENDER VISUALS ---
function drawPort(port) {
  ctx.save();
  ctx.translate(port.x, port.y);
  ctx.rotate(port.angle);

  ctx.fillStyle = "#4e342e";
  ctx.fillRect(-60, -10, 120, 20);
  ctx.fillRect(-10, -60, 20, 120);

  ctx.fillStyle = "#78909c";
  ctx.beginPath();
  ctx.arc(0, 0, 35, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d32f2f";
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, port.radius, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(76, 175, 80, 0.4)";
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.restore();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 14px Arial";
  ctx.fillText(port.name, port.x - 60, port.y - port.radius - 12);
}

function drawShip(x, y, angle, type, health, maxHealth) {
  if (health <= 0) return;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const w = 28, h = 52, hX = -w / 2, hY = -h / 2;

  ctx.fillStyle = "#111";
  ctx.fillRect(hX - 6, hY + 14, 6, 5);
  ctx.fillRect(hX - 6, hY + 32, 6, 5);
  ctx.fillRect(hX + w, hY + 14, 6, 5);
  ctx.fillRect(hX + w, hY + 32, 6, 5);

  let hullColor = "#653713";
  let deckColor = "#b8860b";
  let sailColor = "#f5f5f5";

  if (type === "ENEMY") {
    hullColor = "#4a150b";
    deckColor = "#804820";
    sailColor = "#b71c1c";
  } else if (type === "ALLY") {
    hullColor = "#1a365d";
    deckColor = "#2b6cb0";
    sailColor = "#e2e8f0";
  }

  ctx.fillStyle = hullColor;
  ctx.fillRect(hX, hY, w, h);

  ctx.beginPath();
  ctx.moveTo(hX, hY);
  ctx.lineTo(0, hY - 18);
  ctx.lineTo(hX + w, hY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = deckColor;
  ctx.fillRect(hX + 3, hY + 6, w - 6, h - 10);

  ctx.fillStyle = sailColor;
  ctx.beginPath();
  ctx.moveTo(hX - 4, hY + 20);
  ctx.quadraticCurveTo(0, hY + 28, hX + w + 4, hY + 20);
  ctx.quadraticCurveTo(0, hY + 15, hX - 4, hY + 20);
  ctx.fill();

  ctx.rotate(-angle);
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(-20, -45, 40, 6);
  ctx.fillStyle = type === "ENEMY" ? "#e53935" : "#4caf50";
  ctx.fillRect(-20, -45, (health / maxHealth) * 40, 6);

  ctx.restore();
}

function draw() {
  ctx.fillStyle = "#1e88e5";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2 - player.x, canvas.height / 2 - player.y);

  coastlinePolygons.forEach((coast) => {
    ctx.beginPath();
    coast.points.forEach((pt, index) => {
      if (index === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.closePath();
    ctx.fillStyle = coast.fill;
    ctx.fill();
    ctx.lineWidth = 14;
    ctx.strokeStyle = coast.stroke;
    ctx.stroke();
  });

  ports.forEach((port) => drawPort(port));

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

  cannonballs.forEach((b) => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#111";
    ctx.fill();
  });

  allies.forEach((a) => drawShip(a.x, a.y, a.angle, "ALLY", a.health, a.maxHealth));
  enemies.forEach((e) => drawShip(e.x, e.y, e.angle, "ENEMY", e.health, e.maxHealth));
  drawShip(player.x, player.y, player.angle, "PLAYER", player.health, player.maxHealth);

  ctx.restore();

  drawHUD();
  drawMinimap();
}

function drawHUD() {
  // Wind Box
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

  // Victory
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
    ctx.fillText("All enemy armadas vanquished from the seas.", canvas.width / 2 - 200, canvas.height / 2 + 30);
  }

  // Defeat
  if (player.health <= 0) {
    playLaMarseillaise();

    ctx.fillStyle = "rgba(0,0,0,0.88)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#e53935";
    ctx.font = "bold 36px Arial";
    ctx.fillText("SHIP SUNK - GAME OVER", canvas.width / 2 - 210, canvas.height / 2 - 20);
    ctx.fillStyle = "#4fc3f7";
    ctx.font = "italic 22px Georgia";
    ctx.fillText("La Marseillaise plays for the victorious fleet...", canvas.width / 2 - 210, canvas.height / 2 + 20);
  }
}

function drawMinimap() {
  const mapSize = 150;
  const mapX = canvas.width - mapSize - 15;
  const mapY = 15;
  const scale = 0.012;

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
