// Global variables
let entities = [];
let spawnMode = 'human';
let humanSpeed = 2;
let zombieSpeed = 1.5;
let visionRange = 100;

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

    move() {
        let nearbyEntities = this.getEntitiesInVision();

        let desiredVx = 0;
        let desiredVy = 0;

        if (this.type === 'zombie') {
            let nearestHuman = this.findNearestHuman(nearbyEntities);
            if (nearestHuman) {
                let dx = nearestHuman.x - this.x;
                let dy = nearestHuman.y - this.y;
                let dist = sqrt(dx * dx + dy * dy);

                desiredVx = (dx / dist) * zombieSpeed;
                desiredVy = (dy / dist) * zombieSpeed;
            } else {
                if (frameCount % 60 === 0) {
                    desiredVx = random(-1, 1) * zombieSpeed * 0.3;
                    desiredVy = random(-1, 1) * zombieSpeed * 0.3;
                } else {
                    desiredVx = this.vx;
                    desiredVy = this.vy;
                }
            }
        } else if (this.type === 'human') {
            let nearestZombie = this.findNearestZombie(nearbyEntities);
            if (nearestZombie) {
                let dx = this.x - nearestZombie.x;
                let dy = this.y - nearestZombie.y;
                let dist = sqrt(dx * dx + dy * dy);

                desiredVx = (dx / dist) * humanSpeed;
                desiredVy = (dy / dist) * humanSpeed;
            } else {
                desiredVx = this.vx * 0.9;
                desiredVy = this.vy * 0.9;
            }
        }

        this.vx = desiredVx;
        this.vy = desiredVy;

        let newX = this.x + this.vx + this.spazzIntensity * random(-1, 1);
        let newY = this.y + this.vy + this.spazzIntensity * random(-1, 1);

        newX = constrain(newX, this.size, width - this.size);
        newY = constrain(newY, this.size, height - this.size);

        let collision = false;
        for (let other of entities) {
            if (other !== this) {
                let dist = sqrt((newX - other.x) ** 2 + (newY - other.y) ** 2);
                if (dist < this.size + other.size) {
                    collision = true;

                    if ((this.type === 'human' && other.type === 'zombie' && this.infectionProgress === 0) ||
                        (this.type === 'zombie' && other.type === 'human' && other.infectionProgress === 0)) {
                        if (this.type === 'human') {
                            this.infectionProgress = 0.01;
                        } else {
                            other.infectionProgress = 0.01;
                        }
                    }
                    break;
                }
            }
        }

        if (!collision) {
            this.x = newX;
            this.y = newY;
        } else {
            let altX = this.x + this.vx * 0.3 + random(-2, 2);
            let altY = this.y + this.vy * 0.3 + random(-2, 2);

            altX = constrain(altX, this.size, width - this.size);
            altY = constrain(altY, this.size, height - this.size);

            let canMoveAlt = true;
            for (let other of entities) {
                if (other !== this) {
                    let dist = sqrt((altX - other.x) ** 2 + (altY - other.y) ** 2);
                    if (dist < this.size + other.size) {
                        canMoveAlt = false;
                        break;
                    }
                }
            }

            if (canMoveAlt) {
                this.x = altX;
                this.y = altY;
            }
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

    draw() {
        push();
        translate(this.x, this.y);

        if (this.type === 'human') {
            if (this.infectionProgress > 0) {
                let r = lerp(0, 0, this.infectionProgress);
                let g = lerp(0, 255, this.infectionProgress);
                let b = lerp(0, 0, this.infectionProgress);
                fill(r, g, b);
            } else {
                fill(0);
            }
        } else {
            fill(0, 255, 0);
        }

        stroke(255);
        strokeWeight(1);
        ellipse(0, 0, this.size * 2);

        pop();
    }
}

function setup() {
    let canvas = createCanvas(windowWidth - 20, windowHeight - 200);
    canvas.parent('canvas-container');

    setupControls();
}

function draw() {
    background(50);

    // Update and draw all entities
    for (let entity of entities) {
        entity.update();
        entity.draw();
    }

    // Draw info overlay
    fill(0, 0, 0, 150);
    rect(10, 10, 200, 80);

    fill(255);
    textSize(14);
    text(`Mode: ${spawnMode.toUpperCase()}`, 20, 30);
    text(`Humans: ${entities.filter(e => e.type === 'human' && e.infectionProgress === 0).length}`, 20, 50);
    text(`Zombies: ${entities.filter(e => e.type === 'zombie' || e.infectionProgress > 0).length}`, 20, 70);
}

function mousePressed() {
    if (mouseX > 0 && mouseY > 0 && mouseX < width && mouseY < height) {
        entities.push(new Entity(mouseX, mouseY, spawnMode));
    }
}

function keyPressed() {
    if (key === 'h' || key === 'H') {
        spawnMode = 'human';
        updateModeButtons();
    } else if (key === 'z' || key === 'Z') {
        spawnMode = 'zombie';
        updateModeButtons();
    } else if (key === 'c' || key === 'C') {
        entities = [];
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

    document.getElementById('humanSpeed').oninput = (e) => {
        humanSpeed = parseFloat(e.target.value);
        document.getElementById('humanSpeedValue').textContent = humanSpeed;
    };

    document.getElementById('zombieSpeed').oninput = (e) => {
        zombieSpeed = parseFloat(e.target.value);
        document.getElementById('zombieSpeedValue').textContent = zombieSpeed;
    };

    document.getElementById('visionRange').oninput = (e) => {
        visionRange = parseInt(e.target.value);
        document.getElementById('visionValue').textContent = visionRange;
    };

    document.getElementById('clearBtn').onclick = () => {
        entities = [];
    };
}

function updateModeButtons() {
    if (spawnMode === 'human') {
        document.getElementById('humanBtn').classList.add('active');
        document.getElementById('zombieBtn').classList.remove('active');
    } else {
        document.getElementById('zombieBtn').classList.add('active');
        document.getElementById('humanBtn').classList.remove('active');
    }
}

function windowResized() {
    resizeCanvas(windowWidth - 20, windowHeight - 200);
}