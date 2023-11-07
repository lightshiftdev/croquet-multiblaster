import Game from "/js/models.js";
import Display from "/js/display.js";

const urlParams = new URLSearchParams(window.location.search);
const myParam = Boolean(urlParams.get("show-qr"));
if (myParam) {
  Croquet.App.makeWidgetDock();
}
Croquet.Session.join({
  apiKey: "1r1C9u9FM5rvx2xp4daCNnHOu0sqDMFOzc09HF47y", // get your own from croquet.io/keys
  appId: "xyz.lightshift.gilberto.conde.asteroids",
  name: Croquet.App.autoSession(),
  password: Croquet.App.autoPassword(),
  model: Game,
  view: Display,
});
