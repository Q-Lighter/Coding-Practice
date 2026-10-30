const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Player properties
const player = {
  x: 385,       // Starting horizontal position (center)
  y: 285,       // Starting vertical position (center)
  width: 30,    // Player size
  height: 30,
  speed: 4,     // Movement speed in pixels per frame
  color: "#0077ff" // Blue character
};

// Track key presses
const keys = {};

// Event listeners for key movements
window.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
});

window.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});

// Update player position based on active keys
function update() {
  if (keys["w"]) player.y -= player.speed; // Move Up
  if (keys["s"]) player.y += player.speed; // Move Down
  if (keys["a"]) player.x -= player.speed; // Move Left
  if (keys["d"]) player.x += player.speed; // Move Right
}

// Draw everything on the screen
function draw() {
  // 1. Draw plain green background
  ctx.fillStyle = "#2e8b57"; // Sea Green
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Draw the blue player square
  ctx.fillStyle = player.color;
  ctx.fillRect(player.x, player.y, player.width, player.height);
}

// The core Game Loop
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop); // Runs loop around 60 times per second
}

// Start the game loop
gameLoop();
