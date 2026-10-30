const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// --- GEOGRAPHICALLY ACCURATE ENGLAND & WALES COASTLINE ---
// Accurate contours based on true geographical bearings: Southwest Peninsula (Cornwall/Devon),
// Plymouth Sound, Solent & Isle of Wight, Sussex White Cliffs, Dover Strait, Thames Estuary,
// East Anglia bulge, the Wash, the Humber, Bristol Channel, and Welsh Coast.
const coastlinePolygons = [
  // Main England & Wales Mainland
  {
    fill: "#2e7d32",
    stroke: "#d7ccc8", // Chalk cliffs & beaches
    points: [
      { x: -750, y: 700 },  // Lands End (Cornwall)
      { x: -680, y: 680 },  // Lizard Point
      { x: -550, y: 620 },  // Falmouth / Plymouth Bay Entrance
      { x: -380, y: 550 },  // Start Point / Torbay
      { x: -200, y: 490 },  // Portland Bill peninsula
      { x: -80,  y: 470 },  // Poole / Christchurch
      { x: 0,    y: 460 },  // The Solent / Southampton Water Entrance
      { x: 120,  y: 460 },  // Portsmouth / Chichester
      { x: 280,  y: 450 },  // Beachy Head (Sussex)
      { x: 420,  y: 410 },  // Dungeness spit
      { x: 520,  y: 350 },  // White Cliffs of Dover
      { x: 500,  y: 250 },  // North Foreland (Kent)
      { x: 380,  y: 200 },  // Thames Estuary (South Bank)
      { x: 360,  y: 120 },  // Thames Estuary (North Bank / Essex)
      { x: 480,  y: 30 },   // Harwich / Suffolk Coast
      { x: 550,  y: -80 },  // Lowestoft (Easternmost point)
      { x: 480,  y: -180 }, // Norfolk North Coast (Cromer)
      { x: 320,  y: -210 }, // The Wash Estuary (East side)
      { x: 280,  y: -130 }, // Deep Wash Recess
      { x: 240,  y: -220 }, // Lincolnshire Coast
      { x: 220,  y: -320 }, // Spurn Head / Humber Estuary entrance
      { x: 260,  y: -480 }, // Flamborough Head
      { x: 180,  y: -600 }, // Whitby / Teesmouth
      // --- Inland Landmass Interior (Wales, West & North) ---
      { x: -100, y: -700 }, // North England / Border interior
      { x: -400, y: -500 }, // Morecambe Bay / Liverpool Bay
      { x: -500, y: -380 }, // Anglesey / North Wales
      { x: -620, y: -250 }, // Lleyn Peninsula
      { x: -580, y: -120 }, // Cardigan Bay (Wales)
      { x: -680, y: 0 },    // St David's Head (Pembrokeshire)
      { x: -550, y: 120 },  // Gower / Swansea Bay
      { x: -380, y: 180 },  // Cardiff / Severn Estuary (North Shore)
      { x: -350, y: 280 },  // Bristol / Severn Estuary (South Shore)
      { x: -500, y: 350 },  // North Devon (Barnstaple Bay)
      { x: -680, y: 520 }   // North Cornwall (Bude / Padstow)
    ]
  },
  // Isle of Wight
  {
    fill: "#33691e",
    stroke: "#d7ccc8",
    points: [
      { x: 10,  y: 485 }, // The Needles (West)
      { x: 50,  y: 480 }, // Cowes (North)
      { x: 80,  y: 505 }, // Culver Cliff (East)
      { x: 40,  y: 520 }  // St Catherine's Point (South)
    ]
  }
];

// --- HISTORICAL ENGLISH COASTAL PORTS & REPAIR DOCKS ---
const ports = [
  { name: "Plymouth Sound", x: -550, y: 640, radius: 55 },
  { name: "Portsmouth Harbor", x: 120, y: 480, radius: 55 },
  { name: "Dover Straits", x: 520, y: 370, radius: 55 },
  { name: "Bristol Docks", x: -350, y: 300, radius: 55 }
];

// Wind System
const wind = { angle: Math.PI / 4, changeTimer: 0 };

// --- PLAYER SHIP ---
const player = {
  x: -150,
  y: 650, // Starts off the English Channel
  width: 26,
  height: 48,
  speed: 0,
  maxSpeed: 4.2,
  angle: Math.PI / 2, // Facing East up the Channel
  turnSpeed: 0.038,
  sailSetting: 1, // 0 = Dropped, 1 = Half Sail, 2 = Full Sail, -1 = Reverse
  health: 100,
  maxHealth: 100,
  cooldownLeft: 0,
  cooldownRight: 0,
  isDocked: false
};

// --- MILITARY FLEET FORMATIONS & STRATEGY ---
// Enemies spawn in coordinated military formations (Line Ahead / Echelon)
const enemies = [];

function spawnMilitaryFleet(centerX, centerY, formationType) {
  const fleetSize = 3;
  const shipSpacing = 70;

  for (let i = 0; i < fleetSize; i++) {
    let offsetX = 0;
    let offsetY = 0;

    if (formationType === "LINE_AHEAD") {
      // Straight line of battle behind the flagship
      offsetX = 0;
      offsetY = i * shipSpacing;
    } else if (formationType === "ECHELON") {
      // Diagonal tactical line
      offsetX = i * (shipSpacing * 0.7);
      offsetY = i * (shipSpacing * 0.7);
    }

    enemies.push({
      id: Math.random(),
      x: centerX + offsetX,
      y: centerY + offsetY,
      width: 26,
      height: 48,
      speed: 2.1,
      angle: Math.PI,
      health: 70,
      maxHealth: 70,
      cooldown: i * 20, // Staggered firing volleys
      role: i === 0 ? "FLAGSHIP" : "ESCORT",
      formationOffsetX: offsetX,
      formationOffsetY: offsetY,
      respawnTimer: 0
    });
  }
}

// Spawn initial fleets off the Channel and North Sea
spawnMilitaryFleet(200, 600, "LINE_AHEAD");
spawnMilitaryFleet(600, -50, "ECHELON");

// Projectiles & Particles
const cannonballs = [];
const wakeParticles = [];
const splashParticles = [];
const keys = {};

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

// --- PERPENDICULAR BROADSIDE CANNON FIRING ---
function fireCannons(side) {
  const ballSpeed = 8.0;

  function spawnSideVolley(sideAngleOffset) {
    // Perpendicular angle relative to the ship's current heading
    const fireAngle = player.angle + sideAngleOffset;

    // Fire 2 broadside cannonballs out of the flanks
    [-10, 10].forEach((hullOffset) => {
      const spawnX = player.x + Math.sin(player.angle) * hullOffset + Math.cos(fireAngle) * 16;
      const spawnY = player.y - Math.cos(player.angle) * hullOffset + Math.sin(fireAngle) * 16;

      cannonballs.push({
        x: spawnX,
        y: spawnY,
        vx: Math.cos(fireAngle) * ballSpeed,
        vy: Math.sin(fireAngle) * ballSpeed,
        life: 50,
        isPlayer: true
      });
    });
  }

  if ((side === "left" || side === "both") && player.cooldownLeft <= 0) {
    spawnSideVolley(-Math.PI / 2); // Port (Left)
    player.cooldownLeft = 28;
  }
  if ((side === "right" || side === "both") && player.cooldownRight <= 0) {
    spawnSideVolley(Math.PI / 2); // Starboard (Right)
    player.cooldownRight = 28;
  }
}

// --- RAY-CASTING POINT-IN-POLYGON (LAND COLLISION) ---
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
    if (isPointInPolygon({ x, y }, coast.points)) {
      return true;
    }
  }
  return false;
}

// --- UPDATE GAME LOGIC ---
function update() {
  if (player.health <= 0) return; // Game Over state

  // 1. Wind Shift Timer
  wind.changeTimer++;
  if (wind.changeTimer > 800) {
    wind.angle += (Math.random() - 0.5) * 0.3;
    wind.changeTimer = 0;
  }

  if (player.cooldownLeft > 0) player.cooldownLeft--;
  if (player.cooldownRight > 0) player.cooldownRight--;

  // 2. Steering & Pivot Logic
  if (keys["a"]) player.angle -= player.turnSpeed * (Math.abs(player.speed) / player.maxSpeed || 0.5);
  if (keys["d"]) player.angle += player.turnSpeed * (Math.abs(player.speed) / player.maxSpeed || 0.5);

  // 3. Acceleration & Speed Physics
  let targetSpeed = 0;
  if (player.sailSetting === 1) targetSpeed = player.maxSpeed * 0.5;
  if (player.sailSetting === 2) targetSpeed = player.maxSpeed;
  if (player.sailSetting === -1) targetSpeed = -player.maxSpeed * 0.3;

  player.speed += (targetSpeed - player.speed) * 0.04;

  // Calculate Next Prospective Position
  const nextX = player.x + Math.sin(player.angle) * player.speed;
  const nextY = player.y - Math.cos(player.angle) * player.speed;

  // 4. Land Collision Check (Crashing Mechanics)
  if (checkLandCollision(nextX, nextY)) {
    // Collision impact: damage hull, bounce back, zero speed
    player.health = Math.max(0, player.health - 12);
    player.x -= Math.sin(player.angle) * 15;
    player.y += Math.cos(player.angle) * 15;
    player.speed = -player.speed * 0.4; // Bounce pushback

    // Splinter / Crash particle explosion
    for (let i = 0; i < 10; i++) {
      splashParticles.push({
        x: nextX,
        y: nextY,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        radius: Math.random() * 4 + 2,
        color: "#8d6e63", // Wooden debris
        life: 30
      });
    }
  } else {
    player.x = nextX;
    player.y = nextY;
  }

  // Wake Trail Generation
  if (Math.abs(player.speed) > 0.2) {
    wakeParticles.push({
      x: player.x - Math.sin(player.angle) * 20,
      y: player.y + Math.cos(player.angle) * 20,
      radius: Math.random() * 3 + 3,
      alpha: 0.5
    });
  }

  // 5. Port Repair & Docking Check
  player.isDocked = false;
  ports.forEach((port) => {
    const dist = Math.hypot(player.x - port.x, player.y - port.y);
    if (dist < port.radius) {
      player.isDocked = true;
      if (player.sailSetting === 0 && player.health < player.maxHealth) {
        player.health = Math.min(player.maxHealth, player.health + 0.15); // Repair hull
      }
    }
  });

  // Particle updates
  for (let i = wakeParticles.length - 1; i >= 0; i--) {
    const p = wakeParticles[i];
    p.radius += 0.12;
    p.alpha -= 0.02;
    if (p.alpha <= 0) wakeParticles.splice(i, 1);
  }

  for (let i = splashParticles.length - 1; i >= 0; i--) {
    const p = splashParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    if (p.life <= 0) splashParticles.splice(i, 1);
  }

  // 6. Military Enemy AI & Formation Tactical Behavior
  enemies.forEach((enemy) => {
    if (enemy.health <= 0) {
      enemy.respawnTimer++;
      if (enemy.respawnTimer > 300) {
        enemy.x = player.x + (Math.random() > 0.5 ? 800 : -800);
        enemy.y = player.y + (Math.random() > 0.5 ? 800 : -800);
        enemy.health = enemy.maxHealth;
        enemy.respawnTimer = 0;
      }
      return;
    }

    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy);

    // Tactical Flanking AI: Turn into line-of-battle perpendicular to player
    if (dist < 600) {
      const desiredAngle = Math.atan2(dx, -dy) + Math.PI / 2; // Broadside stance
      let angleDiff = desiredAngle - enemy.angle;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      enemy.angle += angleDiff * 0.025;

      const eNextX = enemy.x + Math.sin(enemy.angle) * enemy.speed;
      const eNextY = enemy.y - Math.cos(enemy.angle) * enemy.speed;

      if (!checkLandCollision(eNextX, eNextY)) {
        enemy.x = eNextX;
        enemy.y = eNextY;
      }
    }

    // Coordinated Enemy Broadside Volleys
    enemy.cooldown--;
    if (dist < 340 && enemy.cooldown <= 0) {
      const sideOffset = Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2;
      const fireAngle = enemy.angle + sideOffset;

      cannonballs.push({
        x: enemy.x + Math.cos(fireAngle) * 16,
        y: enemy.y + Math.sin(fireAngle) * 16,
        vx: Math.cos(fireAngle) * 6.5,
        vy: Math.sin(fireAngle) * 6.5,
        life: 50,
        isPlayer: false
      });
      enemy.cooldown = 110;
    }
  });

  // 7. Cannonball Collision Handling
  for (let i = cannonballs.length - 1; i >= 0; i--) {
    const b = cannonballs[i];
    b.x += b.vx;
    b.y += b.vy;
    b.life--;

    // Check hit on land
    if (checkLandCollision(b.x, b.y)) {
      b.life = 0;
      continue;
    }

    if (b.isPlayer) {
      enemies.forEach((enemy) => {
        if (enemy.health > 0 && Math.hypot(b.x - enemy.x, b.y - enemy.y) < 24) {
          enemy.health -= 18;
          b.life = 0;
        }
      });
    } else {
      if (Math.hypot(b.x - player.x, b.y - player.y) < 24) {
        player.health = Math.max(0, player.health - 12);
        b.life = 0;
      }
    }

    if (b.life <= 0) cannonballs.splice(i, 1);
  }
}

// --- RENDER LOGIC ---
function drawShip(x, y, angle, isEnemy, health, maxHealth) {
  if (health <= 0) return;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const w = 26;
  const h = 48;
  const hX = -w / 2;
  const hY = -h / 2;

  // Side Cannon Barrels
  ctx.fillStyle = "#111";
  ctx.fillRect(hX - 5, hY + 12, 5, 5);
  ctx.fillRect(hX - 5, hY + 28, 5, 5);
  ctx.fillRect(hX + w, hY + 12, 5, 5);
  ctx.fillRect(hX + w, hY + 28, 5, 5);

  // Hull
  ctx.fillStyle = isEnemy ? "#4a150b" : "#653713";
  ctx.fillRect(hX, hY, w, h);

  // Bow
  ctx.beginPath();
  ctx.moveTo(hX, hY);
  ctx.lineTo(0, hY - 16);
  ctx.lineTo(hX + w, hY);
  ctx.closePath();
  ctx.fill();

  // Deck
  ctx.fillStyle = isEnemy ? "#804820" : "#b8860b";
  ctx.fillRect(hX + 3, hY + 6, w - 6, h - 10);

  // Sail
  ctx.fillStyle = isEnemy ? "#b71c1c" : "#f5f5f5";
  ctx.beginPath();
  ctx.moveTo(hX - 4, hY + 18);
  ctx.quadraticCurveTo(0, hY + 26, hX + w + 4, hY + 18);
  ctx.quadraticCurveTo(0, hY + 14, hX - 4, hY + 18);
  ctx.fill();

  // Health bar
  ctx.rotate(-angle);
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(-20, -42, 40, 6);
  ctx.fillStyle = isEnemy ? "#e53935" : "#4caf50";
  ctx.fillRect(-20, -42, (health / maxHealth) * 40, 6);

  ctx.restore();
}

function draw() {
  // Clear Ocean
  ctx.fillStyle = "#1e88e5";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2 - player.x, canvas.height / 2 - player.y);

  // 1. Draw England Coastlines
  coastlinePolygons.forEach((coast) => {
    ctx.beginPath();
    coast.points.forEach((pt, index) => {
      if (index === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.closePath();
    ctx.fillStyle = coast.fill;
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = coast.stroke;
    ctx.stroke();
  });

  // 2. Draw Ports & Repair Docks
  ports.forEach((port) => {
    ctx.beginPath();
    ctx.arc(port.x, port.y, port.radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(76, 175, 80, 0.25)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#4caf50";
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px Arial";
    ctx.fillText(port.name, port.x - 40, port.y - port.radius - 8);
  });

  // 3. Particles & Trails
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

  // 4. Projectiles
  cannonballs.forEach((b) => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#111";
    ctx.fill();
  });

  // 5. Ships
  enemies.forEach((e) => drawShip(e.x, e.y, e.angle, true, e.health, e.maxHealth));
  drawShip(player.x, player.y, player.angle, false, player.health, player.maxHealth);

  ctx.restore();

  drawHUD();
  drawMinimap();
}

// UI Overlay
function drawHUD() {
  // Wind Indicator Box
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

  // Docking / Port Status
  if (player.isDocked) {
    ctx.fillStyle = "rgba(46, 125, 50, 0.85)";
    ctx.fillRect(canvas.width / 2 - 120, 20, 240, 40);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px Arial";
    ctx.fillText(player.sailSetting === 0 ? "REPAIRING HULL AT PORT..." : "DROP SAILS (S) TO REPAIR", canvas.width / 2 - 100, 45);
  }

  // Game Over Overlay
  if (player.health <= 0) {
    ctx.fillStyle = "rgba(0,0,0,0.8)";
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
  const scale = 0.045;

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

  // Coastlines on Minimap
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

  // Ports on Minimap
  ports.forEach((port) => {
    const px = mapCenter + (port.x - player.x) * scale;
    const py = mapMiddle + (port.y - player.y) * scale;
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#4caf50";
    ctx.fill();
  });

  // Enemies on Minimap
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

  // Player Dot on Minimap
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
