export default class Display extends Croquet.View {
  iter = 1;
  colors = new Map();
  colorsByLabel = new Map();
  actualSecond = 0;
  fps = 0;
  frameRateElm = undefined;
  latencyElm = undefined;
  metricsElms = undefined;
  PlayerCountElm = undefined;
  backLogElm = undefined;
  prevLatency = 0;
  showMetrics = false;
  metrics = {
    fps: 0,
    players: 0,
    latency: 0,
    backlog: 0,
  };

  constructor(model) {
    super(model);
    this.model = model;

    const joystick = document.getElementById("joystick");
    const knob = document.getElementById("knob");
    this.frameRateElm = document.getElementById("frameRate");
    this.PlayerCountElm = document.getElementById("playersCount");
    this.backLogElm = document.getElementById("backLog");
    this.latencyElm = document.getElementById("latency");
    this.metricsElms = Array.from(document.getElementsByClassName("metrics"));

    document.onkeydown = (e) => {
      joystick.style.display = "none";
      if (e.repeat) return;
      switch (e.key) {
        case "a":
        case "A":
        case "ArrowLeft":
          this.publish(this.viewId, "left-thruster", true);
          break;
        case "d":
        case "D":
        case "ArrowRight":
          this.publish(this.viewId, "right-thruster", true);
          break;
        case "w":
        case "W":
        case "ArrowUp":
          this.publish(this.viewId, "forward-thruster", true);
          break;
        case "s":
        case "S":
        case " ":
          this.publish(this.viewId, "fire-blaster");
          break;
        case "m":
        case "M":
          this.showMetrics = !this.showMetrics;
          this.metricsElms.forEach(
            (el) => (el.style.display = this.showMetrics ? "block" : "none")
          );
          break;
      }
    };
    document.onkeyup = (e) => {
      if (e.repeat) return;
      switch (e.key) {
        case "a":
        case "A":
        case "ArrowLeft":
          this.publish(this.viewId, "left-thruster", false);
          break;
        case "d":
        case "D":
        case "ArrowRight":
          this.publish(this.viewId, "right-thruster", false);
          break;
        case "w":
        case "W":
        case "ArrowUp":
          this.publish(this.viewId, "forward-thruster", false);
          break;
      }
    };

    let x = 0,
      y = 0,
      id = 0,
      right = false,
      left = false,
      forward = false;
    document.onpointerdown = (e) => {
      if (!id) {
        id = e.pointerId;
        x = e.clientX;
        y = e.clientY;
        joystick.style.left = `${x - 60}px`;
        joystick.style.top = `${y - 60}px`;
        joystick.style.display = "block";
      }
    };
    document.onpointermove = (e) => {
      e.preventDefault();
      if (id === e.pointerId) {
        let dx = e.clientX - x;
        let dy = e.clientY - y;
        if (dx > 30) {
          dx = 30;
          if (!right) {
            this.publish(this.viewId, "right-thruster", true);
            right = true;
          }
        } else if (right) {
          this.publish(this.viewId, "right-thruster", false);
          right = false;
        }
        if (dx < -30) {
          dx = -30;
          if (!left) {
            this.publish(this.viewId, "left-thruster", true);
            left = true;
          }
        } else if (left) {
          this.publish(this.viewId, "left-thruster", false);
          left = false;
        }
        if (dy < -30) {
          dy = -30;
          if (!forward) {
            this.publish(this.viewId, "forward-thruster", true);
            forward = true;
          }
        } else if (forward) {
          this.publish(this.viewId, "forward-thruster", false);
          forward = false;
        }
        if (dy > 0) dy = 0;
        knob.style.left = `${20 + dx}px`;
        knob.style.top = `${20 + dy}px`;
      }
    };

    document.onpointerup = (e) => {
      e.preventDefault();
      if (id === e.pointerId) {
        id = 0;
        if (!right && !left && !forward) {
          this.publish(this.viewId, "fire-blaster");
        }
        if (right) {
          this.publish(this.viewId, "right-thruster", false);
          right = false;
        }
        if (left) {
          this.publish(this.viewId, "left-thruster", false);
          left = false;
        }
        if (forward) {
          this.publish(this.viewId, "forward-thruster", false);
          forward = false;
        }
        knob.style.left = `20px`;
        knob.style.top = `20px`;
      } else {
        this.publish(this.viewId, "fire-blaster");
      }
    };
    document.onpointercancel = document.onpointerup;
    document.oncontextmenu = (e) => {
      e.preventDefault();
      this.publish(this.viewId, "fire-blaster");
    };
    document.ontouchend = (e) => e.preventDefault(); // prevent double-tap zoom on iOS

    initials.ontouchend = () => initials.focus(); // and allow input ¯\_(ツ)_/¯
    initials.onchange = () => {
      this.publish(this.viewId, "set-initials", initials.value);
      localStorage.setItem("io.croquet.multiblaster.initials", initials.value);
    };
    if (localStorage.getItem("io.croquet.multiblaster.initials")) {
      initials.value = localStorage.getItem("io.croquet.multiblaster.initials");
      this.publish(this.viewId, "set-initials", initials.value);
      // after reloading, our previous ship with initials is still there, so just try again once
      setTimeout(
        () => this.publish(this.viewId, "set-initials", initials.value),
        1000
      );
    }
    initials.onkeydown = (e) => {
      if (e.key === "Enter") {
        initials.blur();
        e.preventDefault();
      }
    };

    this.smoothing = new WeakMap(); // position cache for interpolated rendering

    this.context = canvas.getContext("2d");

    this.startRandomActions();
  }

  startRandomActions() {
    const urlParams = new URLSearchParams(window.location.search);
    const myParam = Number(urlParams.get("interval")) || 200;
    const minClients = Number(urlParams.get("min-clients")) || 20;
    setInterval(() => {
      if (this.model.viewCount >= minClients) {
        this.publish(this.viewId, "send-metrics", this.metrics);
      }
    }, myParam);
    /* setInterval(() => {
      const action = Math.round(Math.random() * 3);
      switch (action) {
        case 0:
          this.publish(this.viewId, "left-thruster", true);
          setTimeout(() => {
            this.publish(this.viewId, "left-thruster", false);
          }, 10);
        case 1:
          this.publish(this.viewId, "right-thruster", true);
          setTimeout(() => {
            this.publish(this.viewId, "right-thruster", false);
          }, 10);
        case 2:
          this.publish(this.viewId, "forward-thruster", true);
          setTimeout(() => {
            this.publish(this.viewId, "forward-thruster", false);
          }, 10);
        case 3:
          this.publish(this.viewId, "fire-blaster", true);
          setTimeout(() => {
            this.publish(this.viewId, "fire-blaster", false);
          }, 10);
      }
    }, myParam * 2); */
  }

  setShipColorByIndex(index, viewId, label) {
    const aux =
      index % 2
        ? 360 - (index * 10 + this.iter * 10)
        : index * 10 + this.iter * 10;
    const color = aux > 360 ? index * 10 + ++this.iter * 10 : aux;
    this.colors.set(
      viewId,
      `hsl(${color}, ${25 + this.iter * 2}%, ${60 + this.iter}%)`
    );
    this.colorsByLabel.set(
      label,
      `hsl(${color}, ${25 + this.iter * 2}%, ${60 + this.iter}%)`
    );
  }
  // update is called once per render frame
  // read from shared model, interpolate, render
  update() {
    const aux = Math.floor(Date.now() / 1000);
    if (aux === this.actualSecond) {
      this.fps += 1;
    } else {
      this.actualFps = this.fps;
      this.fps = 1;
      this.actualSecond = aux;
    }
    if (this.prevLatency !== this.session.latency) {
      this.prevLatency = this.session.latency;
    }

    this.metrics = {
      fps: this.actualFps || 0,
      players: this.model.ships.size,
      latency: this.session.latency,
      backlog: this.realm.vm.controller.backlog,
    };

    if (this.showMetrics) {
      const metricsArray = Array.from(this.model.ships.values()).map(
        (s) => s.metrics
      );
      const fps = metricsArray.map((f) => f.fps);
      const latency = metricsArray.map((f) => f.latency);
      const backlog = metricsArray.map((f) => f.backlog);

      this.PlayerCountElm.textContent = this.model.ships.size;
      this.frameRateElm.textContent = `avg: ${(
        fps.reduce((a, b) => a + b) / fps.length
      ).toFixed(0)}, Max: ${Math.max(...fps)}, Min: ${Math.min(...fps)}`;
      this.latencyElm.textContent = `avg: ${(
        latency.reduce((a, b) => a + b) / latency.length
      ).toFixed(0)}, Max: ${Math.max(...latency)}, Min: ${Math.min(
        ...latency
      )}`;
      this.backLogElm.textContent = `avg: ${(
        backlog.reduce((a, b) => a + b) / backlog.length
      ).toFixed(0)}, Max: ${Math.max(...backlog)}, Min: ${Math.min(
        ...backlog
      )}`;
      /* this.latencyElm.textContent = this.session.latency;
      this.backLogElm.textContent = this.realm.vm.controller.backlog;
      this.PlayerCountElm.textContent = this.model.ships.size; */
    }

    this.context.clearRect(0, 0, 1000, 1000);
    this.context.fillStyle = "rgba(255, 255, 255, 0.5)";
    this.context.lineWidth = 3;
    this.context.strokeStyle = "white";
    this.context.font = "30px sans-serif";
    this.context.textAlign = "left";
    this.context.textBaseline = "middle";
    // model highscore only keeps players with initials, merge with unnamed players
    const highscore = Object.entries(this.model.highscores);
    const labels = new Map();
    const emojis = new Map();
    for (const [index, ship] of [...this.model.ships.values()].entries()) {
      let label = ship.initials;
      if (!label) {
        label = `Player ${labels.size + 1}`;
        highscore.push([label, ship.score]);
      } else {
        const emoji = label.match(EMOJI_REGEX);
        if (emoji?.length) emojis.set(ship, emoji[emoji.length >> 1]);
      }
      this.setShipColorByIndex(index, ship.viewId, label);
      labels.set(ship, label);
    }
    // draw sorted highscore
    for (let [i, [label, score]] of highscore
      .sort((a, b) => b[1] - a[1])
      .entries()) {
      /* const color = this.colorsByLabel.get(label);
      if (color) {
        this.context.fillStyle = color;
      } */
      // this.context.fillText(`${i + 1}. ${label}: ${score}`, 10, 30 + i * 35);
    }
    // draw ships, and blasters
    this.context.font = "40px sans-serif";
    for (const ship of this.model.ships.values()) {
      const { x, y, a } = this.smoothPosAndAngle(ship);
      this.drawWrapped(x, y, 300, () => {
        const color = this.colors.get(ship.viewId);
        if (color) {
          this.context.fillStyle = color;
        }
        this.context.textAlign = "right";
        this.context.fillText(labels.get(ship), -30 + ship.wasHit * 2, 0);
        this.context.textAlign = "left";
        this.context.fillText(ship.score, 30 - ship.wasHit * 2, 0);
        this.context.rotate(a);
        if (ship.wasHit) this.drawShipDebris(ship.wasHit);
        else this.drawShip(ship, ship.viewId === this.viewId);
      });
    }
    this.context.textAlign = "center";
    // this.context.fillStyle = "white";
    this.context.font = "20px sans-serif";
    for (const blast of this.model.blasts) {
      const color = this.colors.get(blast.ship.viewId);
      if (color) {
        this.context.fillStyle = color;
        this.context.strokeStyle = color;
      }
      const { x, y } = this.smoothPos(blast);
      this.drawWrapped(x, y, 10, () => {
        this.drawBlast(emojis.get(blast.ship));
      });
    }
  }

  smoothPos(obj) {
    if (!this.smoothing.has(obj)) {
      this.smoothing.set(obj, { x: obj.x, y: obj.y, a: obj.a });
    }
    const smoothed = this.smoothing.get(obj);
    const dx = obj.x - smoothed.x;
    const dy = obj.y - smoothed.y;
    if (Math.abs(dx) < 50) smoothed.x += dx * 0.3;
    else smoothed.x = obj.x;
    if (Math.abs(dy) < 50) smoothed.y += dy * 0.3;
    else smoothed.y = obj.y;
    return smoothed;
  }

  smoothPosAndAngle(obj) {
    const smoothed = this.smoothPos(obj);
    const da = obj.a - smoothed.a;
    if (Math.abs(da) < 1) smoothed.a += da * 0.3;
    else smoothed.a = obj.a;
    return smoothed;
  }

  drawWrapped(x, y, size, draw) {
    const drawIt = (x, y) => {
      this.context.save();
      this.context.translate(x, y);
      draw();
      this.context.restore();
    };
    drawIt(x, y);
    // draw again on opposite sides if object is near edge
    if (x - size < 0) drawIt(x + 1000, y);
    if (x + size > 1000) drawIt(x - 1000, y);
    if (y - size < 0) drawIt(x, y + 1000);
    if (y + size > 1000) drawIt(x, y - 1000);
    if (x - size < 0 && y - size < 0) drawIt(x + 1000, y + 1000);
    if (x + size > 1000 && y + size > 1000) drawIt(x - 1000, y - 1000);
    if (x - size < 0 && y + size > 1000) drawIt(x + 1000, y - 1000);
    if (x + size > 1000 && y - size < 0) drawIt(x - 1000, y + 1000);
  }

  drawShip(ship, highlight) {
    if (ship.newSpawn) {
      this.context.setLineDash([1, 1]);
      this.context.beginPath();
      this.context.ellipse(0, 0, 25, 25, 0, 0, 2 * Math.PI);
      this.context.closePath();
      this.context.stroke();
      this.context.setLineDash([]);
    }
    this.context.beginPath();
    this.context.moveTo(+20, 0);
    this.context.lineTo(-20, +10);
    this.context.lineTo(-20, -10);
    this.context.closePath();
    this.context.stroke();
    if (highlight) {
      this.context.fill();
    }
    if (ship.forward) {
      this.context.moveTo(-20, +5);
      this.context.lineTo(-30, 0);
      this.context.lineTo(-20, -5);
      this.context.stroke();
    }
    if (ship.left) {
      this.context.moveTo(-18, -9);
      this.context.lineTo(-13, -15);
      this.context.lineTo(-10, -7);
      this.context.stroke();
    }
    if (ship.right) {
      this.context.moveTo(-18, +9);
      this.context.lineTo(-13, +15);
      this.context.lineTo(-10, +7);
      this.context.stroke();
    }
  }

  drawShipDebris(t) {
    this.context.beginPath();
    this.context.moveTo(+20 + t, 0 + t);
    this.context.lineTo(-20 + t, +10 + t);
    this.context.moveTo(-20 - t * 1.4, +10);
    this.context.lineTo(-20 - t * 1.4, -10);
    this.context.moveTo(-20 + t, -10 - t);
    this.context.lineTo(+20 + t, 0 - t);
    this.context.stroke();
  }

  drawBlast(emoji = null) {
    if (emoji) {
      this.context.fillText(emoji, 0, 0);
    } else {
      this.context.beginPath();
      this.context.ellipse(0, 0, 2, 2, 0, 0, 2 * Math.PI);
      this.context.closePath();
      this.context.stroke();
    }
  }
}
