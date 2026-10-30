const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Player/Boat properties
const player = {
  x: 400,
  y: 300,
  width: 26,
  height: 48,
  speed: 3.5,
  angle: 0 // Orientation in radians (0 = pointing UP)
};

// Array to store particle wake/foam trails
const wakeParticles = [];

// Track active keys
const keys = {};

window.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
});

window.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});

// Update boat position, rotation angle, and create wake particles
function update() {
  let moveX = 0;
  let moveY = 0;

  // Read WASD directional input
  if (keys["w"]) moveY -= 1;
  if (keys["s"]) moveY += 1;
  if (keys["a"]) moveX -= 1;
  if (keys["d"]) moveX += 1;

  // Check if player is moving
  if (moveX !== 0 || moveY !== 0) {
    // Calculate movement vector and normalize speed for diagonal movement
    const moveMagnitude = Math.hypot(moveX, moveY);
    player.x += (moveX / moveMagnitude) * player.speed;
    player.y += (moveY / moveMagnitude) * player.speed;

    // Calculate angle facing direction (Adding Math.PI / 2 points bow forward)
    player.angle = Math.atan2(moveY, moveX) + Math.PI / 2;

    // Create water wake foam particles behind the boat
    wakeParticles.push({
      x: player.x,
      y: player.y,
      radius: Math.random() * 4 + 4,
      alpha: 0.6,
      sizeGrowth: 0.15
    });
  }

  // Update existing wake particles (fade & expand over time)
  for (let i = wakeParticles.length - 1; i >= 0; i--) {
    const p = wakeParticles[i];
    p.radius += p.sizeGrowth;
    p.alpha -= 0.015;

    // Remove invisible particles from memory
    if (p.alpha <= 0) {
      wakeParticles.splice(i, 1);
    }
  }
}

// Draw water wake behind the boat
function drawWake() {
  for (const p of wakeParticles) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
    ctx.fill();
    ctx.restore();
  }
}

// Draw the detailed boat with cannons and sails
function drawBoat() {
  ctx.save();
  
  // Translate coordinate space to boat center, then rotate canvas
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);

  const w = player.width;
  const h = player.height;
  const hX = -w / 2;
  const hY = -h / 2;

  // 1. CANNONS (Drawn underneath the hull)
  ctx.fillStyle = "#111111"; // Iron Black
  // Left side cannons (Port)
  ctx.fillRect(hX - 4, hY + 14, 6, 4);
  ctx.fillRect(hX - 4, hY + 28, 6, 4);
  // Right side cannons (Starboard)
  ctx.fillRect(hX + w - 2, hY + 14, 6, 4);
  ctx.fillRect(hX + w - 2, hY + 28, 6, 4);

  // 2. MAIN HULL (Brown Base)
  ctx.fillStyle = "#653713";
  ctx.fillRect(hX, hY, w, h);

  // 3. POINTED BOW (Front of boat)
  ctx.beginPath();
  ctx.moveTo(hX, hY);
  ctx.lineTo(0, hY - 16);
  ctx.lineTo(hX + w, hY);
  ctx.closePath();
  ctx.fill();

  // 4. DECK (Inner wood color)
  ctx.fillStyle = "#b8860b";
  ctx.fillRect(hX + 3, hY + 6, w - 6, h - 10);

  // 5. SAILS & MAST
  // Wooden Yardarm / Crossbeam
  ctx.fillStyle = "#3d2314";
  ctx.fillRect(hX - 6, hY + 16, w + 12, 3);

  // Main White Sail
  ctx.fillStyle = "#f5f5f5";
  ctx.beginPath();
  ctx.moveTo(hX - 5, hY + 17);
  ctx.quadraticCurveTo(0, hY + 25, hX + w + 5, hY + 17);
  ctx.quadraticCurveTo(0, hY + 12, hX - 5, hY + 17);
  ctx.fill();
  ctx.strokeStyle = "#cccccc";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Center Mast Cap
  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.arc(0, hY + 17, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// Render Loop
function draw() {
  // 1. Clear Ocean Background
  ctx.fillStyle = "#1e88e5";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Render Wake Particle Trails
  drawWake();

  // 3. Render Boat
  drawBoat();
}

// Game Loop
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();
