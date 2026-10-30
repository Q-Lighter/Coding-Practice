const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Player/Boat properties
const player = {
  x: 385,       // Center position
  y: 285,
  width: 24,    // Boat width
  height: 40,   // Boat length
  speed: 4,
};

// Track key presses
const keys = {};

window.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
});

window.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});

// Update boat position
function update() {
  if (keys["w"]) player.y -= player.speed; // North
  if (keys["s"]) player.y += player.speed; // South
  if (keys["a"]) player.x -= player.speed; // West
  if (keys["d"]) player.x += player.speed; // East
}

// Function to draw the boat shape
function drawBoat(x, y, w, h) {
  // 1. Boat Main Hull (Base rectangle)
  ctx.fillStyle = "#8B4513"; // Saddle Brown
  ctx.fillRect(x, y, w, h);

  // 2. Pointed Front/Bow (Triangle pointing Up)
  ctx.beginPath();
  ctx.moveTo(x, y);                   // Top-left of hull
  ctx.lineTo(x + w / 2, y - 12);      // Pointed tip above the hull
  ctx.lineTo(x + w, y);               // Top-right of hull
  ctx.closePath();
  ctx.fill();

  // 3. Wooden Deck/Cabin Detail (Inner rectangle)
  ctx.fillStyle = "#D2B48C"; // Tan/Light Wood
  ctx.fillRect(x + 4, y + 8, w - 8, h - 14);
}

// Draw everything on screen
function draw() {
  // 1. Plain Blue Ocean Background
  ctx.fillStyle = "#1e88e5"; // Ocean Blue
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Draw the boat figure
  drawBoat(player.x, player.y, player.width, player.height);
}

// Core Game Loop
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// Start the game loop
gameLoop();
