export default class Game extends Croquet.Model {
  init(_, persisted) {
    this.highscores = persisted?.highscores ?? {};
    this.ships = new Map();
    this.blasts = new Set();
    this.subscribe(this.sessionId, "view-join", this.viewJoined);
    this.subscribe(this.sessionId, "view-exit", this.viewExited);
    this.mainLoop();
  }

  viewJoined(viewId) {
    const ship = Ship.create({ viewId });
    this.ships.set(viewId, ship);
  }

  viewExited(viewId) {
    const ship = this.ships.get(viewId);
    this.ships.delete(viewId);
    ship.destroy();
  }

  setHighscore(initials, score) {
    if (this.highscores[initials] >= score) return;
    this.highscores[initials] = score;
    this.persistSession({ highscores: this.highscores });
  }

  mainLoop() {
    for (const ship of this.ships.values()) ship.move();
    for (const blast of this.blasts) blast.move();
    this.checkCollisions();
    this.future(50).mainLoop(); // move & check every 50 ms
  }

  checkCollisions() {
    for (const ship of this.ships.values()) {
      if (ship.newSpawn && this.now() - ship.spawnTime >= 3000) {
        ship.newSpawn = false;
      }

      if (ship.wasHit || ship.newSpawn) continue;

      const minx = ship.x - 20;
      const maxx = ship.x + 20;
      const miny = ship.y - 20;
      const maxy = ship.y + 20;

      for (const blast of this.blasts) {
        if (
          blast.x > minx &&
          blast.x < maxx &&
          blast.y > miny &&
          blast.y < maxy
        ) {
          ship.hitBy(blast);
          break;
        }
      }
    }
  }
}
Game.register("Game");

class SpaceObject extends Croquet.Model {
  get game() {
    return this.wellKnownModel("modelRoot");
  }

  move() {
    // drift through space
    this.x += this.dx;
    this.y += this.dy;
    if (this.x < 0) this.x += 1000;
    if (this.x > 1000) this.x -= 1000;
    if (this.y < 0) this.y += 1000;
    if (this.y > 1000) this.y -= 1000;
    if (this.a < 0) this.a += 2 * Math.PI;
    if (this.a > 2 * Math.PI) this.a -= 2 * Math.PI;
  }
}

class Ship extends SpaceObject {
  init({ viewId }) {
    super.init();
    this.viewId = viewId;
    this.initials = "";
    this.dx = 0;
    this.dy = 0;
    this.score = 0;
    this.subscribe(viewId, "left-thruster", this.leftThruster);
    this.subscribe(viewId, "right-thruster", this.rightThruster);
    this.subscribe(viewId, "forward-thruster", this.forwardThruster);
    this.subscribe(viewId, "fire-blaster", this.fireBlaster);
    this.subscribe(viewId, "set-initials", this.setInitials);
    this.reset();
  }

  reset() {
    this.x = 920 * Math.random() + 40;
    this.y = 920 * Math.random() + 40;
    this.a = Math.random() * Math.PI * 2;
    this.dx = 0;
    this.dy = 0;
    this.left = false;
    this.right = false;
    this.forward = false;
    this.wasHit = 0;
    this.spawnTime = this.now();
    this.newSpawn = true;
  }

  leftThruster(active) {
    this.left = active;
  }

  rightThruster(active) {
    this.right = active;
  }

  forwardThruster(active) {
    this.forward = active;
  }

  fireBlaster() {
    if (this.wasHit) return;
    // create blast moving at speed 20 in direction of ship
    const dx = Math.cos(this.a) * 20;
    const dy = Math.sin(this.a) * 20;
    const x = this.x + dx;
    const y = this.y + dy;
    Blast.create({ x, y, dx, dy, ship: this });
    // kick ship back a bit
    this.accelerate(-0.5);
  }

  move() {
    if (this.wasHit) {
      // keep drifting as debris for 3 seconds
      if (++this.wasHit > 60) this.reset();
    } else {
      // process thruster controls
      if (this.forward) this.accelerate(0.5);
      if (this.left) this.a -= 0.2;
      if (this.right) this.a += 0.2;
    }
    super.move();
  }

  accelerate(force) {
    this.dx += Math.cos(this.a) * force;
    this.dy += Math.sin(this.a) * force;
    if (this.dx > 10) this.dx = 10;
    if (this.dx < -10) this.dx = -10;
    if (this.dy > 10) this.dy = 10;
    if (this.dy < -10) this.dy = -10;
  }

  setInitials(initials) {
    if (!initials) return;
    for (const ship of this.game.ships.values()) {
      if (ship.initials === initials) return;
    }
    const highscore = this.game.highscores[this.initials];
    if (highscore !== undefined) delete this.game.highscores[this.initials];
    this.initials = initials;
    this.game.setHighscore(this.initials, Math.max(this.score, highscore || 0));
  }

  scored() {
    this.score++;
    if (this.initials) this.game.setHighscore(this.initials, this.score);
  }

  hitBy(blast) {
    if (blast.ship.viewId !== this.viewId && !blast.ship.wasHit) {
      blast.ship.scored();
      this.wasHit = 1;
      blast.destroy();
    }
  }
}
Ship.register("Ship");

class Blast extends SpaceObject {
  init({ x, y, dx, dy, ship }) {
    super.init();
    this.ship = ship;
    this.x = x;
    this.y = y;
    this.dx = dx;
    this.dy = dy;
    this.t = 0;
    this.game.blasts.add(this);
  }

  move() {
    // move for 1.5 second before disappearing
    if (++this.t > 30) return this.destroy();
    super.move();
  }

  destroy() {
    this.game.blasts.delete(this);
    super.destroy();
  }
}
Blast.register("Blast");
