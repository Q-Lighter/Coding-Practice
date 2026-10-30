const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// --- WORLD & COAST OF ENGLAND ---
const WORLD_SIZE = 4000;

// Custom polygon paths representing the coast of England and cliffs
const englishCoastline = [
  // Main mainland landmass (A large sprawling landmass on the left/north-west)
  {
    color: "#2e7d32",
    border: "#d7ccc8", // Chalk cliffs
    points: [
      {x: -1200, y: -1200}, {x: -400, y: -1000}, {x: -200, y: -600}, 
      {x: -300, y: -200}, {x: -600, y: 100}, {x: -900, y: 400}, 
      {x: -1400, y: 200}, {x: -1600, y: -400}, {x: -1500, y: -900}
    ]
  },
  // Southern coastal peninsula (Cornwall/Channel area vibe)
  {
    color: "#33691e",
    border: "#d7ccc8",
    points: [
      {x: -200, y: 600}, {x: 200, y: 500}, {x: 500, y: 700}, 
      {x: 300, y: 1100}, {x: -100, y: 1000}, {x: -300, y: 800}
    ]
  },
  // Eastern shores (East Anglia / North Sea coast)
  {
    color: "#2e7d32",
    border: "#d7ccc8",
    points: [
      {x: 600, y: -800}, {x: 1000, y: -600}, {x: 1100, y: -100}, 
      {x: 800, y: 200}, {x: 500, y: -200}, {x: 400, y: -600}
    ]
  }
];

// Wind System
const wind = {
  angle: Math.PI / 4,
  changeTimer: 0
};

// --- PLAYER SHIP ---
const player = {
  x: 100,
  y: 0,
  width: 26,
  height: 48,
  speed: 0,
  maxSpeed: 4.2,
  angle: 0,           // Facing heading
  turnSpeed: 0.04,    // Steering pivot rate
  sailSetting: 1,     // 0 = Dropped, 1 = Half Sail, 2 = Full Sail, -1 = Reverse
  health: 100,
  maxHealth: 100,
  cooldownLeft: 0,
  cooldownRight: 0
};

// --- ENEMY SHIPS ---
const enemies = [
  {
    x: 500,
    y: -400,
    width: 26,
    height: 48,
    speed: 2.2,
    angle: Math.PI,
    health: 60,
    maxHealth: 60,
    cooldown: 0,
    respawnTimer: 0
  }
];

const cannonballs = [];
const wakeParticles = [];
const keys = {};

// Event Listeners
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  keys[k] = true;

  // Sail control with W and S
  if (k === "w") {
    if (player.sailSetting < 2) player.sailSetting++;
  }
  if (k === "s") {
    if (player.sailSetting > -1) player.sailSetting--;
  }

  // Cannon firing controls
  if (k === "j" || e.key === "ArrowLeft") fireCannons("left");
  if (k === "l" || e.key === "ArrowRight") fireCannons("right");
  if (e.key === " " || k === "k") fireCannons("both");
});

window.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});

// Fire cannons out of the literal sides (Port & Starboard)
function fireCannons(side) {
  const ballSpeed = 7.5;

  function spawnSideVolley(sideAngleOffset) {
    // Perpendicular vector relative to ship heading
    const fireAngle = player.angle + sideAngleOffset;
    
    // Spawn 2 cannonballs staggered along the hull length
    [-12, 12].forEach(hullOffset => {
      const spawnX = player.x + Math.sin(player.angle) * hullOffset + Math.cos(fireAngle) * 16;
      const spawnY = player.y - Math.cos(player.angle) * hullOffset + Math.sin(fireAngle) * 16;

      cannonballs.push({
        x: spawnX,
        y: spawnY,
        vx: Math.cos(fireAngle) * ballSpeed,
        vy: Math.sin(fireAngle) * ballSpeed,
        life: 55,
        isPlayer: true
      });
    });
  }

  if ((side === "left" || side === "both") && player.cooldownLeft <= 0) {
    spawnSideVolley(-Math.PI / 2); // Port (Left)
    player.cooldownLeft = 30;
  }
  if ((side === "right" || side === "both") && player.cooldownRight <= 0) {
    spawnSideVolley(Math.PI / 2);  // Starboard (Right)
    player.cooldownRight = 30;
  }
}

// --- UPDATE LOGIC ---
function update() {
  // Wind variation
  wind.changeTimer++;
  if (wind.changeTimer > 700) {
    wind.angle += (Math.random() - 0.5) * 0.4;
    wind.changeTimer = 0;
  }

  if (player.cooldownLeft > 0) player.cooldownLeft--;
  if (player.cooldownRight > 0) player.cooldownRight--;

  // 1. Steering & Pivoting (A and D keys)
  if (keys["a"]) player.angle -= player.turnSpeed * (player.speed / player.maxSpeed || 0.5);
  if (keys["d"]) player.angle += player.turnSpeed * (player.speed / player.maxSpeed || 0.5);

  // 2. Sail & Speed Physics
  let targetSpeed = 0;
  if (player.sailSetting === 1) targetSpeed = player.maxSpeed * 0.5;  // Half sail
  if (player.sailSetting === 2) targetSpeed = player.maxSpeed;        // Full sail
  if (player.sailSetting === -1) targetSpeed = -player.maxSpeed * 0.3; // Reverse

  // Smooth acceleration / deceleration
  player.speed += (targetSpeed - player.speed) * 0.05;

  // Move player forward/backward based on heading angle
  if (Math.abs(player.speed) > 0.1) {
    player.x += Math.sin(player.angle) * player.speed;
    player.y -= Math.cos(player.angle) * player.speed;

    // Wake trail
    wakeParticles.push({
      x: player.x - Math.sin(player.angle) * 20,
      y: player.y + Math.cos(player.angle) * 20,
      radius: Math.random() * 3 + 3,
      alpha: 0.5
    });
  }

  // Update wake particles
  for (let i = wakeParticles.length - 1; i >= 0; i--) {
    const p = wakeParticles[i];
    p.radius += 0.12;
    p.alpha -= 0.02;
    if (p.alpha <= 0) wakeParticles.splice(i, 1);
  }

  // 3. Enemy AI & Respawning
  enemies.forEach((enemy) => {
    if (enemy.health <= 0) {
      // Handle respawn timer
      enemy.respawnTimer++;
      if (enemy.respawnTimer > 250) {
        // Respawn far away from player
        const angleAway = Math.random() * Math.PI * 2;
        enemy.x = player.x + Math.cos(angleAway) * 800;
        enemy.y = player.y + Math.sin(angleAway) * 800;
        enemy.health = enemy.maxHealth;
        enemy.respawnTimer = 0;
      }
      return;
    }

    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 650) {
      const targetAngle = Math.atan2(dx, -dy);
      // Pivot enemy toward player
      let angleDiff = targetAngle - enemy.angle;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      enemy.angle += angleDiff * 0.03;

      enemy.x += Math.sin(enemy.angle) * enemy.speed;
      enemy.y -= Math.cos(enemy.angle) * enemy.speed;
    }

    // Enemy Cannons
    enemy.cooldown--;
    if (dist < 320 && enemy.cooldown <= 0 && enemy.health > 0) {
      const sideOffset = Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2;
      const fireAngle = enemy.angle + sideOffset;
      cannonballs.push({
        x: enemy.x + Math.cos(fireAngle) * 15,
        y: enemy.y + Math.sin(fireAngle) * 15,
        vx: Math.cos(fireAngle) * 6,
        vy: Math.sin(fireAngle) * 6,
        life: 45,
        isPlayer: false
      });
      enemy.cooldown = 100;
    }
  });

  // 4. Cannonballs collision update
  for (let i = cannonballs.length - 1; i >= 0; i--) {
    const b = cannonballs[i];
    b.x += b.vx;
    b.y += b.vy;
    b.life--;

    if (b.isPlayer) {
      enemies.forEach((enemy) => {
        if (enemy.health > 0 && Math.hypot(b.x - enemy.x, b.y - enemy.y) < 25) {
          enemy.health -= 15;
          b.life = 0;
        }
      });
    } else {
      if (Math.hypot(b.x - player.x, b.y - player.y) < 25) {
        player.health = Math.max(0, player.health - 10);
        b.life = 0;
      }
    }

    if (b.life <= 0) cannonballs.splice(i, 1);
  }
}

// --- RENDER FUNCTIONS ---
function calculateSailCurve(shipAngle) {
  const facingVectorX = Math.sin(shipAngle);
  const facingVectorY = -Math.cos(shipAngle);
  const windVectorX = Math.cos(wind.angle);
  const windVectorY = Math.sin(wind.angle);
  const dot = facingVectorX * windVectorX + facingVectorY * windVectorY;

  if (player.sailSetting === 0) return { belly: 0, opacity: 0.3 }; // Dropped
  if (dot < -0.3) return { belly: 2, opacity: 0.6 }; // Headwind flutter
  return { belly: (dot + 1.2) * (player.sailSetting === 2 ? 9 : 5), opacity: 1.0 };
}

function drawShip(x, y, angle, isEnemy, health, maxHealth) {
  if (health <= 0) return; // Don't draw destroyed ships waiting to respawn

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const w = 26;
  const h = 48;
  const hX = -w / 2;
  const hY = -h / 2;

  // Side Cannons
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

  // Sails
  const sailStyle = calculateSailCurve(angle);
  if (player.sailSetting !== 0 || !isEnemy) {
    ctx.fillStyle = isEnemy ? `rgba(180, 40, 40, ${sailStyle.opacity})` : `rgba(245, 245, 245, ${sailStyle.opacity})`;
    ctx.beginPath();
    ctx.moveTo(hX - 4, hY + 18);
    ctx.quadraticCurveTo(0, hY + 18 + sailStyle.belly, hX + w + 4, hY + 18);
    ctx.quadraticCurveTo(0, hY + 14, hX - 4, hY + 18);
    ctx.fill();
  }

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

  // 1. Draw Coast of England (Landmasses with cliffs)
  englishCoastline.forEach(coast => {
    ctx.beginPath();
    coast.points.forEach((pt, index) => {
      if (index === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.closePath();
    ctx.fillStyle = coast.color;
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = coast.border;
    ctx.stroke();
  });

  // 2. Wake Trails
  wakeParticles.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
    ctx.fill();
  });

  // 3. Cannonballs
  cannonballs.forEach(b => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#111";
    ctx.fill();
  });

  // 4. Enemies & Player
  enemies.forEach(e => drawShip(e.x, e.y, e.angle, true, e.health, e.maxHealth));
  drawShip(player.x, player.y, player.angle, false, player.health, player.maxHealth);

  ctx.restore();

  drawHUD();
  drawMinimap();
}

// UI Overlays
function drawHUD() {
  // Wind Indicator
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(15, 15, 120, 110);
  ctx.fillStyle = "#fff";
  ctx.font = "12px Arial";
  ctx.fillText("WIND DIRECTION", 22, 32);

  ctx.save();
  ctx.translate(75, 75);
  ctx.rotate(wind.angle);
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(10, 15);
  ctx.lineTo(0, 8);
  ctx.lineTo(-10, 15);
  ctx.fillStyle = "#4fc3f7";
  ctx.fill();
  ctx.restore();

  // Sail Status display
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(15, 135, 120, 50);
  ctx.fillStyle = "#fff";
  ctx.fillText("SAILS (W / S):", 25, 153);
  let sailText = "HALF SAIL";
  if (player.sailSetting === 2) sailText = "FULL SAIL";
  if (player.sailSetting === 0) sailText = "DROPPED (STOP)";
  if (player.sailSetting === -1) sailText = "REVERSE";
  ctx.fillStyle = player.sailSetting > 0 ? "#81c784" : "#e57373";
  ctx.fillText(sailText, 25, 172);

  // Controls Guide
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(15, canvas.height - 85, 220, 70);
  ctx.fillStyle = "#fff";
  ctx.fillText("CONTROLS:", 25, canvas.height - 65);
  ctx.fillText("A / D : Steer & Pivot", 25, canvas.height - 48);
  ctx.fillText("W / S : Adjust Sails (Speed)", 25, canvas.height - 32);
  ctx.fillText("J/L or Space : Port/Starboard/Both", 25, canvas.height - 15);
}

function drawMinimap() {
  const mapSize = 130;
  const mapX = canvas.width - mapSize - 15;
  const mapY = 15;
  const scale = 0.05;

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

  // Draw Coastline on Minimap
  englishCoastline.forEach(coast => {
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

  // Enemy dots
  enemies.forEach(e => {
    if (e.health > 0) {
      const ex = mapCenter + (e.x - player.x) * scale;
      const ey = mapMiddle + (e.y - player.y) * scale;
      ctx.beginPath();
      ctx.arc(ex, ey, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#ff1744";
      ctx.fill();
    }
  });

  // Player dot
  ctx.beginPath();
  ctx.arc(mapCenter, mapMiddle, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = "#29b6f6";
  ctx.fill();

  ctx.restore();
}

// Game Loop
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();
