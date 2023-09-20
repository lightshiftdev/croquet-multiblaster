import Game from "./models.js";
import Display from "./display.js";

Croquet.Session.join({
  apiKey: "1AC1uci95ILt22fKnuuFuBtlObEA0rne9OrHsicqe", // get your own from croquet.io/keys
  appId: "xyz.lightshift.gilberto.conde.asteroids",
  name: Croquet.App.autoSession(),
  password: Croquet.App.autoPassword(),
  model: Game,
  view: Display,
});
