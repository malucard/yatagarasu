"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Player {
    constructor(setup, number, member, role) {
        this.number = number;
        this.id = member.id;
        this.member = member;
        this.name = member.user.username;
        this.items = [];
        this.setup = setup;
        this.role = role.instance(setup, this);
    }
}
exports.default = Player;
//# sourceMappingURL=Player.js.map