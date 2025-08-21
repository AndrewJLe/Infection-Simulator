// Global variables
let entities = [];
let walls = [];
let spawnMode = 'human';
let humanSpeed = 2;
let zombieSpeed = 1.5;
let visionRange = 100;
let showFOV = false; // New toggle for Field of View display

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
        if (frameCount % 60 === 0) {
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
      if (this.type === 'human') {
        this.infectionProgress = 0.01;
      } else {
        other.infectionProgress = 0.01;
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

  // Update and draw all entities
  for (let entity of entities) {
    entity.update();

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

function keyPressed() {
  if (key === 'h' || key === 'H') {
    spawnMode = 'human';
    updateModeButtons();
  } else if (key === 'z' || key === 'Z') {
    spawnMode = 'zombie';
    updateModeButtons();
  } else if (key === 'w' || key === 'W') {
    spawnMode = 'wall';
    updateModeButtons();
  } else if (key === 'c' || key === 'C') {
    entities = [];
    walls = [];
  }
}

// Variables for wall drawing
let isDrawingWall = false;
let wallStartX, wallStartY;

function mousePressed() {
  if (mouseX > 0 && mouseY > 0 && mouseX < width && mouseY < height) {
    if (spawnMode === 'wall') {
      isDrawingWall = true;
      wallStartX = mouseX;
      wallStartY = mouseY;
    } else {
      entities.push(new Entity(mouseX, mouseY, spawnMode));
    }
  }
}

function mouseReleased() {
  if (isDrawingWall && spawnMode === 'wall') {
    walls.push(new Wall(wallStartX, wallStartY, mouseX, mouseY));
    isDrawingWall = false;
  }
}

function setupControls() {
  document.getElementById('humanBtn').onclick = () => {
    spawnMode = 'human';
    updateModeButtons();
  };

  document.getElementById('zombieBtn').onclick = () => {
    spawnMode = 'zombie';
    updateModeButtons();
  };

  document.getElementById('wallBtn').onclick = () => {
    spawnMode = 'wall';
    updateModeButtons();
  };

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

  document.getElementById('clearBtn').onclick = () => {
    entities = [];
    walls = [];
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
  if (spawnMode === 'human') {
    document.getElementById('humanBtn').classList.add('active');
    document.getElementById('zombieBtn').classList.remove('active');
    document.getElementById('wallBtn').classList.remove('active');
  } else if (spawnMode === 'zombie') {
    document.getElementById('zombieBtn').classList.add('active');
    document.getElementById('humanBtn').classList.remove('active');
    document.getElementById('wallBtn').classList.remove('active');
  } else if (spawnMode === 'wall') {
    document.getElementById('wallBtn').classList.add('active');
    document.getElementById('humanBtn').classList.remove('active');
    document.getElementById('zombieBtn').classList.remove('active');
  }
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