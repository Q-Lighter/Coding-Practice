const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// --- ENLARGED ENGLAND & WALES COASTLINE ---
const coastlinePolygons = [
  {
    fill: "#2e7d32",
    stroke: "#d7ccc8",
    points: [
      { x: -1500, y: 1400 }, { x: -1360, y: 1360 }, { x: -1100, y: 1240 }, 
      { x: -760, y: 1100 },  { x: -400, y: 980 },   { x: -160, y: 940 },   
      { x: 0, y: 920 },      { x: 240, y: 920 },    { x: 560, y: 900 },    
      { x: 840, y: 820 },    { x: 1040, y: 700 },   { x: 1000, y: 500 },   
      { x: 760, y: 400 },    { x: 720, y: 240 },    { x: 960, y: 60 },     
      { x: 1100, y: -160 },  { x: 960, y: -360 },   { x: 640, y: -420 },   
      { x: 560, y: -260 },   { x: 480, y: -440 },   { x: 440, y: -640 },   
      { x: 520, y: -960 },   { x: 360, y: -1200 },  { x: -200, y: -1400 }, 
      { x: -800, y: -1000 }, { x: -1000, y: -760 }, { x: -1240, y: -500 }, 
      { x: -1160, y: -240 }, { x: -1360, y: 0 },     { x: -1100, y: 240 },  
      { x: -760, y: 360 },   { x: -700, y: 560 },   { x: -1000, y: 700 },  
      { x: -1360, y: 1040 }
    ]
  },
  {
    fill: "#33691e",
    stroke: "#d7ccc8",
    points: [
      { x: 20, y: 970 }, { x: 100, y: 960 }, { x: 160, y: 1010 }, { x: 80, y: 1040 }
    ]
  }
];

// Coastal Repair Ports
const ports = [
  { name: "Plymouth Sound", x: -1100, y: 1280, radius: 80 },
  { name: "Portsmouth Harbor", x: 240, y: 960, radius: 80 },
  { name: "Dover Straits", x: 1040, y: 740, radius: 80 },
  { name: "Bristol Docks", x: -700, y: 600, radius: 80 }
];

// Wind System
const wind = { angle: Math.PI / 4, changeTimer: 0 };

// --- PLAYER SHIP ---
const player = {
  x: -300,
  y: 1300,
  width: 26,
  height: 48,
  speed: 0,
  maxSpeed: 2.2,
  angle: Math.PI / 2,
  turnSpeed: 0.04,
  sailSetting: 1,
  health: 100,
  maxHealth: 100,
  cooldownLeft: 0,
  cooldownRight: 0,
  isDocked: false
};

// --- FLEETS (Allies and Enemies with Structured Formations) ---
const enemies = [];
const allies = [];

// Advanced Formation Generator (Line Ahead & Column Squadrons)
function spawnSquadron(centerX, centerY, faction, formationType) {
  const count = 4; // 4 ships per fleet squadron
  const spacingX = 50;
  const spacingY = 90;

  for (let i = 0; i < count; i++) {
    let offsetX = 0;
    let offsetY = 0;

    if (formationType === "LINE_AHEAD") {
      // Classic single-file combat line
      offsetY = i * spacingY;
    } else if (formationType === "COLUMN_ABREAST") {
      // Parallel broadside column
      offsetX = i * spacingX;
      offsetY = (i % 2) * 35;
    }

    const ship = {
      x: centerX + offsetX,
      y: centerY + offsetY,
      width: 26,
      height: 48,
      speed: 1.15,
      angle: faction === "ENEMY" ? Math.PI : 0,
      health: 80,
      maxHealth: 80,
      cooldown: i * 25
    };

    if (faction === "ENEMY") enemies.push(ship);
    else allies.push(ship);
  }
}

// Spawn multiple squadrons across the map
spawnSquadron(350, 1150, "ENEMY", "LINE_AHEAD");
spawnSquadron(900, -200, "ENEMY", "COLUMN_ABREAST");
spawnSquadron(1250, 350, "ENEMY", "LINE_AHEAD");

spawnSquadron(-450, 1150, "ALLIED", "LINE_AHEAD");
spawnSquadron(-200, 950, "ALLIED", "COLUMN_ABREAST");

const cannonballs = [];
const wakeParticles = [];
const splashParticles = [];
const keys = {};
let anthemHasPlayed = false;

// Audio Context for Procedural "Rule, Britannia!" Anthem
let audioCtx = null;
function playRuleBritanniaAnthem() {
  if (anthemHasPlayed) return;
  anthemHasPlayed = true;

  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // Notes corresponding to the heroic phrase "Rule, Britannia, Britannia, rule the waves!"
    const melody = [
      { f: 392.00, dur: 0.4 }, // G4
      { f: 493.88, dur: 0.4 }, // B4
      { f: 587.33, dur: 0.8 }, // D5
      { f: 587.33, dur: 0.4 }, // D5
      { f: 659.25, dur: 0.4 }, // E5
      { f: 587.33, dur: 0.8 }, // D5
      { f: 523.25, dur: 0.4 }, // C5
      { f: 493.88, dur: 0.4 }, // B4
      { f: 440.00, dur: 0.8 }, // A4
      { f: 587.33, dur: 0.8 }  // D5
    ];

    let time = audioCtx.currentTime + 0.1;
    melody.forEach((note) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(note.f, time);

      gain.gain.setValueAtTime(0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + note.dur - 0.05);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(time);
      osc.stop(time + note.dur);
      time += note.dur;
    });
  } catch (e) {
    console.log("Audio context prevented or not supported.");
  }
}

// Event Listeners
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

// Perpendicular Broadside Cannons
function fireCannons(side) {
  const ballSpeed = 6.5;

  function spawnSideVolley(sideAngleOffset) {
    const fireAngle = player.angle + sideAngleOffset;
    [-10, 10].forEach((hullOffset) => {
      const spawnX = player.x + Math.sin(player.angle) * hullOffset + Math.cos(fireAngle) * 16;
      const spawnY = player.y - Math.cos(player.angle) * hullOffset + Math.sin(fireAngle) * 16;

      cannonballs.push({
        x: spawnX,
        y: spawnY,
        vx: Math.cos(fireAngle) * ballSpeed,
        vy: Math.sin(fireAngle) * ballSpeed,
        life: 60,
        isPlayer: true,
        faction: "PLAYER"
      });
    });
  }

  if ((side === "left" || side === "both") && player.cooldownLeft <= 0) {
    spawnSideVolley(-Math.PI / 2);
    player.cooldownLeft = 35;
  }
  if ((side === "right" || side === "both") && player.cooldownRight <= 0) {
    spawnSideVolley(Math.PI / 2);
    player.cooldownRight = 35;
  }
}

// Point-in-Polygon Land Collision Check
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
    player.x -= Math.sin(player.angle) * 15;
    player.y += Math.cos(player.angle) * 15;
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
      x: player.x - Math.sin(player.angle) * 20,
      y: player.y + Math.cos(player.angle) * 20,
      radius: Math.random() * 3 + 3,
      alpha: 0.5
    });
  }

  // Port repairs
  player.isDocked = false;
  ports.forEach((port) => {
    if (Math.hypot(player.x - port.x, player.y - port.y) < port.radius) {
      player.isDocked = true;
      if (player.sailSetting === 0 && player.health < player.maxHealth) {
        player.health = Math.min(player.maxHealth, player.health + 0.2);
      }
    }
  });

  // Particle updates
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

  // --- ENEMY AI ---
  enemies.forEach((enemy) => {
    if (enemy.health <= 0) return;

    // Find nearest target (Player or Allies)
    let target = player;
    let minDist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    allies.forEach(ally => {
      if (ally.health > 0) {
        const d = Math.hypot(ally.x - enemy.x, ally.y - enemy.y);
        if (d < minDist) {
          minDist = d;
          target = ally;
        }
      }
    });

    if (minDist < 900) {
      const desiredAngle = Math.atan2(target.x - enemy.x, -(target.y - enemy.y)) + Math.PI / 2;
      let angleDiff = desiredAngle - enemy.angle;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      enemy.angle += angleDiff * 0.02;

      const eNextX = enemy.x + Math.sin(enemy.angle) * enemy.speed;
      const eNextY = enemy.y - Math.cos(enemy.angle) * enemy.speed;

      if (checkLandCollision(eNextX, eNextY)) {
        enemy.angle += 0.25;
      } else {
        enemy.x = eNextX;
        enemy.y = eNextY;
      }
    }

    enemy.cooldown--;
    if (minDist < 350 && enemy.cooldown <= 0) {
      const sideOffset = Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2;
      const fireAngle = enemy.angle + sideOffset;
      cannonballs.push({
        x: enemy.x + Math.cos(fireAngle) * 16,
        y: enemy.y + Math.sin(fireAngle) * 16,
        vx: Math.cos(fireAngle) * 5.5,
        vy: Math.sin(fireAngle) * 5.5,
        life: 55,
        isPlayer: false,
        faction: "ENEMY"
      });
      enemy.cooldown = 130;
    }
  });

  // --- ALLIED AI ---
  allies.forEach((ally) => {
    if (ally.health <= 0) return;

    // Find nearest enemy
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

    if (nearestEnemy && minD < 800) {
      const desiredAngle = Math.atan2(nearestEnemy.x - ally.x, -(nearestEnemy.y - ally.y)) + Math.PI / 2;
      let angleDiff = desiredAngle - ally.angle;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      ally.angle += angleDiff * 0.025;

      const aNextX = ally.x + Math.sin(ally.angle) * ally.speed;
      const aNextY = ally.y - Math.cos(ally.angle) * ally.speed;

      if (!checkLandCollision(aNextX, aNextY)) {
        ally.x = aNextX;
        ally.y = aNextY;
      }

      ally.cooldown = (ally.cooldown || 0) - 1;
      if (minD < 320 && ally.cooldown <= 0) {
        const sideOffset = Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2;
        const fireAngle = ally.angle + sideOffset;
        cannonballs.push({
          x: ally.x + Math.cos(fireAngle) * 16,
          y: ally.y + Math.sin(fireAngle) * 16,
          vx: Math.cos(fireAngle) * 5.5,
          vy: Math.sin(fireAngle) * 5.5,
          life: 55,
          isPlayer: true,
          faction: "ALLY"
        });
        ally.cooldown = 120;
      }
    } else {
      // Formation escort near player
      const targetX = player.x - 100;
      const targetY = player.y + 100;
      const dx = targetX - ally.x;
      const dy = targetY - ally.y;
      if (Math.hypot(dx, dy) > 150) {
        const desiredAngle = Math.atan2(dx, -dy) + Math.PI / 2;
        ally.angle += (desiredAngle - ally.angle) * 0.02;
        ally.x += Math.sin(ally.angle) * ally.speed;
        ally.y -= Math.cos(ally.angle) * ally.speed;
      }
    }
  });

  // Cannonballs collision
  for (let i = cannonballs.length - 1; i >= 0; i--) {
    const b = cannonballs[i];
    b.x += b.vx; b.y += b.vy; b.life--;

    if (checkLandCollision(b.x, b.y)) {
      b.life = 0;
      continue;
    }

    if (b.faction === "PLAYER" || b.faction === "ALLY") {
      enemies.forEach((enemy) => {
        if (enemy.health > 0 && Math.hypot(b.x - enemy.x, b.y - enemy.y) < 25) {
          enemy.health -= 20;
          b.life = 0;
        }
      });
    } else {
      // Enemy cannonball hitting player
      if (Math.hypot(b.x - player.x, b.y - player.y) < 25) {
        player.health = Math.max(0, player.health - 12);
        b.life = 0;
      }
      // Enemy cannonball hitting allies
      allies.forEach((ally) => {
        if (ally.health > 0 && Math.hypot(b.x - ally.x, b.y - ally.y) < 25) {
          ally.health -= 15;
          b.life = 0;
        }
      });
    }

    if (b.life <= 0) cannonballs.splice(i, 1);
  }
}

// --- RENDER FUNCTIONS ---
function drawShip(x, y, angle, type, health, maxHealth) {
  if (health <= 0) return;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const w = 26, h = 48, hX = -w / 2, hY = -h / 2;

  ctx.fillStyle = "#111";
  ctx.fillRect(hX - 5, hY + 12, 5, 5);
  ctx.fillRect(hX - 5, hY + 28, 5, 5);
  ctx.fillRect(hX + w, hY + 12, 5, 5);
  ctx.fillRect(hX + w, hY + 28, 5, 5);

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
  ctx.lineTo(0, hY - 16);
  ctx.lineTo(hX + w, hY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = deckColor;
  ctx.fillRect(hX + 3, hY + 6, w - 6, h - 10);

  ctx.fillStyle = sailColor;
  ctx.beginPath();
  ctx.moveTo(hX - 4, hY + 18);
  ctx.quadraticCurveTo(0, hY + 26, hX + w + 4, hY + 18);
  ctx.quadraticCurveTo(0, hY + 14, hX - 4, hY + 18);
  ctx.fill();

  ctx.rotate(-angle);
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(-20, -42, 40, 6);
  ctx.fillStyle = type === "ENEMY" ? "#e53935" : "#4caf50";
  ctx.fillRect(-20, -42, (health / maxHealth) * 40, 6);

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
    ctx.lineWidth = 12;
    ctx.strokeStyle = coast.stroke;
    ctx.stroke();
  });

  ports.forEach((port) => {
    ctx.beginPath();
    ctx.arc(port.x, port.y, port.radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(76, 175, 80, 0.25)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#4caf50";
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px Arial";
    ctx.fillText(port.name, port.x - 45, port.y - port.radius - 8);
  });

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

  // Docking status
  if (player.isDocked) {
    ctx.fillStyle = "rgba(46, 125, 50, 0.85)";
    ctx.fillRect(canvas.width / 2 - 130, 20, 260, 40);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px Arial";
    ctx.fillText(player.sailSetting === 0 ? "REPAIRING HULL AT PORT..." : "DROP SAILS (S) TO REPAIR", canvas.width / 2 - 110, 45);
  }

  // Check Victory Condition
  const allEnemiesDefeated = enemies.length > 0 && enemies.every(e => e.health <= 0);
  if (allEnemiesDefeated) {
    playRuleBritanniaAnthem();

    ctx.fillStyle = "rgba(10, 25, 50, 0.88)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffcc00";
    ctx.font = "bold 44px Georgia";
    ctx.fillText("RULE BRITANNIA!", canvas.width / 2 - 180, canvas.height / 2 - 20);
    ctx.fillStyle = "#fff";
    ctx.font = "20px Arial";
    ctx.fillText("All enemy fleets have been vanquished from the seas.", canvas.width / 2 - 230, canvas.height / 2 + 30);
  }

  // Game Over
  if (player.health <= 0) {
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#e53935";
    ctx.font = "bold 36px Arial";
    ctx.fillText("SHIP SUNK - GAME OVER", canvas.width / 2 - 210, canvas.height / 2);
    ctx.fillStyle = "#fff";
    ctx.font = "16px Arial";
    ctx.fillText("Refresh the page to restart", canvas.width / 2 - 100, canvas.height / 2 + 40);
  }
}

function drawMinimap() {
  const mapSize = 140;
  const mapX = canvas.width - mapSize - 15;
  const mapY = 15;
  const scale = 0.025;

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
