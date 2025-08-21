// Global variables
let entities = [];
let walls = [];
let bloodSplatters = [];
let spawnMode = 'human';
let humanSpeed = 2;
let zombieSpeed = 1.5;
let visionRange = 150;
let showFOV = false;
// Variables for wall drawing
let isDrawingWall = false;
let wallStartX, wallStartY;
let isPaused = false;
// Building preset variables
let selectedPreset = null;
let previewBuilding = null;
let currentRotation = 0; // Add rotation tracking (0, 90, 180, 270 degrees)

// Building preset definitions
const buildingPresets = {
  square: {
    name: 'Square Building',
    walls: [
      { x1: -50, y1: -50, x2: -20, y2: -50 },  // Top left side
      { x1: 20, y1: -50, x2: 50, y2: -50 },  // Top right side
      { x1: 50, y1: -50, x2: 50, y2: 50 },   // Right
      { x1: 50, y1: 50, x2: -50, y2: 50 },   // Bottom
      { x1: -50, y1: 50, x2: -50, y2: -30 }, // Left bottom
      { x1: -50, y1: -10, x2: -50, y2: -50 } // Left top (door gap)
    ]
  },
  rectangle: {
    name: 'Rectangle Building',
    walls: [
      { x1: -80, y1: -40, x2: 80, y2: -40 }, // Top
      { x1: 80, y1: -40, x2: 80, y2: 40 },  // Right
      { x1: 80, y1: 40, x2: -80, y2: 40 },  // Bottom
      { x1: -80, y1: 40, x2: -80, y2: 20 }, // Left bottom
      { x1: -80, y1: -20, x2: -80, y2: -40 }  // Left top (door gap)
    ]
  },
  lshape: {
    name: 'L-Shape Building',
    walls: [
      { x1: -60, y1: -60, x2: 20, y2: -60 },  // Top horizontal
      { x1: 20, y1: -60, x2: 20, y2: -20 },   // Top vertical right
      { x1: 20, y1: -20, x2: 60, y2: -20 },   // Middle horizontal
      { x1: 60, y1: -20, x2: 60, y2: 60 },    // Right vertical
      { x1: 60, y1: 60, x2: -60, y2: 60 },    // Bottom horizontal
      { x1: -60, y1: 60, x2: -60, y2: 20 },   // Left bottom
      { x1: -60, y1: -20, x2: -60, y2: -60 }    // Left top (door gap)
    ]
  },
  courtyard: {
    name: 'Courtyard Building',
    walls: [
      // Outer walls
      { x1: -70, y1: -70, x2: 70, y2: -70 },   // Top
      { x1: 70, y1: -70, x2: 70, y2: 70 },     // Right
      { x1: 70, y1: 70, x2: -70, y2: 70 },     // Bottom
      { x1: -70, y1: 70, x2: -70, y2: 20 },    // Left bottom
      { x1: -70, y1: -20, x2: -70, y2: -70 },    // Left top (door gap)
      // Inner courtyard walls
      { x1: -30, y1: -30, x2: 30, y2: -30 },   // Inner top
      { x1: 30, y1: -30, x2: 30, y2: 30 },     // Inner right
      { x1: 30, y1: 30, x2: -30, y2: 30 },     // Inner bottom
      { x1: -30, y1: 30, x2: -30, y2: -30 }    // Inner left
    ]
  }
};

class Wall {
  constructor(x1, y1, x2, y2) {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
  }

  draw() {
    push()
    stroke(0);
    strokeWeight(8);
    line(this.x1, this.y1, this.x2, this.y2);
    pop()
  }

  // Check if a line from (x1,y1) to (x2,y2) intersects this wall
  intersectsLine(x1, y1, x2, y2) {
    return this.lineIntersection(x1, y1, x2, y2, this.x1, this.y1, this.x2, this.y2);
  }

  // Line intersection algorithm
  lineIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
    let denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (denom === 0) return false; // Lines are parallel

    let t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    let u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }
}

class Entity {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.size = 10;
    this.vx = 0;
    this.vy = 0;
    this.infectionProgress = 0;
    this.spazzTimer = 0;
    this.spazzIntensity = 0;
    this.justBitten = false; // Track if just bitten to prevent multiple splatters
  }

  update() {
    if (this.type === 'human' && this.infectionProgress > 0) {
      this.infectionProgress += 0.02;
      this.spazzTimer += 0.3;
      this.spazzIntensity = sin(this.spazzTimer) * 3;

      if (this.infectionProgress >= 1) {
        this.type = 'zombie';
        this.infectionProgress = 1;
        this.spazzIntensity = 0;
      }
    } else {
      this.move();
    }
  }

  // Begin of movement logic
  move() {
    let nearbyEntities = this.getEntitiesInVision();

    let desiredVx = 0;
    let desiredVy = 0;

    // Zombie movement logic
    if (this.type === 'zombie') {
      let nearestHuman = this.findNearestHuman(nearbyEntities);
      // If a human is found and can be seen (no walls blocking), move towards them
      if (nearestHuman && this.hasLineOfSight(nearestHuman)) {
        // Calculate direction vector
        let dx = nearestHuman.x - this.x;
        let dy = nearestHuman.y - this.y;
        // dist is the distance to the human
        let dist = sqrt(dx * dx + dy * dy);
        // Normalize and scale to zombie speed
        desiredVx = (dx / dist) * zombieSpeed;
        desiredVy = (dy / dist) * zombieSpeed;
      }
      // No humans nearby or no line of sight, wander randomly 
      else {
        // Framecount check to change direction periodically (every second at 60 FPS)
        if (frameCount % 180 === 0) {
          desiredVx = random(-1, 1) * zombieSpeed * 0.3; // reduce speed for wandering
          desiredVy = random(-1, 1) * zombieSpeed * 0.3;
        }
        else {
          desiredVx = this.vx;
          desiredVy = this.vy;
        }
      }
    }
    // Human movement logic
    else if (this.type === 'human') {
      // If a zombie is nearby and can be seen (no walls blocking), move away from it
      let nearestZombie = this.findNearestZombie(nearbyEntities);
      if (nearestZombie && this.hasLineOfSight(nearestZombie)) {
        // Calculate direction vector away from zombie
        let dx = this.x - nearestZombie.x;
        let dy = this.y - nearestZombie.y;
        // dist is the distance to the zombie
        let dist = sqrt(dx * dx + dy * dy);

        // Normalize and scale to human speed
        desiredVx = (dx / dist) * humanSpeed * 0.9;
        desiredVy = (dy / dist) * humanSpeed * 0.9;
      }
      // No zombies nearby or no line of sight, wander randomly
      else {
        // Framecount check to change direction periodically (every second at 60 FPS)
        if (frameCount % 60 === 0) {
          desiredVx = random(-1, 1) * humanSpeed * 0.3; // reduce speed for wandering
          desiredVy = random(-1, 1) * humanSpeed * 0.3;
        } else {
          desiredVx = this.vx;
          desiredVy = this.vy;
        }
      }
    }

    // Apply movement
    this.vx = desiredVx;
    this.vy = desiredVy;

    let newX = this.x + this.vx + (this.spazzIntensity * random(-1, 1));
    let newY = this.y + this.vy + (this.spazzIntensity * random(-1, 1));

    // Check collision with walls
    if (this.collidesWithWalls(newX, newY)) {
      // If collision with wall, try to slide along it
      let slideX = this.x + this.vx * 0.5;
      let slideY = this.y + this.vy * 0.5;

      if (!this.collidesWithWalls(slideX, this.y)) {
        newX = slideX;
        newY = this.y;
      } else if (!this.collidesWithWalls(this.x, slideY)) {
        newX = this.x;
        newY = slideY;
      } else {
        newX = this.x;
        newY = this.y;
      }
    }

    // Constrain to canvas boundaries
    newX = constrain(newX, this.size, width - this.size);
    newY = constrain(newY, this.size, height - this.size);

    // Check for collisions with other entities at the new position
    let collisionEntity = this.checkCollision(newX, newY);

    // If no collision (collision meaning human-zombie contact), move to new position
    if (!collisionEntity) {
      this.x = newX;
      this.y = newY;
    }
    // Handle infection on collision
    else {
      this.handleInfection(collisionEntity);
      this.resolveOverlap(collisionEntity);

      // Attempt slight alternative movement to avoid sticking
      let altX = this.x + this.vx * 0.3 + random(-2, 2);
      let altY = this.y + this.vy * 0.3 + random(-2, 2);

      // Constrain alternative position within bounds
      altX = constrain(altX, this.size, width - this.size);
      altY = constrain(altY, this.size, height - this.size);

      // Check for collision at alternative position
      let altCollision = this.checkCollision(altX, altY);
      if (!altCollision && !this.collidesWithWalls(altX, altY)) {
        this.x = altX;
        this.y = altY;
      }
    }
  }
  // End of movement logic

  // Ray casting to check line of sight
  hasLineOfSight(target) {
    for (let wall of walls) {
      if (wall.intersectsLine(this.x, this.y, target.x, target.y)) {
        return false; // Wall blocks line of sight
      }
    }
    return true; // Clear line of sight
  }

  // Check if entity collides with any walls at given position
  collidesWithWalls(x, y) {
    for (let wall of walls) {
      // Check if entity's circle intersects with wall line
      if (this.circleLineIntersection(x, y, this.size, wall.x1, wall.y1, wall.x2, wall.y2)) {
        return true;
      }
    }
    return false;
  }

  // Circle-line intersection detection
  circleLineIntersection(cx, cy, radius, x1, y1, x2, y2) {
    // Vector from line start to circle center
    let dx = cx - x1;
    let dy = cy - y1;

    // Vector representing the line
    let lineX = x2 - x1;
    let lineY = y2 - y1;

    // Length squared of the line
    let lineLengthSq = lineX * lineX + lineY * lineY;

    if (lineLengthSq === 0) {
      // Line is actually a point
      return sqrt(dx * dx + dy * dy) <= radius;
    }

    // Project circle center onto line
    let t = max(0, min(1, (dx * lineX + dy * lineY) / lineLengthSq));

    // Closest point on line to circle center
    let closestX = x1 + t * lineX;
    let closestY = y1 + t * lineY;

    // Distance from circle center to closest point
    let distX = cx - closestX;
    let distY = cy - closestY;
    let distSq = distX * distX + distY * distY;

    return distSq <= radius * radius;
  }

  // Check for collision with other entities (contact between human and zombie)
  checkCollision(newX, newY) {
    // For each entity, check distance to see if overlapping
    for (let other of entities) {
      // Ignore self
      if (other !== this) {
        // distance between proposed new position and other entity
        let dist = sqrt((newX - other.x) ** 2 + (newY - other.y) ** 2);
        // Check if entities are overlapping
        if (dist < this.size + other.size) {
          return other;
        }
      }
    }
    return null;
  }

  // Handle infection logic on collision
  handleInfection(other) {
    if (
      (this.type === 'human' && other.type === 'zombie' && this.infectionProgress === 0) ||
      (this.type === 'zombie' && other.type === 'human' && other.infectionProgress === 0)
    ) {
      if (this.type === 'human' && !this.justBitten) {
        this.infectionProgress = 0.01;
        this.justBitten = true;
        // Create blood splatter at bite location
        bloodSplatters.push(new BloodSplatter(this.x, this.y));

        // Reset the flag after a short delay to prevent spam
        setTimeout(() => {
          this.justBitten = false;
        }, 1000);
      } else if (other.type === 'human' && !other.justBitten) {
        other.infectionProgress = 0.01;
        other.justBitten = true;
        // Create blood splatter at bite location
        bloodSplatters.push(new BloodSplatter(other.x, other.y));

        // Reset the flag after a short delay to prevent spam
        setTimeout(() => {
          other.justBitten = false;
        }, 1000);
      }
    }
  }

  // Resolve overlap between two entities
  resolveOverlap(other) {
    let dx = this.x - other.x;
    let dy = this.y - other.y;
    // distance between the two entities
    let dist = sqrt(dx * dx + dy * dy);
    // minDist is the minimum distance to avoid overlap
    let minDist = this.size + other.size;
    // If overlapping, push them apart
    if (dist < minDist && dist > 0) {
      let overlap = minDist - dist;
      // Move each entity half the overlap distance away from each other
      let pushX = (dx / dist) * (overlap / 2);
      let pushY = (dy / dist) * (overlap / 2);
      this.x += pushX;
      this.y += pushY;
      other.x -= pushX;
      other.y -= pushY;
    }
  }

  getEntitiesInVision() {
    let nearby = [];
    for (let other of entities) {
      if (other !== this) {
        let dist = sqrt((this.x - other.x) ** 2 + (this.y - other.y) ** 2);
        if (dist <= visionRange) {
          nearby.push(other);
        }
      }
    }
    return nearby;
  }

  findNearestHuman(entities) {
    let nearest = null;
    let minDist = Infinity;

    for (let entity of entities) {
      if (entity.type === 'human' && entity.infectionProgress === 0) {
        let dist = sqrt((this.x - entity.x) ** 2 + (this.y - entity.y) ** 2);
        if (dist < minDist) {
          minDist = dist;
          nearest = entity;
        }
      }
    }
    return nearest;
  }

  findNearestZombie(entities) {
    let nearest = null;
    let minDist = Infinity;

    for (let entity of entities) {
      if (entity.type === 'zombie') {
        let dist = sqrt((this.x - entity.x) ** 2 + (this.y - entity.y) ** 2);
        if (dist < minDist) {
          minDist = dist;
          nearest = entity;
        }
      }
    }
    return nearest;
  }

  // Draw every entity on the canvas
  draw() {
    push();
    translate(this.x, this.y);

    // Draw entity based on type and infection status
    if (this.type === 'human') {
      if (this.infectionProgress > 0) {
        // Infected human color transition from black to green
        let r = lerp(255, 0, this.infectionProgress);
        let g = lerp(255, 255, this.infectionProgress);
        let b = lerp(255, 0, this.infectionProgress);
        fill(r, g, b);
      } else {
        fill(255); // Human color
      }
    } else {
      // Zombie color
      fill(0, 255, 0);
    }
    // the color of humans is represented by

    // Draw entity circle
    stroke(0); // Border color of entity
    strokeWeight(1);
    // Draw circle representing the entity
    ellipse(0, 0, this.size * 2);

    pop();
  }

  // Draw Field of View circle
  drawFOV() {
    push();
    translate(this.x, this.y);

    // Set FOV circle style
    noFill();
    if (this.type === 'human') {
      stroke(52, 152, 219, 100); // Blue for humans
    } else {
      stroke(39, 174, 96, 100); // Green for zombies
    }
    strokeWeight(1);

    // Draw vision range circle
    ellipse(0, 0, visionRange * 2);

    pop();
  }
}

// Blood splatter class
class BloodSplatter {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.particles = [];
    this.life = 255; // Alpha value for fading
    this.fadeRate = 3;

    // Create 6-12 small blood particles
    let particleCount = random(6, 12);
    for (let i = 0; i < particleCount; i++) {
      this.particles.push({
        x: x + random(-5, 5),
        y: y + random(-5, 5),
        vx: random(-2, 2),
        vy: random(-2, 2),
        size: random(1, 3),
        life: 250
      });
    }
  }

  update() {
    // Fade out the splatter
    this.life -= this.fadeRate;

    // Update particles
    for (let particle of this.particles) {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vx *= 0.95; // Slow down particles
      particle.vy *= 0.95;
      particle.life -= this.fadeRate;
    }
  }

  draw() {
    push();

    // Draw particles
    for (let particle of this.particles) {
      if (particle.life > 0) {
        fill(139, 0, 0, particle.life); // Dark red color with alpha
        noStroke();
        ellipse(particle.x, particle.y, particle.size);
      }
    }

    pop();
  }

  isDead() {
    return this.life <= 0;
  }
}

function setup() {
  // Calculate available height for canvas
  const header = document.getElementById('header');
  const controls = document.getElementById('controls');
  const stats = document.getElementById('stats');
  const headerHeight = header ? header.offsetHeight : 0;
  const controlsHeight = controls ? controls.offsetHeight : 0;
  const statsHeight = stats ? stats.offsetHeight : 0;
  // Leave a little margin
  const availableHeight = windowHeight - headerHeight - controlsHeight - statsHeight - 48;

  let canvas = createCanvas(windowWidth - 48, max(300, availableHeight));
  canvas.parent('canvas-container');

  setupControls();
}


function draw() {
  // Canvas Color
  background(255);

  // Draw walls first
  for (let wall of walls) {
    wall.draw();
  }

  // Draw preview building if hovering
  if (selectedPreset && previewBuilding) {
    drawPreviewBuilding();
  }

  // Update and draw blood splatters
  for (let i = bloodSplatters.length - 1; i >= 0; i--) {
    if (!isPaused) {
      bloodSplatters[i].update();
    }

    bloodSplatters[i].draw();

    // Remove dead splatters
    if (bloodSplatters[i].isDead()) {
      bloodSplatters.splice(i, 1);
    }
  }

  // Update and draw all entities
  for (let entity of entities) {
    if (!isPaused) {
      entity.update();
    }

    // Draw FOV if toggle is enabled
    if (showFOV) {
      entity.drawFOV();
    }

    entity.draw();
  }

  // Update stats display
  updateStats();

  // Wall preview highlight
  if (isDrawingWall && spawnMode === 'wall') {
    push();
    stroke(139, 69, 19, 150);
    strokeWeight(8);
    line(wallStartX, wallStartY, mouseX, mouseY);
    pop();
  }
}

function drawPreviewBuilding() {
  push();
  translate(mouseX, mouseY);
  rotate(radians(currentRotation)); // Apply rotation
  stroke(139, 69, 19, 100);
  strokeWeight(6);

  for (let wallDef of previewBuilding) {
    line(wallDef.x1, wallDef.y1, wallDef.x2, wallDef.y2);
  }
  pop();
}

function mouseMoved() {
  if (selectedPreset) {
    previewBuilding = buildingPresets[selectedPreset].walls;
  }
}

function mousePressed() {
  if (mouseX > 0 && mouseY > 0 && mouseX < width && mouseY < height) {
    if (selectedPreset) {
      // Place building preset
      placeBuildingPreset(selectedPreset, mouseX, mouseY);
    } else if (spawnMode === 'wall') {
      isDrawingWall = true;
      wallStartX = mouseX;
      wallStartY = mouseY;
    } else {
      entities.push(new Entity(mouseX, mouseY, spawnMode));
    }
  }
}

function placeBuildingPreset(presetName, x, y) {
  const preset = buildingPresets[presetName];
  if (preset) {
    for (let wallDef of preset.walls) {
      // Apply rotation to wall coordinates
      let rotatedStart = rotatePoint(wallDef.x1, wallDef.y1, currentRotation);
      let rotatedEnd = rotatePoint(wallDef.x2, wallDef.y2, currentRotation);

      walls.push(new Wall(
        x + rotatedStart.x, y + rotatedStart.y,
        x + rotatedEnd.x, y + rotatedEnd.y
      ));
    }
  }
}

// Helper function to rotate a point around origin
function rotatePoint(x, y, angleDegrees) {
  let angleRad = radians(angleDegrees);
  let cos_a = cos(angleRad);
  let sin_a = sin(angleRad);

  return {
    x: x * cos_a - y * sin_a,
    y: x * sin_a + y * cos_a
  };
}

function keyPressed() {
  if (key === 'h' || key === 'H') {
    spawnMode = 'human';
    selectedPreset = null;
    updateModeButtons();
  } else if (key === 'z' || key === 'Z') {
    spawnMode = 'zombie';
    selectedPreset = null;
    updateModeButtons();
  } else if (key === 'w' || key === 'W') {
    spawnMode = 'wall';
    selectedPreset = null;
    updateModeButtons();
  } else if (key === 'r' || key === 'R') {
    // Rotate building preset by 90 degrees
    if (selectedPreset) {
      currentRotation = (currentRotation + 90) % 360;
    }
  } else if (key === 'c' || key === 'C') {
    entities = [];
    walls = [];
  } else if (key === '1') {
    selectPreset('square');
  } else if (key === '2') {
    selectPreset('rectangle');
  } else if (key === '3') {
    selectPreset('lshape');
  } else if (key === '4') {
    selectPreset('courtyard');
  }
}

function selectPreset(presetName) {
  selectedPreset = presetName;
  spawnMode = null;
  currentRotation = 0; // Reset rotation when selecting new preset
  updateModeButtons();
  updatePresetButtons();
}

function setupControls() {
  document.getElementById('humanBtn').onclick = () => {
    spawnMode = 'human';
    selectedPreset = null;
    updateModeButtons();
    updatePresetButtons();
  };

  document.getElementById('zombieBtn').onclick = () => {
    spawnMode = 'zombie';
    selectedPreset = null;
    updateModeButtons();
    updatePresetButtons();
  };

  document.getElementById('wallBtn').onclick = () => {
    spawnMode = 'wall';
    selectedPreset = null;
    updateModeButtons();
    updatePresetButtons();
  };

  // Building preset buttons
  document.getElementById('squareBtn').onclick = () => selectPreset('square');
  document.getElementById('rectangleBtn').onclick = () => selectPreset('rectangle');
  document.getElementById('lshapeBtn').onclick = () => selectPreset('lshape');
  document.getElementById('courtyardBtn').onclick = () => selectPreset('courtyard');

  document.getElementById('humanSpeed').oninput = (e) => {
    humanSpeed = parseFloat(e.target.value);
    document.getElementById('humanSpeedValue').textContent = humanSpeed.toFixed(1);
  };

  document.getElementById('zombieSpeed').oninput = (e) => {
    zombieSpeed = parseFloat(e.target.value);
    document.getElementById('zombieSpeedValue').textContent = zombieSpeed.toFixed(1);
  };

  document.getElementById('visionRange').oninput = (e) => {
    visionRange = parseInt(e.target.value);
    document.getElementById('visionValue').textContent = visionRange;
  };

  document.getElementById('showFOV').onchange = (e) => {
    showFOV = e.target.checked;
  };

  document.getElementById('pauseBtn').onclick = () => {
    isPaused = !isPaused;
    document.getElementById('pauseBtn').textContent = isPaused ? '▶️ Resume' : '⏸️ Pause';
    document.getElementById('pauseBtn').style.background = isPaused ? '#ffcc00ff' : '#ffd941ff';
  };

  document.getElementById('clearBtn').onclick = () => {
    entities = [];
    walls = [];
    bloodSplatters = []; // Clear blood splatters too
  };
}

function updateStats() {
  const humanCount = entities.filter(e => e.type === 'human' && e.infectionProgress === 0).length;
  const zombieCount = entities.filter(e => e.type === 'zombie' || e.infectionProgress > 0).length;
  const totalCount = entities.length;

  document.getElementById('humanCount').textContent = humanCount;
  document.getElementById('zombieCount').textContent = zombieCount;
  document.getElementById('totalCount').textContent = totalCount;
}

function updateModeButtons() {
  document.getElementById('humanBtn').classList.toggle('active', spawnMode === 'human');
  document.getElementById('zombieBtn').classList.toggle('active', spawnMode === 'zombie');
  document.getElementById('wallBtn').classList.toggle('active', spawnMode === 'wall');
}

function updatePresetButtons() {
  document.getElementById('squareBtn').classList.toggle('active', selectedPreset === 'square');
  document.getElementById('rectangleBtn').classList.toggle('active', selectedPreset === 'rectangle');
  document.getElementById('lshapeBtn').classList.toggle('active', selectedPreset === 'lshape');
  document.getElementById('courtyardBtn').classList.toggle('active', selectedPreset === 'courtyard');
}

function windowResized() {
  // Recalculate available height for canvas
  const header = document.getElementById('header');
  const controls = document.getElementById('controls');
  const stats = document.getElementById('stats');
  const headerHeight = header ? header.offsetHeight : 0;
  const controlsHeight = controls ? controls.offsetHeight : 0;
  const statsHeight = stats ? stats.offsetHeight : 0;
  const availableHeight = windowHeight - headerHeight - controlsHeight - statsHeight - 48;

  resizeCanvas(windowWidth - 48, max(300, availableHeight));
}