const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// --- WORLD & CAMERA ---
const WORLD_SIZE = 3000;

// World landmarks/islands for visual navigation anchor
const islands = [
  { x: 300, y: 400, r: 60 },
  { x: -500, y: -200, r: 90 },
  { x: 800, y: -600, r: 70 },
  { x: -700, y: 700, r: 100 }
];

// Wind System (Angle in radians)
const wind = {
  angle: Math.PI / 4, // 45 degrees northeast default
  changeTimer: 0
};

// --- PLAYER SHIP ---
const player = {
  x: 0,
  y: 0,
  width: 26,
  height: 48,
  speed: 3.8,
  angle: 0,
  health: 100,
  maxHealth: 100,
  cooldownLeft: 0,
  cooldownRight: 0
};

// --- ENEMY SHIP ---
const enemies = [
  {
    x: 300,
    y: -300,
    width: 26,
    height: 48,
    speed: 2.2,
    angle: 0,
    health: 60,
    maxHealth: 60,
    cooldown: 0
  }
];

// --- PARTICLES & PROJECTILES ---
const wakeParticles = [];
const cannonballs = [];
const explosions = [];

// Track active keys
const keys = {};

window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  keys[k] = true;

  // Cannon controls
  if (k === "j" || e.key === "ArrowLeft") fireCannons("left");
  if (k === "l" || e.key === "ArrowRight") fireCannons("right");
  if (e.key === " " || k === "k") fireCannons("both");
});

window.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});

// Fire Cannon Mechanic
function fireCannons(side) {
  const ballSpeed = 7;

  function spawnVolley(sideAngleOffset) {
    const fireAngle = player.angle + sideAngleOffset;
    // Fire 2 cannonballs per side along length of hull
    [-10, 10].forEach(offsetY => {
      const spawnX = player.x + Math.cos(player.angle) * offsetY + Math.cos(fireAngle) * 15;
      const spawnY = player.y + Math.sin(player.angle) * offsetY + Math.sin(fireAngle) * 15;

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
    spawnVolley(-Math.PI / 2); // Left / Port side
    player.cooldownLeft = 25;
  }
  if ((side === "right" || side === "both") && player.cooldownRight <= 0) {
    spawnVolley(Math.PI / 2); // Right / Starboard side
    player.cooldownRight = 25;
  }
}

// --- UPDATE LOGIC ---
function update() {
  // 1. Wind Variation
  wind.changeTimer++;
  if (wind.changeTimer > 600) {
    wind.angle += (Math.random() - 0.5) * 0.5;
    wind.changeTimer = 0;
  }

  // Cooldown ticks
  if (player.cooldownLeft > 0) player.cooldownLeft--;
  if (player.cooldownRight > 0) player.cooldownRight--;

  // 2. Player Movement
  let moveX = 0;
  let moveY = 0;

  if (keys["w"]) moveY -= 1;
  if (keys["s"]) moveY += 1;
  if (keys["a"]) moveX -= 1;
  if (keys["d"]) moveX += 1;

  if (moveX !== 0 || moveY !== 0) {
    const moveMag = Math.hypot(moveX, moveY);
    player.x += (moveX / moveMag) * player.speed;
    player.y += (moveY / moveMag) * player.speed;
    player.angle = Math.atan2(moveY, moveX) + Math.PI / 2;

    wakeParticles.push({
      x: player.x,
      y: player.y,
      radius: Math.random() * 4 + 4,
      alpha: 0.6
    });
  }

  // Update wake particles
  for (let i = wakeParticles.length - 1; i >= 0; i--) {
    const p = wakeParticles[i];
    p.radius += 0.15;
    p.alpha -= 0.015;
    if (p.alpha <= 0) wakeParticles.splice(i, 1);
  }

  // 3. Enemy AI & Movement
  enemies.forEach((enemy, index) => {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy);

    // Turn and move toward player if within range
    if (dist < 600 && dist > 100) {
      const targetAngle = Math.atan2(dy, dx) + Math.PI / 2;
      enemy.angle += (targetAngle - enemy.angle) * 0.03;
      enemy.x += Math.sin(enemy.angle) * enemy.speed;
      enemy.y -= Math.cos(enemy.angle) * enemy.speed;
    }

    // Enemy Cannon Firing AI
    enemy.cooldown--;
    if (dist < 300 && enemy.cooldown <= 0) {
      // Fire broadside at player
      const fireAngle = enemy.angle + (Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2);
      cannonballs.push({
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(fireAngle) * 6,
        vy: Math.sin(fireAngle) * 6,
        life: 45,
        isPlayer: false
      });
      enemy.cooldown = 90;
    }
  });

  // 4. Update Cannonballs & Collision Check
  for (let i = cannonballs.length - 1; i >= 0; i--) {
    const b = cannonballs[i];
    b.x += b.vx;
    b.y += b.vy;
    b.life--;

    // Hit Enemy Ships
    if (b.isPlayer) {
      enemies.forEach((enemy, eIndex) => {
        if (Math.hypot(b.x - enemy.x, b.y - enemy.y) < 25) {
          enemy.health -= 15;
          b.life = 0;
          if (enemy.health <= 0) enemies.splice(eIndex, 1);
        }
      });
    } else {
      // Hit Player Ship
      if (Math.hypot(b.x - player.x, b.y - player.y) < 25) {
        player.health = Math.max(0, player.health - 10);
        b.life = 0;
      }
    }

    if (b.life <= 0) cannonballs.splice(i, 1);
  }
}

// --- RENDER LOGIC ---

// Helper function to calculate sail offset depending on wind direction
function calculateSailCurve(shipAngle) {
  // Convert ship facing angle to wind vector angle delta
  const facingVectorX = Math.sin(shipAngle);
  const facingVectorY = -Math.cos(shipAngle);

  const windVectorX = Math.cos(wind.angle);
  const windVectorY = Math.sin(wind.angle);

  // Dot product determines if headwind (-1) or tailwind (+1)
  const dot = facingVectorX * windVectorX + facingVectorY * windVectorY;

  // Headwind (dot < -0.3): Sail flattens/feathers out
  if (dot < -0.3) return { belly: 0, opacity: 0.7 };
  
  // Tailwind / Crosswind: Sail billows outward
  return { belly: (dot + 1.2) * 8, opacity: 1.0 };
}

// Generic Ship Renderer (Used for player & enemy)
function drawShip(x, y, angle, isEnemy, health, maxHealth) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const w = 26;
  const h = 48;
  const hX = -w / 2;
  const hY = -h / 2;

  // Cannons
  ctx.fillStyle = "#111";
  ctx.fillRect(hX - 4, hY + 14, 6, 4);
  ctx.fillRect(hX - 4, hY + 28, 6, 4);
  ctx.fillRect(hX + w - 2, hY + 14, 6, 4);
  ctx.fillRect(hX + w - 2, hY + 28, 6, 4);

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

  // Dynamic Sail facing Wind
  const sailStyle = calculateSailCurve(angle);
  ctx.fillStyle = isEnemy ? `rgba(180, 40, 40, ${sailStyle.opacity})` : `rgba(245, 245, 245, ${sailStyle.opacity})`;
  
  ctx.beginPath();
  ctx.moveTo(hX - 5, hY + 17);
  ctx.quadraticCurveTo(0, hY + 17 + sailStyle.belly, hX + w + 5, hY + 17);
  ctx.quadraticCurveTo(0, hY + 12, hX - 5, hY + 17);
  ctx.fill();

  // Health bar above ship
  ctx.rotate(-angle); // Reset rotation for UI text
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(-20, -40, 40, 6);
  ctx.fillStyle = isEnemy ? "#e53935" : "#4caf50";
  ctx.fillRect(-20, -40, (health / maxHealth) * 40, 6);

  ctx.restore();
}

function draw() {
  // Clear Canvas
  ctx.fillStyle = "#1e88e5";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  // Center camera on player ship!
  ctx.translate(canvas.width / 2 - player.x, canvas.height / 2 - player.y);

  // 1. Draw Ocean Grid Lines (Gives feel of motion)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 2;
  const gridSize = 100;
  const startX = Math.floor((player.x - canvas.width) / gridSize) * gridSize;
  const endX = Math.ceil((player.x + canvas.width) / gridSize) * gridSize;
  const startY = Math.floor((player.y - canvas.height) / gridSize) * gridSize;
  const endY = Math.ceil((player.y + canvas.height) / gridSize) * gridSize;

  for (let x = startX; x < endX; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
    ctx.stroke();
  }
  for (let y = startY; y < endY; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
  }

  // 2. Draw Islands
  islands.forEach(island => {
    ctx.beginPath();
    ctx.arc(island.x, island.y, island.r, 0, Math.PI * 2);
    ctx.fillStyle = "#2e7d32"; // Sand/Palm Green
    ctx.fill();
    ctx.strokeStyle = "#fbc02d"; // Sandy shore
    ctx.lineWidth = 6;
    ctx.stroke();
  });

  // 3. Draw Water Wake Trails
  wakeParticles.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
    ctx.fill();
  });

  // 4. Draw Cannonballs
  cannonballs.forEach(b => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#111";
    ctx.fill();
  });

  // 5. Draw Enemies
  enemies.forEach(e => drawShip(e.x, e.y, e.angle, true, e.health, e.maxHealth));

  // 6. Draw Player Ship
  drawShip(player.x, player.y, player.angle, false, player.health, player.maxHealth);

  ctx.restore(); // End relative camera transform

  // --- HUD & MINIMAP (Screen space UI) ---
  drawHUD();
  drawMinimap();
}

// UI Overlay: Wind Compass & Cannon Controls
function drawHUD() {
  // Wind Indicator Box (Top Left)
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(15, 15, 110, 100);
  ctx.fillStyle = "#fff";
  ctx.font = "12px Arial";
  ctx.fillText("WIND DIRECTION", 22, 32);

  ctx.save();
  ctx.translate(70, 70);
  ctx.rotate(wind.angle);
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.lineTo(10, 15);
  ctx.lineTo(0, 8);
  ctx.lineTo(-10, 15);
  ctx.fillStyle = "#4fc3f7";
  ctx.fill();
  ctx.restore();

  // Cannon Controls Hint
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(15, canvas.height - 75, 210, 60);
  ctx.fillStyle = "#fff";
  ctx.fillText("CANNON CONTROLS:", 25, canvas.height - 55);
  ctx.fillText("J / Left Arrow : Port Side", 25, canvas.height - 38);
  ctx.fillText("L / Right Arrow: Starboard", 25, canvas.height - 24);
  ctx.fillText("Spacebar / K   : Broadside Both", 25, canvas.height - 10);
}

// Minimap Box (Top Right)
function drawMinimap() {
  const mapSize = 130;
  const mapX = canvas.width - mapSize - 15;
  const mapY = 15;
  const scale = 0.06; // Zoom level of minimap

  // Minimap Background frame
  ctx.fillStyle = "rgba(10, 25, 50, 0.85)";
  ctx.fillRect(mapX, mapY, mapSize, mapSize);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.strokeRect(mapX, mapY, mapSize, mapSize);

  ctx.save();
  // Clip drawing strictly inside minimap box
  ctx.beginPath();
  ctx.rect(mapX, mapY, mapSize, mapSize);
  ctx.clip();

  const mapCenter = mapX + mapSize / 2;
  const mapMiddle = mapY + mapSize / 2;

  // Draw Islands on Minimap
  islands.forEach(isl => {
    const ix = mapCenter + (isl.x - player.x) * scale;
    const iy = mapMiddle + (isl.y - player.y) * scale;
    ctx.beginPath();
    ctx.arc(ix, iy, isl.r * scale, 0, Math.PI * 2);
    ctx.fillStyle = "#2e7d32";
    ctx.fill();
  });

  // Draw Enemy dots
  enemies.forEach(e => {
    const ex = mapCenter + (e.x - player.x) * scale;
    const ey = mapMiddle + (e.y - player.y) * scale;
    ctx.beginPath();
    ctx.arc(ex, ey, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#ff1744"; // Red
    ctx.fill();
  });

  // Draw Player dot (Center)
  ctx.beginPath();
  ctx.arc(mapCenter, mapMiddle, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = "#29b6f6"; // Light Blue
  ctx.fill();

  ctx.restore();
}

// Main Game Loop
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();
