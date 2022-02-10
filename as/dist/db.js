"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongodb_1 = require("mongodb");
let client;
let collection;
function init_db() {
    client = new mongodb_1.MongoClient("mongodb+srv://yatagarasu-mafia-bot:5EJXNgQrknNwqgYU@yatagarasu-mafia-uwyry.mongodb.net/test?retryWrites=true&w=majority", { useNewUrlParser: true });
    client.connect((err) => __awaiter(this, void 0, void 0, function* () {
        if (err) {
            client.close();
            throw "Failed to connect to MongoDB server: " + err.message;
        }
        console.log("Connected to MongoDB");
        let db = client.db("mafia");
        db.collection("config").find().toArray((err, res) => {
            exports.config_db = res[0];
        });
        db.collection("roles").find().toArray((err, res) => {
            exports.roles_db = res[0];
        });
    }));
}
exports.init_db = init_db;
function save_roles() {
    collection.updateOne({}, { $set: exports.roles_db });
}
exports.save_roles = save_roles;
function get_db(channel) {
    return __awaiter(this, void 0, void 0, function* () {
        let i = channel.topic.indexOf("mafiadb");
        let id = channel.topic.substr(i + 7, 18);
        let db = yield channel.fetchMessage(id);
        db.content.match(/()/);
    });
}
exports.get_db = get_db;
function random_in(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
exports.random_in = random_in;
function get_confirm_react() {
    return random_in(exports.config_db.confirm_react.split("|"));
}
exports.get_confirm_react = get_confirm_react;
function get_error_react() {
    return random_in(exports.config_db.error_react.split("|"));
}
exports.get_error_react = get_error_react;
function get_player_role(guild) {
    return guild.roles.find(x => x.name === exports.config_db.player_role);
}
exports.get_player_role = get_player_role;
function has_perms(member) {
    return member.roles.find(x => x.name === exports.config_db.manager_role) ? true : false;
}
exports.has_perms = has_perms;
function is_mafia_channel(channel) {
    let channel_role = channel.guild.roles.find(x => x.name === exports.config_db.channel_role);
    return channel_role && channel.permissionOverwrites.find(x => x.type === "role" && x.id === channel_role.id) ? true : false;
}
exports.is_mafia_channel = is_mafia_channel;
function get_secret_channel(guild) {
    return guild.channels.find(x => x.name === exports.config_db.secret_channel && x.type === "text");
}
exports.get_secret_channel = get_secret_channel;
//# sourceMappingURL=db.js.map