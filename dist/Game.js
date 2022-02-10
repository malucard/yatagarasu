"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Arg;
(function (Arg) {
    Arg[Arg["User"] = 0] = "User";
})(Arg = exports.Arg || (exports.Arg = {}));
class Game {
    add_command(name, args, run) {
        this.commands[name] = [args, run];
    }
}
exports.Game = Game;
//# sourceMappingURL=Game.js.map