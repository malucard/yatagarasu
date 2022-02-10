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
const http = require("http");
const Discord = require("discord.js");
const Mongo = require("mongodb");
const mclient = new Mongo.MongoClient("mongodb://keebot:keebotdb9@ds035485.mlab.com:35485/keebot");
let collection;
const client = new Discord.Client();
const server = http.createServer((req, res) => {
    res.end();
});
server.listen();
const death_messages = [
    "%pr's body was found in the river this morning.",
    "A waste collector found %pr's body in an alley dumpster this morning.",
    "%pr's body was found in a public toilet this morning.",
    "%pr's body was found in the site of a fire this morning.",
    "%pr's body was found under an old couch this morning.",
    "%p, the %r, was found sleeping peacefully this morning, but they never woke up.",
    "%pr's body was found washed up in the sea this morning.",
    "%pr's body was found disguised on a graffitied wall this morning.",
    "%pr's body was found drinking tea this morning.",
    "%pr's body was found drinking coffee this morning.",
    "%pr's body was found on a random roof this morning.",
    "%pr's body was found among trees and grass in a forest this morning.",
    "%pr's body fell from the sky this morning.",
    "%pr's body fell from space this morning.",
    "%pr's body was found in a chimney this morning.",
    "%pr's body was found in the sewers this morning.",
    "%pr's body was found very squished this morning.",
    "%pr's body was found blown up this morning.",
    "%pr's body was found in a briefcase this morning.",
    "%pr's body was found wearing a fancy red suit and sunglasses this morning."
];
var Side;
(function (Side) {
    Side[Side["NONE"] = 0] = "NONE";
    Side[Side["VILLAGE"] = 1] = "VILLAGE";
    Side[Side["MAFIA"] = 2] = "MAFIA";
    Side[Side["THIRD"] = 3] = "THIRD";
})(Side || (Side = {}));
class Role {
    constructor() {
        this.fakeSide = Side.NONE;
        this.vengeful = false;
        this.macho = false;
    }
}
function getSide(player) {
    return (player.role.fakeSide == Side.VILLAGE || player.role.fakeSide == Side.MAFIA) ? player.role.fakeSide : player.role.side;
}
class Setup {
    constructor() {
        this.nightless = false;
        this.vengeful = false;
        this.daystart = false;
        this.daychat = false;
        this.dontRecord = false;
    }
}
class Player {
}
let mafiaKill = 0;
let mafiaKiller = 0;
let hookDecided;
let players = [];
let deadPlayers = [];
let day = 0;
let cantBeginDay = false;
let cantEndDay = false;
let gameRunning = false;
let vengefulGame = false;
let nightlessGame = false;
let daystartGame = false;
let daychatGame = false;
let dontRecordGame = false;
let gameInfo;
let mafiaChannel;
let signupCollector;
let dayCollector;
let dayTimeout;
let nightTimeout;
let updateNightf;
function updateNight() {
    if (updateNightf) {
        updateNightf();
    }
}
function isSide(player, side) {
    return getSide(player) == side;
}
let roles = {
    Blue: {
        name: "Blue",
        side: Side.VILLAGE,
        beginGame: (member, player) => {
            member.send("You are a Blue, number " + player.number + ".");
        },
        endGame: (member, player) => { },
        beginNight: (member, player) => {
            player.actionDone = true;
        },
        endNight: (member, player) => { },
        die: (member, player) => { }
    },
    VengefulBlue: {
        name: "Vengeful Blue",
        side: Side.VILLAGE,
        vengeful: true,
        beginGame: (member, player) => {
            member.send("You are a Vengeful Blue, number " + player.number + ".");
        },
        endGame: (member, player) => { },
        beginNight: (member, player) => {
            player.actionDone = true;
        },
        endNight: (member, player) => { },
        die: (member, player) => { }
    },
    Bomb: {
        name: "Bomb",
        side: Side.VILLAGE,
        beginGame: (member, player) => {
            member.send("You are a Bomb, number " + player.number + ". If you are killed by the mafia or shot, the killer will die as well.");
        },
        endGame: (member, player) => { },
        beginNight: (member, player) => {
            player.actionDone = true;
        },
        endNight: (member, player) => { },
        die: (member, player) => { }
    },
    Oracle: {
        name: "Oracle",
        side: Side.VILLAGE,
        beginGame: (member, player) => {
            member.send("You are an Oracle, number " + player.number + ". Select a player each night. If you die, the role of the last player visited will be revealed to everyone. Your action can't be blocked.");
        },
        endGame: (member, player) => { },
        beginNight: (member, player) => {
            let text = "";
            if (day === 1) {
                text = " 1-" + players.length;
            }
            else {
                for (let player of players) {
                    if (player.id !== member.id) {
                        text += "\n" + player.number + "- " + player.name;
                    }
                }
            }
            member.send("Night " + day + " has begun. React with the number of who you wish to visit." + text).then((message) => __awaiter(void 0, void 0, void 0, function* () {
                yield message.react("❌");
                for (let player of players) {
                    if (player.id !== member.id) {
                        yield message.react(player.number + "\u20e3");
                    }
                }
                let collector = message.createReactionCollector((reaction, user) => user.id === member.id);
                player.data = [message, collector];
                collector.on("collect", (reaction) => {
                    if (reaction.emoji.name === "❌") {
                        player.data = null;
                        player.actionDone = true;
                        player.oracleVisit = null;
                        message.edit(message.content + "\nYou visited no one.");
                        collector.stop();
                        updateNight();
                    }
                    else {
                        for (let target of players) {
                            if (target.id !== member.id && reaction.emoji.name === target.number + "\u20e3") {
                                player.data = null;
                                player.actionDone = true;
                                player.oracleVisit = target.id;
                                message.edit(message.content + "\nYou chose to visit " + target.name + ".");
                                collector.stop();
                                updateNight();
                                break;
                            }
                        }
                    }
                });
            }));
        },
        endNight: (member, player) => {
            if (!player.actionDone) {
                let [message, collector] = player.data;
                if (!player.actionDone) {
                    collector.stop();
                    player.actionDone = true;
                    player.oracleVisit = null;
                    message.edit(message.content + "\nNight ended. You visited no one.");
                }
                player.data = null;
            }
        },
        die: (member, player) => {
            let channel = client.channels.find((c) => c.id === mafiaChannel);
            if (player.oracleVisit) {
                for (let p of players) {
                    if (p.id === player.oracleVisit) {
                        channel.send("<@" + p.id + "> is a " + p.role.name + ".");
                        return;
                    }
                }
                for (let p of deadPlayers) {
                    if (p.id === player.oracleVisit) {
                        channel.send("<@" + p.id + "> is a " + p.role.name + ".");
                        return;
                    }
                }
            }
            else {
                channel.send("The Oracle didn't visit anyone.");
            }
        }
    },
    Doc: {
        name: "Doc",
        side: Side.VILLAGE,
        beginGame: (member, player) => {
            member.send("You are a Doc, number " + player.number + ".");
        },
        endGame: (member, player) => { },
        beginNight: (member, player) => {
            let text = "";
            if (day === 1) {
                text = " 1-" + players.length;
            }
            else {
                for (let player of players) {
                    if (player.id !== member.id) {
                        text += "\n" + player.number + "- " + player.name;
                    }
                }
            }
            member.send("Night " + day + " has begun. React with the number of who you wish to save." + text).then((message) => __awaiter(void 0, void 0, void 0, function* () {
                yield message.react("❌");
                for (let player of players) {
                    if (player.id !== member.id) {
                        yield message.react(player.number + "\u20e3");
                    }
                }
                let collector = message.createReactionCollector((reaction, user) => user.id === member.id);
                player.data = [message, collector];
                collector.on("collect", (reaction) => {
                    if (reaction.emoji.name === "❌") {
                        player.data = null;
                        player.actionDone = true;
                        message.edit(message.content + "\nYou saved no one.");
                        collector.stop();
                        updateNight();
                    }
                    else {
                        for (let target of players) {
                            if (target.id !== member.id && reaction.emoji.name === target.number + "\u20e3") {
                                player.data = null;
                                player.actionDone = true;
                                message.edit(message.content + "\nYou chose to save " + target.name + ".");
                                if (hookDecided) {
                                    hookDecided.push(() => {
                                        if (!player.hooked) {
                                            target.saved = true;
                                        }
                                    });
                                }
                                else {
                                    if (!player.hooked) {
                                        target.saved = true;
                                    }
                                }
                                collector.stop();
                                updateNight();
                                break;
                            }
                        }
                    }
                });
            }));
        },
        endNight: (member, player) => {
            if (!player.actionDone) {
                let [message, collector] = player.data;
                if (!player.actionDone) {
                    collector.stop();
                    message.edit(message.content + "\nNight ended. You saved no one.");
                    player.actionDone = true;
                }
                player.data = null;
            }
        },
        die: (member, player) => { }
    },
    MachoDoc: {
        name: "Macho Doc",
        side: Side.VILLAGE,
        macho: true,
        beginGame: (member, player) => {
            member.send("You are a Macho Doc, number " + player.number + ".");
        },
        endGame: (member, player) => { },
        beginNight: (member, player) => {
            let text = "";
            if (day === 1) {
                text = " 1-" + players.length;
            }
            else {
                for (let player of players) {
                    if (player.id !== member.id) {
                        text += "\n" + player.number + "- " + player.name;
                    }
                }
            }
            member.send("Night " + day + " has begun. React with the number of who you wish to save." + text).then((message) => __awaiter(void 0, void 0, void 0, function* () {
                yield message.react("❌");
                for (let player of players) {
                    if (player.id !== member.id) {
                        yield message.react(player.number + "\u20e3");
                    }
                }
                let collector = message.createReactionCollector((reaction, user) => user.id === member.id);
                player.data = [message, collector];
                collector.on("collect", (reaction) => {
                    if (reaction.emoji.name === "❌") {
                        player.data = null;
                        player.actionDone = true;
                        message.edit(message.content + "\nYou saved no one.");
                        collector.stop();
                        updateNight();
                    }
                    else {
                        for (let target of players) {
                            if (target.id !== member.id && reaction.emoji.name === target.number + "\u20e3") {
                                player.data = null;
                                player.actionDone = true;
                                message.edit(message.content + "\nYou chose to save " + target.name + ".");
                                if (hookDecided) {
                                    hookDecided.push(() => {
                                        if (!player.hooked) {
                                            if (target.saved) {
                                                target.saved = false;
                                            }
                                            else {
                                                target.saved = true;
                                            }
                                        }
                                    });
                                }
                                else {
                                    if (!player.hooked) {
                                        if (target.saved) {
                                            target.saved = false;
                                        }
                                        else {
                                            target.saved = true;
                                        }
                                    }
                                }
                                collector.stop();
                                updateNight();
                                break;
                            }
                        }
                    }
                });
            }));
        },
        endNight: (member, player) => {
            if (!player.actionDone) {
                let [message, collector] = player.data;
                if (!player.actionDone) {
                    collector.stop();
                    message.edit(message.content + "\nNight ended. You saved no one.");
                    player.actionDone = true;
                }
                player.data = null;
            }
        },
        die: (member, player) => {
            for (let p of players) {
                if (p.role.name === "Cop") {
                    p.role = roles.MachoCop;
                    member.guild.members.find((m) => m.id === p.id).send("You became a Macho Cop. You can't be saved by a doc anymore.");
                    break;
                }
            }
        }
    },
    Cop: {
        name: "Cop",
        side: Side.VILLAGE,
        beginGame: (member, player) => {
            member.send("You are a Cop, number " + player.number + ".");
        },
        endGame: (member, player) => { },
        beginNight: (member, player) => {
            let text = "";
            if (day === 1) {
                text = " 1-" + players.length;
            }
            else {
                for (let player of players) {
                    if (player.id !== member.id) {
                        text += "\n" + player.number + "- " + player.name;
                    }
                }
            }
            member.send("Night " + day + " has begun. React with the number of who you wish to investigate." + text).then((message) => __awaiter(void 0, void 0, void 0, function* () {
                let collector = message.createReactionCollector((reaction, user) => user.id === member.id);
                collector.on("collect", (reaction) => {
                    if (reaction.emoji.name === "❌") {
                        player.data = null;
                        player.actionDone = true;
                        message.edit(message.content + "\nYou investigated no one.");
                        collector.stop();
                        updateNight();
                    }
                    else {
                        for (let target of players) {
                            if (target.id !== member.id && reaction.emoji.name === target.number + "\u20e3") {
                                player.data = null;
                                player.actionDone = true;
                                if (hookDecided) {
                                    hookDecided.push(() => {
                                        if (player.hooked) {
                                            member.send("You were hooked.");
                                        }
                                        else {
                                            member.send(target.name + " is sided with the " + Side[getSide(target)].toLowerCase() + ".");
                                        }
                                    });
                                }
                                else {
                                    if (player.hooked) {
                                        member.send("You were hooked.");
                                    }
                                    else {
                                        member.send(target.name + " is sided with the " + Side[getSide(target)].toLowerCase() + ".");
                                    }
                                }
                                collector.stop();
                                updateNight();
                                break;
                            }
                        }
                    }
                });
                yield message.react("❌");
                for (let player of players) {
                    if (player.id !== member.id) {
                        yield message.react(player.number + "\u20e3");
                    }
                }
                player.data = [message, collector];
            }));
        },
        endNight: (member, player) => {
            if (player.data) {
                let [message, collector] = player.data;
                if (!player.actionDone) {
                    collector.stop();
                    message.edit(message.content + "\nNight action timed out. You investigated no one.");
                    player.actionDone = true;
                }
                player.data = null;
            }
        },
        die: (member, player) => { }
    },
    TalentScout: {
        name: "Talent Scout",
        side: Side.VILLAGE,
        beginGame: (member, player) => {
            member.send("You are a Talent Scout, number " + player.number + ". Each night, you can check whether someone has a talent. The only roles without talents are Blue and Vanilla.");
        },
        endGame: (member, player) => { },
        beginNight: (member, player) => {
            let text = "";
            if (day === 1) {
                text = " 1-" + players.length;
            }
            else {
                for (let player of players) {
                    if (player.id !== member.id) {
                        text += "\n" + player.number + "- " + player.name;
                    }
                }
            }
            member.send("Night " + day + " has begun. React with the number of who you wish to scout." + text).then((message) => __awaiter(void 0, void 0, void 0, function* () {
                let collector = message.createReactionCollector((reaction, user) => user.id === member.id);
                collector.on("collect", (reaction) => {
                    if (reaction.emoji.name === "❌") {
                        player.data = null;
                        player.actionDone = true;
                        message.edit(message.content + "\nYou scouted no one.");
                        collector.stop();
                        updateNight();
                    }
                    else {
                        for (let target of players) {
                            if (target.id !== member.id && reaction.emoji.name === target.number + "\u20e3") {
                                player.data = null;
                                player.actionDone = true;
                                if (hookDecided) {
                                    hookDecided.push(() => {
                                        if (player.hooked) {
                                            member.send("You were hooked.");
                                        }
                                        else {
                                            member.send(target.name + ((target.role.name === "Blue" || target.role.name === "Vanilla") ? " doesn't have a talent." : " has a talent."));
                                        }
                                    });
                                }
                                else {
                                    if (player.hooked) {
                                        member.send("You were hooked.");
                                    }
                                    else {
                                        member.send(target.name + ((target.role.name === "Blue" || target.role.name === "Vanilla") ? " doesn't have a talent." : " has a talent."));
                                    }
                                }
                                collector.stop();
                                updateNight();
                                break;
                            }
                        }
                    }
                });
                yield message.react("❌");
                for (let player of players) {
                    if (player.id !== member.id) {
                        yield message.react(player.number + "\u20e3");
                    }
                }
                player.data = [message, collector];
            }));
        },
        endNight: (member, player) => {
            if (player.data) {
                let [message, collector] = player.data;
                if (!player.actionDone) {
                    collector.stop();
                    message.edit(message.content + "\nNight action timed out. You scouted no one.");
                    player.actionDone = true;
                }
                player.data = null;
            }
        },
        die: (member, player) => { }
    },
    MachoCop: {
        name: "Macho Cop",
        side: Side.VILLAGE,
        macho: true,
        beginGame: (member, player) => {
            member.send("You are a Macho Cop, number " + player.number + ".");
        },
        endGame: (member, player) => { },
        beginNight: (member, player) => {
            let text = "";
            if (day === 1) {
                text = " 1-" + players.length;
            }
            else {
                for (let player of players) {
                    if (player.id !== member.id) {
                        text += "\n" + player.number + "- " + player.name;
                    }
                }
            }
            member.send("Night " + day + " has begun. React with the number of who you wish to investigate." + text).then((message) => __awaiter(void 0, void 0, void 0, function* () {
                let collector = message.createReactionCollector((reaction, user) => user.id === member.id);
                collector.on("collect", (reaction) => {
                    if (reaction.emoji.name === "❌") {
                        player.data = null;
                        player.actionDone = true;
                        message.edit(message.content + "\nYou investigated no one.");
                        collector.stop();
                        updateNight();
                    }
                    else {
                        for (let target of players) {
                            if (target.id !== member.id && reaction.emoji.name === target.number + "\u20e3") {
                                player.data = null;
                                player.actionDone = true;
                                if (hookDecided) {
                                    hookDecided.push(() => {
                                        if (player.hooked) {
                                            member.send("You were hooked.");
                                        }
                                        else {
                                            member.send(target.name + " is sided with the " + Side[getSide(target)].toLowerCase() + ".");
                                        }
                                    });
                                }
                                else {
                                    if (player.hooked) {
                                        member.send("You were hooked.");
                                    }
                                    else {
                                        member.send(target.name + " is sided with the " + Side[getSide(target)].toLowerCase() + ".");
                                    }
                                }
                                collector.stop();
                                updateNight();
                                break;
                            }
                        }
                    }
                });
                yield message.react("❌");
                for (let player of players) {
                    if (player.id !== member.id) {
                        yield message.react(player.number + "\u20e3");
                    }
                }
                player.data = [message, collector];
            }));
        },
        endNight: (member, player) => {
            if (player.data) {
                let [message, collector] = player.data;
                if (!player.actionDone) {
                    collector.stop();
                    message.edit(message.content + "\nNight action timed out. You investigated no one.");
                    player.actionDone = true;
                }
                player.data = null;
            }
        },
        die: (member, player) => { }
    },
    InsaneCop: {
        name: "Cop",
        realName: "Insane Cop",
        side: Side.VILLAGE,
        beginGame: (member, player) => {
            member.send("You are a Cop, number " + player.number + ".");
        },
        endGame: (member, player) => { },
        beginNight: (member, player) => {
            let text = "";
            if (day === 1) {
                text = " 1-" + players.length;
            }
            else {
                for (let player of players) {
                    if (player.id !== member.id) {
                        text += "\n" + player.number + "- " + player.name;
                    }
                }
            }
            member.send("Night " + day + " has begun. React with the number of who you wish to investigate." + text).then((message) => __awaiter(void 0, void 0, void 0, function* () {
                let collector = message.createReactionCollector((reaction, user) => user.id === member.id);
                collector.on("collect", (reaction) => {
                    if (reaction.emoji.name === "❌") {
                        player.data = null;
                        player.actionDone = true;
                        message.edit(message.content + "\nYou investigated no one.");
                        collector.stop();
                        updateNight();
                    }
                    else {
                        for (let target of players) {
                            if (target.id !== member.id && reaction.emoji.name === target.number + "\u20e3") {
                                player.data = null;
                                player.actionDone = true;
                                if (hookDecided) {
                                    hookDecided.push(() => {
                                        if (player.hooked) {
                                            member.send("You were hooked.");
                                        }
                                        else {
                                            member.send(target.name + " is sided with the " + (target.role.side === Side.MAFIA ? "village" : "mafia") + ".");
                                        }
                                    });
                                }
                                else {
                                    if (player.hooked) {
                                        member.send("You were hooked.");
                                    }
                                    else {
                                        member.send(target.name + " is sided with the " + (target.role.side === Side.MAFIA ? "village" : "mafia") + ".");
                                    }
                                }
                                collector.stop();
                                updateNight();
                                break;
                            }
                        }
                    }
                });
                yield message.react("❌");
                for (let player of players) {
                    if (player.id !== member.id) {
                        yield message.react(player.number + "\u20e3");
                    }
                }
                player.data = [message, collector];
            }));
        },
        endNight: (member, player) => {
            if (player.data) {
                let [message, collector] = player.data;
                if (!player.actionDone) {
                    collector.stop();
                    message.edit(message.content + "\nNight action timed out. You investigated no one.");
                    player.actionDone = true;
                }
                player.data = null;
            }
        },
        die: (member, player) => { }
    },
    ParanoidCop: {
        name: "Cop",
        realName: "Paranoid Cop",
        side: Side.VILLAGE,
        beginGame: (member, player) => {
            member.send("You are a Cop, number " + player.number + ".");
        },
        endGame: (member, player) => { },
        beginNight: (member, player) => {
            let text = "";
            if (day === 1) {
                text = " 1-" + players.length;
            }
            else {
                for (let player of players) {
                    if (player.id !== member.id) {
                        text += "\n" + player.number + "- " + player.name;
                    }
                }
            }
            member.send("Night " + day + " has begun. React with the number of who you wish to investigate." + text).then((message) => __awaiter(void 0, void 0, void 0, function* () {
                let collector = message.createReactionCollector((reaction, user) => user.id === member.id);
                collector.on("collect", (reaction) => {
                    if (reaction.emoji.name === "❌") {
                        player.data = null;
                        player.actionDone = true;
                        message.edit(message.content + "\nYou investigated no one.");
                        collector.stop();
                        updateNight();
                    }
                    else {
                        for (let target of players) {
                            if (target.id !== member.id && reaction.emoji.name === target.number + "\u20e3") {
                                player.data = null;
                                player.actionDone = true;
                                if (hookDecided) {
                                    hookDecided.push(() => {
                                        if (player.hooked) {
                                            member.send("You were hooked.");
                                        }
                                        else {
                                            member.send(target.name + " is sided with the mafia.");
                                        }
                                    });
                                }
                                else {
                                    if (player.hooked) {
                                        member.send("You were hooked.");
                                    }
                                    else {
                                        member.send(target.name + " is sided with the mafia.");
                                    }
                                }
                                collector.stop();
                                updateNight();
                                break;
                            }
                        }
                    }
                });
                yield message.react("❌");
                for (let player of players) {
                    if (player.id !== member.id) {
                        yield message.react(player.number + "\u20e3");
                    }
                }
                player.data = [message, collector];
            }));
        },
        endNight: (member, player) => {
            if (player.data) {
                let [message, collector] = player.data;
                if (!player.actionDone) {
                    collector.stop();
                    message.edit(message.content + "\nNight action timed out. You investigated no one.");
                    player.actionDone = true;
                }
                player.data = null;
            }
        },
        die: (member, player) => { }
    },
    NaiveCop: {
        name: "Cop",
        realName: "Naive Cop",
        side: Side.VILLAGE,
        beginGame: (member, player) => {
            member.send("You are a Cop, number " + player.number + ".");
        },
        endGame: (member, player) => { },
        beginNight: (member, player) => {
            let text = "";
            if (day === 1) {
                text = " 1-" + players.length;
            }
            else {
                for (let player of players) {
                    if (player.id !== member.id) {
                        text += "\n" + player.number + "- " + player.name;
                    }
                }
            }
            member.send("Night " + day + " has begun. React with the number of who you wish to investigate." + text).then((message) => __awaiter(void 0, void 0, void 0, function* () {
                let collector = message.createReactionCollector((reaction, user) => user.id === member.id);
                collector.on("collect", (reaction) => {
                    if (reaction.emoji.name === "❌") {
                        player.data = null;
                        player.actionDone = true;
                        message.edit(message.content + "\nYou investigated no one.");
                        collector.stop();
                        updateNight();
                    }
                    else {
                        for (let target of players) {
                            if (target.id !== member.id && reaction.emoji.name === target.number + "\u20e3") {
                                player.data = null;
                                player.actionDone = true;
                                if (hookDecided) {
                                    hookDecided.push(() => {
                                        if (player.hooked) {
                                            member.send("You were hooked.");
                                        }
                                        else {
                                            member.send(target.name + " is sided with the village.");
                                        }
                                    });
                                }
                                else {
                                    if (player.hooked) {
                                        member.send("You were hooked.");
                                    }
                                    else {
                                        member.send(target.name + " is sided with the village.");
                                    }
                                }
                                collector.stop();
                                updateNight();
                                break;
                            }
                        }
                    }
                });
                yield message.react("❌");
                for (let player of players) {
                    if (player.id !== member.id) {
                        yield message.react(player.number + "\u20e3");
                    }
                }
                player.data = [message, collector];
            }));
        },
        endNight: (member, player) => {
            if (player.data) {
                let [message, collector] = player.data;
                if (!player.actionDone) {
                    collector.stop();
                    message.edit(message.content + "\nNight action timed out. You investigated no one.");
                    player.actionDone = true;
                }
                player.data = null;
            }
        },
        die: (member, player) => { }
    },
    Gunsmith: {
        name: "Gunsmith",
        side: Side.VILLAGE,
        beginGame: (member, player) => {
            member.send("You are a Gunsmith, number " + player.number + ".");
        },
        endGame: (member, player) => { },
        beginNight: (member, player) => {
            let text = "";
            if (day === 1) {
                text = " 1-" + players.length;
            }
            else {
                for (let player of players) {
                    if (player.id !== member.id) {
                        text += "\n" + player.number + "- " + player.name;
                    }
                }
            }
            member.send("Night " + day + " has begun. React with the number of who you wish to give a gun to." + text).then((message) => __awaiter(void 0, void 0, void 0, function* () {
                let collector = message.createReactionCollector((reaction, user) => user.id === member.id);
                collector.on("collect", (reaction) => {
                    if (reaction.emoji.name === "❌") {
                        player.data = null;
                        player.actionDone = true;
                        message.edit(message.content + "\nYou gave a gun to no one.");
                        collector.stop();
                        updateNight();
                    }
                    else {
                        for (let target of players) {
                            if (target.id !== member.id && reaction.emoji.name === target.number + "\u20e3") {
                                player.data = null;
                                player.actionDone = true;
                                message.edit(message.content + "\nYou decided to give a gun to " + target.name + ".");
                                if (hookDecided) {
                                    hookDecided.push(() => {
                                        if (!player.hooked) {
                                            target.gun = true;
                                        }
                                    });
                                }
                                else {
                                    if (!player.hooked) {
                                        target.gun = true;
                                    }
                                }
                                collector.stop();
                                updateNight();
                                break;
                            }
                        }
                    }
                });
                yield message.react("❌");
                for (let player of players) {
                    if (player.id !== member.id) {
                        yield message.react(player.number + "\u20e3");
                    }
                }
                player.data = [message, collector];
            }));
        },
        endNight: (member, player) => {
            if (player.data) {
                let [message, collector] = player.data;
                if (!player.actionDone) {
                    collector.stop();
                    message.edit(message.content + "\nNight action timed out. You gave a gun to no one.");
                    player.actionDone = true;
                }
                player.data = null;
            }
        },
        die: (member, player) => { }
    },
    Deputy: {
        name: "Deputy",
        side: Side.VILLAGE,
        beginGame: (member, player) => {
            member.send("You are a Deputy, number " + player.number + ". Your identity will not be revealed when shooting someone.");
            player.gun = true;
        },
        endGame: (member, player) => { },
        beginNight: (member, player) => {
            player.actionDone = true;
        },
        endNight: (member, player) => { },
        die: (member, player) => { }
    },
    Vanilla: {
        name: "Vanilla",
        side: Side.MAFIA,
        beginGame: (member, player) => {
            let secret = member.guild.channels.find((x) => x.name === "mafia-secret-chat");
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ADD_REACTIONS: true });
            setTimeout(() => {
                secret.send("<@" + member.id + ">, You are a Vanilla, number " + player.number + ".");
            }, 2000);
        },
        endGame: (member, player) => {
            let secret = member.guild.channels.find((x) => x.name === "mafia-secret-chat");
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ADD_REACTIONS: true });
            let overwrites = secret.permissionOverwrites.find((overwrites) => overwrites.type === "member" && overwrites.id === member.id);
            if (overwrites) {
                overwrites.delete();
            }
        },
        beginNight: (member, player) => {
            let secret = member.guild.channels.find((x) => x.name === "mafia-secret-chat");
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ADD_REACTIONS: true });
            player.actionDone = true;
        },
        endNight: (member, player) => { },
        die: (member, player) => {
            let secret = member.guild.channels.find((x) => x.name === "mafia-secret-chat");
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: false, ADD_REACTIONS: false });
        }
    },
    VengefulVanilla: {
        name: "Vengeful Vanilla",
        side: Side.MAFIA,
        vengeful: true,
        beginGame: (member, player) => {
            let secret = member.guild.channels.find((x) => x.name === "mafia-secret-chat");
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ADD_REACTIONS: true });
            setTimeout(() => {
                secret.send("<@" + member.id + ">, You are a Vanilla, number " + player.number + ".");
            }, 2000);
        },
        endGame: (member, player) => {
            let secret = member.guild.channels.find((x) => x.name === "mafia-secret-chat");
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ADD_REACTIONS: true });
            let overwrites = secret.permissionOverwrites.find((overwrites) => overwrites.type === "member" && overwrites.id === member.id);
            if (overwrites) {
                overwrites.delete();
            }
        },
        beginNight: (member, player) => {
            let secret = member.guild.channels.find((x) => x.name === "mafia-secret-chat");
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ADD_REACTIONS: true });
            player.actionDone = true;
        },
        endNight: (member, player) => { },
        die: (member, player) => {
            let secret = member.guild.channels.find((x) => x.name === "mafia-secret-chat");
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: false, ADD_REACTIONS: false });
        }
    },
    Hooker: {
        name: "Hooker",
        side: Side.MAFIA,
        beginGame: (member, player) => {
            let secret = member.guild.channels.find((x) => x.name === "mafia-secret-chat");
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ADD_REACTIONS: true });
            setTimeout(() => {
                secret.send("<@" + member.id + ">, You are a Hooker, number " + player.number + ".");
            }, 2000);
        },
        endGame: (member, player) => {
            let secret = member.guild.channels.find((x) => x.name === "mafia-secret-chat");
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ADD_REACTIONS: true });
            let overwrites = secret.permissionOverwrites.find((overwrites) => overwrites.type === "member" && overwrites.id === member.id);
            if (overwrites) {
                overwrites.delete();
            }
        },
        beginNight: (member, player) => {
            hookDecided = [];
            let secret = member.guild.channels.find((x) => x.name === "mafia-secret-chat");
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ADD_REACTIONS: true });
            secret.send("<@" + member.id + "> Use `;hook <number>` to hook someone, or just `;hook` to not hook tonight.");
            let collector = secret.createMessageCollector((message) => message.content.match(/^;hook( [0-9]+)?$/) && message.author.id === member.id);
            collector.on("collect", (message, collector) => {
                let match = message.content.match(/^;hook ([0-9]+)$/);
                if (match) {
                    let n = parseInt(match[1]);
                    for (let target of players) {
                        if (target.number === n) {
                            collector.stop();
                            player.data = null;
                            target.hooked = true;
                            for (let cb of hookDecided) {
                                cb();
                            }
                            hookDecided = null;
                            message.reply("You decided to hook number " + target.number + ", " + target.name + ".");
                            player.actionDone = true;
                            updateNight();
                        }
                    }
                }
                else if (message.content === ";hook") {
                    collector.stop();
                    player.data = null;
                    let secret = member.guild.channels.find((x) => x.name === "mafia-secret-chat");
                    secret.send("<@" + member.id + "> You decided to hook no one.");
                    for (let cb of hookDecided) {
                        cb();
                    }
                    hookDecided = null;
                    player.actionDone = true;
                    updateNight();
                }
            });
            player.data = collector;
        },
        endNight: (member, player) => {
            if (player.data) {
                if (!player.actionDone) {
                    let secret = member.guild.channels.find((x) => x.name === "mafia-secret-chat");
                    secret.send("<@" + member.id + "> Hook timed out. You hook no one.");
                    player.actionDone = true;
                    for (let cb of hookDecided) {
                        cb();
                    }
                    hookDecided = null;
                }
                player.data.stop();
                player.data = null;
            }
        },
        die: (member, player) => {
            let secret = member.guild.channels.find((x) => x.name === "mafia-secret-chat");
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: false, ADD_REACTIONS: false });
        }
    },
    Godfather: {
        name: "Godfather",
        side: Side.MAFIA,
        fakeSide: Side.VILLAGE,
        beginGame: (member, player) => {
            let secret = member.guild.channels.find((x) => x.name === "mafia-secret-chat");
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ADD_REACTIONS: true });
            setTimeout(() => {
                secret.send("<@" + member.id + ">, You are a Godfather, number " + player.number + ".");
            }, 2000);
        },
        endGame: (member, player) => {
            let secret = member.guild.channels.find((x) => x.name === "mafia-secret-chat");
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ADD_REACTIONS: true });
            let overwrites = secret.permissionOverwrites.find((overwrites) => overwrites.type === "member" && overwrites.id === member.id);
            if (overwrites) {
                overwrites.delete();
            }
        },
        beginNight: (member, player) => {
            let secret = member.guild.channels.find((x) => x.name === "mafia-secret-chat");
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ADD_REACTIONS: true });
            player.actionDone = true;
        },
        endNight: (member, player) => { },
        die: (member, player) => {
            let secret = member.guild.channels.find((x) => x.name === "mafia-secret-chat");
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: false, ADD_REACTIONS: false });
        }
    },
    Janitor: {
        name: "Janitor",
        side: Side.MAFIA,
        beginGame: (member, player) => {
            let secret = member.guild.channels.find((x) => x.name === "mafia-secret-chat");
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ADD_REACTIONS: true });
            setTimeout(() => {
                secret.send("<@" + member.id + ">, You are a Janitor, number " + player.number + ".");
            }, 2000);
        },
        endGame: (member, player) => {
            let secret = member.guild.channels.find((x) => x.name === "mafia-secret-chat");
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ADD_REACTIONS: true });
            let overwrites = secret.permissionOverwrites.find((overwrites) => overwrites.type === "member" && overwrites.id === member.id);
            if (overwrites) {
                overwrites.delete();
            }
        },
        beginNight: (member, player) => {
            let secret = member.guild.channels.find((x) => x.name === "mafia-secret-chat");
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ADD_REACTIONS: true });
            if (player.janitorCleaned) {
                secret.send("<@" + member.id + "> You already cleaned someone. You can't clean anymore.");
                player.actionDone = true;
                return;
            }
            secret.send("<@" + member.id + "> Use `;clean <number>` to clean someone, or just `;clean` to not clean tonight. **You can only do this successfully once.**");
            let collector = secret.createMessageCollector((message) => message.content.match(/^;clean( [0-9]+)?$/) && message.author.id === member.id);
            collector.on("collect", (message, collector) => {
                let match = message.content.match(/^;clean ([0-9]+)$/);
                if (match) {
                    let n = parseInt(match[1]);
                    for (let target of players) {
                        if (target.number === n) {
                            collector.stop();
                            player.data = null;
                            target.cleaned = true;
                            message.reply("You decided to clean number " + target.number + ", " + target.name + ".");
                            player.actionDone = true;
                            updateNight();
                        }
                    }
                }
                else if (message.content === ";clean") {
                    collector.stop();
                    player.data = null;
                    let secret = member.guild.channels.find((x) => x.name === "mafia-secret-chat");
                    secret.send("<@" + member.id + "> You decided to clean no one.");
                    player.actionDone = true;
                    updateNight();
                }
            });
            player.data = collector;
        },
        endNight: (member, player) => {
            if (player.data) {
                if (!player.actionDone) {
                    let secret = member.guild.channels.find((x) => x.name === "mafia-secret-chat");
                    secret.send("<@" + member.id + "> Clean timed out. You clean no one.");
                    player.actionDone = true;
                }
                player.data.stop();
                player.data = null;
            }
        },
        die: (member, player) => {
            let secret = member.guild.channels.find((x) => x.name === "mafia-secret-chat");
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: false, ADD_REACTIONS: false });
        }
    },
    Illusionist: {
        name: "Illusionist",
        side: Side.MAFIA,
        beginGame: (member, player) => {
            let secret = member.guild.channels.find((x) => x.name === "mafia-secret-chat");
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ADD_REACTIONS: true });
            setTimeout(() => {
                secret.send("<@" + member.id + ">, You are an Illusionist, number " + player.number + ".");
            }, 2000);
            player.gun = true;
        },
        endGame: (member, player) => {
            let secret = member.guild.channels.find((x) => x.name === "mafia-secret-chat");
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ADD_REACTIONS: true });
            let overwrites = secret.permissionOverwrites.find((overwrites) => overwrites.type === "member" && overwrites.id === member.id);
            if (overwrites) {
                overwrites.delete();
            }
        },
        beginNight: (member, player) => {
            let secret = member.guild.channels.find((x) => x.name === "mafia-secret-chat");
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ADD_REACTIONS: true });
            if (!player.gun) {
                secret.send("<@" + member.id + "> You don't have a gun. You can't frame someone.");
                player.actionDone = true;
                return;
            }
            secret.send("<@" + member.id + "> Use `;frame <number>` to frame someone, or just `;frame` to not frame someone tonight. If you shoot someone tomorrow, that person will be shown as the shooter. If you don't frame someone, you will be revealed as the shooter.");
            let collector = secret.createMessageCollector((message) => message.content.match(/^;frame( [0-9]+)?$/) && message.author.id === member.id);
            collector.on("collect", (message, collector) => {
                let match = message.content.match(/^;frame ([0-9]+)$/);
                if (match) {
                    let n = parseInt(match[1]);
                    for (let target of players) {
                        if (target.number === n) {
                            collector.stop();
                            player.data = null;
                            player.frame = target.number;
                            message.reply("You decided to frame number " + target.number + ", " + target.name + ".");
                            player.actionDone = true;
                            updateNight();
                        }
                    }
                }
                else if (message.content === ";frame") {
                    collector.stop();
                    player.data = null;
                    player.frame = 0;
                    let secret = member.guild.channels.find((x) => x.name === "mafia-secret-chat");
                    secret.send("<@" + member.id + "> You decided to frame no one.");
                    player.actionDone = true;
                    updateNight();
                }
            });
            player.data = collector;
        },
        endNight: (member, player) => {
            if (player.data) {
                if (!player.actionDone) {
                    player.frame = 0;
                    let secret = member.guild.channels.find((x) => x.name === "mafia-secret-chat");
                    secret.send("<@" + member.id + "> Frame timed out. You frame no one.");
                    player.actionDone = true;
                }
                player.data.stop();
                player.data = null;
            }
        },
        die: (member, player) => {
            let secret = member.guild.channels.find((x) => x.name === "mafia-secret-chat");
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: false, ADD_REACTIONS: false });
        }
    },
    Dreamer: {
        name: "Dreamer",
        side: Side.VILLAGE,
        beginGame: (member, player) => {
            member.send("You are a Dreamer, number " + player.number + ".");
        },
        endGame: (member, player) => { },
        beginNight: (member, player) => {
            let v = Math.floor(Math.random() * 2);
            let dream;
            if (v == 0) {
                // dream of one innocent person
                let innos = [];
                for (let p of players) {
                    if (p.id !== player.id && getSide(p) === Side.VILLAGE) {
                        innos.push(p);
                    }
                }
                if (innos.length == 0) {
                    dream = "You dreamt of an innocent person: yourself! Everybody else is guilty!";
                }
                else {
                    dream = "You dreamt of an innocent person: " + innos[Math.floor(Math.random() * innos.length)].name + "!";
                }
            }
            else if (v == 1) {
                // dream of three people, at least one of which is mafia
                let others = players.filter((v) => v.id !== player.id);
                if (others.length == 1) {
                    dream = "You dreamt of a suspect: " + others[0].name + "! They're guilty!";
                }
                else if (others.length == 2) {
                    dream = "You dreamt of two suspects: " + others.map((v) => v.name).join(", ") + "! At least one of them is guilty.";
                }
                else if (others.length == 3) {
                    dream = "You dreamt of three suspects: " + others.map((v) => v.name).join(", ") + "! At least one of them is guilty.";
                }
                else {
                    let p;
                    do {
                        p = [Math.floor(Math.random() * others.length),
                            Math.floor(Math.random() * (others.length - 1)),
                            Math.floor(Math.random() * (others.length - 2))];
                        if (p[1] >= p[0])
                            p[1]++;
                        if (p[2] >= p[0])
                            p[2]++;
                        if (p[2] >= p[1])
                            p[2]++;
                    } while (!isSide(others[p[0]], Side.MAFIA) && !isSide(others[p[1]], Side.MAFIA) && !isSide(others[p[2]], Side.MAFIA));
                    dream = "You dreamt of three suspects: " + p.map((v) => others[v].name).join(", ") + "! At least one of them is guilty.";
                }
            }
            member.send("Night " + day + " has begun, and you went to sleep.");
            player.actionDone = true;
            if (hookDecided) {
                hookDecided.push(() => {
                    if (player.hooked) {
                        member.send("You were hooked.");
                    }
                    else {
                        member.send(dream);
                    }
                    player.actionDone = true;
                });
            }
            else {
                if (player.hooked) {
                    member.send("You were hooked.");
                }
                else {
                    member.send(dream);
                }
                player.actionDone = true;
            }
            updateNight();
        },
        endNight: (member, player) => { },
        die: (member, player) => { }
    }
};
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
function countSides() {
    let village = 0;
    let mafia = 0;
    let third = 0;
    for (let player of players) {
        if (player.role.side === Side.VILLAGE) {
            if (player.gun) {
                village += 2;
            }
            else {
                village++;
            }
        }
        else if (player.role.side === Side.MAFIA) {
            mafia++;
        }
        else if (player.role.side === Side.THIRD) {
            third++;
        }
    }
    return [village, mafia, third];
}
function listLynch() {
    let text = "";
    for (let player of players) {
        if (player.lynchVote === "nobody") {
            text += "\n" + player.name + " votes to lynch nobody";
        }
        else {
            for (let player2 of players) {
                if (player.lynchVote === player2.id) {
                    text += "\n" + player.name + " votes to lynch " + player2.name;
                    break;
                }
            }
        }
    }
    let lynch = calculateLynch();
    if (!lynch) {
        lynch = "nobody";
    }
    else {
        let found = false;
        for (let player of players) {
            if (lynch === player.id) {
                lynch = player.name;
                found = true;
            }
        }
        if (!found) {
            lynch = "(no user found <:Oumwha:498525028782964746>, ID " + lynch + " of type " + typeof (lynch) + ")";
        }
    }
    return text + "\n**The consensus is to lynch " + lynch + ".**";
}
function calculateLynch() {
    let votes = {};
    for (let player of players) {
        if (player.lynchVote) {
            if (votes.hasOwnProperty(player.lynchVote)) {
                votes[player.lynchVote]++;
            }
            else {
                votes[player.lynchVote] = 1;
            }
        }
    }
    let lynch = "nobody";
    let biggest = 0;
    for (let [id, num] of Object.entries(votes)) {
        if (num > biggest) {
            lynch = id;
            biggest = num;
        }
        else if (num === biggest) {
            lynch = "nobody";
        }
    }
    return lynch === "nobody" ? null : lynch;
}
function beginNight(channel, mafiaPlayer) {
    if (!gameRunning)
        return;
    channel.overwritePermissions(mafiaPlayer, { SEND_MESSAGES: false, ADD_REACTIONS: false, ATTACH_FILES: false });
    channel.send("<@&" + mafiaPlayer.id + "> Night " + day + " has begun. You have 7 minutes to act. If you are a power role, check your DMs. If you are mafia, check the mafia secret chat.");
    for (let player of players) {
        player.role.beginNight(channel.guild.members.find((x) => x.id === player.id), player);
    }
    let secret = channel.guild.channels.find((x) => x.name === "mafia-secret-chat");
    let text = "";
    if (day === 1) {
        text = " 1-" + players.length;
    }
    else {
        for (let player of players) {
            text += "\n" + player.number + "- " + player.name;
        }
    }
    mafiaKill = 0;
    setTimeout(() => {
        secret.send("<@&" + mafiaPlayer.id + "> Night " + day + " has begun. Use `;kill <number>` to choose who to kill, or just `;kill` to not kill tonight. You cannot change your choice, so be careful." + text);
    }, 1000);
    let collector = secret.createMessageCollector((message) => message.content.match(/^;kill( [1-9][0-9]*)?$/) !== null);
    collector.on("collect", (message) => {
        let killer;
        for (let player of players) {
            if (player.id === message.author.id) {
                killer = player.number;
                break;
            }
        }
        if (!killer) {
            return;
        }
        if (message.content === ";kill") {
            mafiaKill = -1;
            mafiaKiller = 0;
            message.reply("You decided to kill no one.");
            collector.stop();
            updateNight();
        }
        else {
            let number = parseInt(message.content.match(/^;kill ([1-9][0-9]*)$/)[1]);
            for (let player of players) {
                if (player.number === number) {
                    mafiaKill = number;
                    mafiaKiller = killer;
                    message.reply("You decided to kill number " + number + ", " + player.name + ".");
                    collector.stop();
                    updateNight();
                    break;
                }
            }
        }
    });
    updateNightf = () => {
        if ((mafiaKill === 0 && nightTimeout) || !gameRunning)
            return;
        let allDone = true;
        for (let player of players) {
            if (!player.actionDone) {
                allDone = false;
            }
        }
        if (allDone || !nightTimeout) {
            updateNightf = null;
            if (nightTimeout) {
                clearTimeout(nightTimeout);
            }
            collector.stop();
            for (let player of players) {
                let member = channel.guild.members.find((x) => x.id === player.id);
                if (!daychatGame && player.role.side === Side.MAFIA) {
                    secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: false, ADD_REACTIONS: false });
                }
                player.role.endNight(member, player);
            }
            if (mafiaKill === -2) {
                secret.send("Kill timed out. You kill no one.");
                channel.send("Nobody was killed!");
            }
            else if (mafiaKill === -1) {
                channel.send("Nobody was killed!");
            }
            else {
                for (let [i, player] of players.entries()) {
                    if (player.number === mafiaKill && (!player.saved || player.role.macho)) {
                        if (player.cleaned) {
                            for (let player of players) {
                                if (player.role.name === "Janitor") {
                                    player.janitorCleaned = true;
                                    break;
                                }
                            }
                            for (let player of deadPlayers) {
                                if (player.role.name === "Janitor") {
                                    player.janitorCleaned = true;
                                    break;
                                }
                            }
                            channel.send("<@" + player.id + "> is missing!");
                            secret.send("<@&" + mafiaPlayer.id + "> While cleaning up the mess, you learned that " + player.name + " is a " + player.role.name + ".");
                        }
                        else {
                            let m = death_messages[Math.floor(Math.random() * death_messages.length)];
                            channel.send(m.replace(/%pr/g, "<@" + player.id + "> (the " + player.role.name + ")").replace(/%p/g, "<@" + player.id + ">").replace(/%r/g, player.role.name));
                        }
                        let member = channel.guild.members.find((x) => x.id === player.id);
                        player.role.die(member, player);
                        member.removeRole(mafiaPlayer);
                        players.splice(i, 1);
                        deadPlayers.push(player);
                        if (player.role.name === "Bomb") {
                            for (let [i, player] of players.entries()) {
                                if (player.number === mafiaKiller && (!player.saved || player.role.macho)) {
                                    if (player.cleaned) {
                                        channel.send("<@" + player.id + "> exploded.");
                                    }
                                    else {
                                        channel.send("<@" + player.id + ">, the " + player.role.name + ", exploded.");
                                    }
                                    let member = channel.guild.members.find((x) => x.id === player.id);
                                    player.role.die(member, player);
                                    member.removeRole(mafiaPlayer);
                                    players.splice(i, 1);
                                    deadPlayers.push(player);
                                    break;
                                }
                            }
                        }
                        break;
                    }
                }
                let [village, mafia, third] = countSides();
                if (vengefulGame ? village === 0 && mafia > 0 : mafia >= village) {
                    let text = "";
                    for (let player of players) {
                        let won = player.role.side === Side.MAFIA;
                        if (won) {
                            text += " <@" + player.id + ">";
                        }
                        gameInfo.players.push({
                            id: player.id,
                            name: player.name,
                            role: player.role.realName || player.role.name,
                            side: Side[player.role.side].toLowerCase(),
                            won,
                            alive: true
                        });
                    }
                    for (let player of deadPlayers) {
                        let won = player.role.side === Side.MAFIA;
                        if (won) {
                            text += " <@" + player.id + ">";
                        }
                        gameInfo.players.push({
                            id: player.id,
                            name: player.name,
                            role: player.role.realName || player.role.name,
                            side: Side[player.role.side].toLowerCase(),
                            won,
                            alive: false
                        });
                    }
                    gameInfo.winningSide = "mafia";
                    channel.send("<@&" + mafiaPlayer.id + "> The Mafia won!" + text);
                    endGame(channel, mafiaPlayer);
                    return;
                }
                else if (vengefulGame ? mafia === 0 && village > 0 : mafia === 0) {
                    let text = "";
                    for (let player of players) {
                        let won = player.role.side === Side.VILLAGE;
                        if (won) {
                            text += " <@" + player.id + ">";
                        }
                        gameInfo.players.push({
                            id: player.id,
                            name: player.name,
                            role: player.role.realName || player.role.name,
                            side: Side[player.role.side].toLowerCase(),
                            won,
                            alive: true
                        });
                    }
                    for (let player of deadPlayers) {
                        let won = player.role.side === Side.VILLAGE;
                        if (won) {
                            text += " <@" + player.id + ">";
                        }
                        gameInfo.players.push({
                            id: player.id,
                            name: player.name,
                            role: player.role.realName || player.role.name,
                            side: Side[player.role.side].toLowerCase(),
                            won,
                            alive: false
                        });
                    }
                    gameInfo.winningSide = "village";
                    channel.send("<@&" + mafiaPlayer.id + "> The Village won!" + text);
                    endGame(channel, mafiaPlayer);
                    return;
                }
                else if (mafia === 0 && village === 0) {
                    gameInfo.winningSide = "tie";
                    channel.send("<@&" + mafiaPlayer.id + "> It was a tie!");
                    endGame(channel, mafiaPlayer);
                    return;
                }
            }
            mafiaKill = 0;
            for (let player of players) {
                player.saved = false;
                player.hooked = false;
                player.cleaned = false;
                player.lynchVote = null;
                player.data = null;
                player.actionDone = false;
            }
            beginDay(channel, mafiaPlayer);
        }
    };
    if (nightTimeout) {
        clearTimeout(nightTimeout);
    }
    nightTimeout = setTimeout(() => {
        nightTimeout = null;
        for (let player of players) {
            player.role.endNight(channel.guild.members.find((x) => x.id === player.id), player);
        }
        if (mafiaKill === 0) {
            mafiaKill = -2;
        }
        updateNight();
    }, 420000);
}
function beginDay(channel, mafiaPlayer) {
    if (cantBeginDay || !gameRunning) {
        return;
    }
    cantBeginDay = true;
    cantEndDay = false;
    let numbers = "";
    for (let player of players) {
        numbers += "\n" + player.number + "- " + player.name;
    }
    for (let player of players) {
        if (player.gun) {
            channel.guild.members.find((m) => m.id === player.id).send("You have a gun. DM me `;shoot <number>` at any time during the day to shoot someone." + numbers);
        }
    }
    let [village, mafia, third] = countSides();
    channel.send("<@&" + mafiaPlayer.id + "> Day " + day++ + " has begun. You have 10 minutes to vote who to lynch with `;lynch @usermention`." + numbers);
    if (!vengefulGame) {
        if (village === mafia + 2) {
            channel.send("**It is MYLO, so the village must either lynch correctly or not lynch, otherwise there will be a high chance of losing.**");
        }
        else if (village === mafia + 1) {
            channel.send("**It is LYLO, so the village must lynch correctly, otherwise there will be a high chance of losing.**");
        }
    }
    channel.overwritePermissions(mafiaPlayer, { SEND_MESSAGES: true, ADD_REACTIONS: true, ATTACH_FILES: false });
    if (dayTimeout) {
        clearTimeout(dayTimeout);
    }
    dayTimeout = setTimeout(() => {
        channel.send("5min remaining.");
        dayTimeout = setTimeout(() => {
            channel.send("2min30s remaining.");
            dayTimeout = setTimeout(() => {
                channel.send("1min remaining.");
                dayTimeout = setTimeout(() => {
                    channel.send("10");
                    dayTimeout = setTimeout(() => {
                        channel.send("9");
                        dayTimeout = setTimeout(() => {
                            channel.send("8");
                            dayTimeout = setTimeout(() => {
                                channel.send("7");
                                dayTimeout = setTimeout(() => {
                                    channel.send("6");
                                    dayTimeout = setTimeout(() => {
                                        channel.send("5");
                                        dayTimeout = setTimeout(() => {
                                            channel.send("4");
                                            dayTimeout = setTimeout(() => {
                                                channel.send("3");
                                                dayTimeout = setTimeout(() => {
                                                    channel.send("2");
                                                    dayTimeout = setTimeout(() => {
                                                        channel.send("1");
                                                        dayTimeout = setTimeout(() => {
                                                            dayTimeout = null;
                                                            if (dayCollector) {
                                                                dayCollector.stop();
                                                                dayCollector = null;
                                                            }
                                                            endDay(channel, mafiaPlayer);
                                                        }, 1000);
                                                    }, 1000);
                                                }, 1000);
                                            }, 1000);
                                        }, 1000);
                                    }, 1000);
                                }, 1000);
                            }, 1000);
                        }, 1000);
                    }, 1000);
                }, 50000);
            }, 90000);
        }, 150000);
    }, 300000);
    if (dayCollector) {
        dayCollector.stop();
        dayCollector = null;
    }
    dayCollector = channel.createMessageCollector((message) => message.content.match(/^;((lynch|shoot)( <@!?([0-9]{17,18})>)?|listlynch|removelynch)$/));
    dayCollector.on("collect", (message, collector) => {
        let allVoted = true;
        for (let player of players) {
            if (player.id === message.author.id) {
                if (message.content === ";lynch") {
                    player.lynchVote = "nobody";
                    message.react("497430068331544577");
                }
                else if (message.content === ";removelynch") {
                    player.lynchVote = null;
                    message.react("497430068331544577");
                }
                else if (message.content === ";listlynch") {
                    message.reply(listLynch());
                }
                else if (message.content === ";lynch") {
                    dontRecordGame = true;
                    player.lynchVote = "nobody";
                    message.react("497430068331544577");
                }
                else {
                    let match = message.content.match(/^;lynch <@!?([0-9]{17,18})>$/);
                    if (match) {
                        for (let player2 of players) {
                            if (player2.id === match[1]) {
                                player.lynchVote = player2.id;
                                message.react("497430068331544577");
                                break;
                            }
                        }
                    }
                }
            }
            if (player.lynchVote === null) {
                allVoted = false;
            }
        }
        if (allVoted) {
            collector.stop();
            dayCollector = null;
            clearTimeout(dayTimeout);
            endDay(channel, mafiaPlayer);
        }
    });
}
function endDay(channel, mafiaPlayer) {
    return __awaiter(this, void 0, void 0, function* () {
        if (cantEndDay || !gameRunning) {
            return;
        }
        cantEndDay = true;
        if (dayCollector) {
            dayCollector.stop();
            dayCollector = null;
        }
        cantBeginDay = false;
        channel.overwritePermissions(mafiaPlayer, { SEND_MESSAGES: false, ADD_REACTIONS: false, ATTACH_FILES: false });
        channel.send(listLynch());
        let lynch = calculateLynch();
        if (lynch) {
            let player;
            let member;
            for (let [i, p] of players.entries()) {
                if (p.id === lynch) {
                    channel.send("<@" + p.id + ">, the " + p.role.name + ", was lynched.");
                    member = channel.guild.members.find((x) => x.id === p.id);
                    p.role.die(member, p);
                    player = p;
                    member.removeRole(mafiaPlayer);
                    players.splice(i, 1);
                    deadPlayers.push(p);
                    break;
                }
            }
            let testGameEnd = () => {
                let [village, mafia, third] = countSides();
                if (vengefulGame ? village === 0 && mafia > 0 : mafia >= village) {
                    let text = "";
                    for (let player of players) {
                        let won = player.role.side === Side.MAFIA;
                        if (won) {
                            text += " <@" + player.id + ">";
                        }
                        gameInfo.players.push({
                            id: player.id,
                            name: player.name,
                            role: player.role.realName || player.role.name,
                            side: Side[player.role.side].toLowerCase(),
                            won,
                            alive: true
                        });
                    }
                    for (let player of deadPlayers) {
                        let won = player.role.side === Side.MAFIA;
                        if (won) {
                            text += " <@" + player.id + ">";
                        }
                        gameInfo.players.push({
                            id: player.id,
                            name: player.name,
                            role: player.role.realName || player.role.name,
                            side: Side[player.role.side].toLowerCase(),
                            won,
                            alive: false
                        });
                    }
                    gameInfo.winningSide = "mafia";
                    channel.send("<@&" + mafiaPlayer.id + "> The Mafia won!" + text);
                    endGame(channel, mafiaPlayer);
                    return true;
                }
                else if (vengefulGame ? mafia === 0 && village > 0 : mafia === 0) {
                    let text = "";
                    for (let player of players) {
                        let won = player.role.side === Side.VILLAGE;
                        if (won) {
                            text += " <@" + player.id + ">";
                        }
                        gameInfo.players.push({
                            id: player.id,
                            name: player.name,
                            role: player.role.realName || player.role.name,
                            side: Side[player.role.side].toLowerCase(),
                            won,
                            alive: true
                        });
                    }
                    for (let player of deadPlayers) {
                        let won = player.role.side === Side.VILLAGE;
                        if (won) {
                            text += " <@" + player.id + ">";
                        }
                        gameInfo.players.push({
                            id: player.id,
                            name: player.name,
                            role: player.role.realName || player.role.name,
                            side: Side[player.role.side].toLowerCase(),
                            won,
                            alive: false
                        });
                    }
                    gameInfo.winningSide = "village";
                    channel.send("<@&" + mafiaPlayer.id + "> The Village won!" + text);
                    endGame(channel, mafiaPlayer);
                    return true;
                }
                else if (mafia === 0 && village === 0) {
                    gameInfo.winningSide = "tie";
                    channel.send("<@&" + mafiaPlayer.id + "> It was a tie!");
                    endGame(channel, mafiaPlayer);
                    return true;
                }
                return false;
            };
            if (testGameEnd())
                return;
            if (player && player.role.vengeful) {
                let msg = yield channel.send("<@" + player.id + ">, choose someone to kill in revenge. You have 2 minutes.");
                let collector = msg.createReactionCollector((reaction, user) => user.id === member.id);
                collector.on("collect", (reaction, collector) => {
                    if (reaction.emoji.name === "❌") {
                        channel.send("No one was killed in revenge.");
                        clearTimeout(timeout);
                        collector.stop();
                        if (!testGameEnd()) {
                            if (nightlessGame) {
                                beginDay(channel, mafiaPlayer);
                            }
                            else {
                                beginNight(channel, mafiaPlayer);
                            }
                        }
                    }
                    else if (reaction.emoji.name.endsWith + "\u20e3") {
                        for (let [i, player] of players.entries()) {
                            if (player.number === parseInt(reaction.emoji.name.substr(0, 1))) {
                                channel.send("<@" + player.id + ">, the " + player.role.name + ", was killed in revenge.");
                                let member = channel.guild.members.find((x) => x.id === player.id);
                                player.role.die(member, player);
                                member.removeRole(mafiaPlayer);
                                players.splice(i, 1);
                                deadPlayers.push(player);
                                clearTimeout(timeout);
                                collector.stop();
                                if (!testGameEnd()) {
                                    if (nightlessGame) {
                                        beginDay(channel, mafiaPlayer);
                                    }
                                    else {
                                        beginNight(channel, mafiaPlayer);
                                    }
                                }
                                break;
                            }
                        }
                    }
                });
                let timeout = setTimeout(() => {
                    channel.send("Your kill timed out. No one was killed.");
                    collector.stop();
                    if (nightlessGame) {
                        beginDay(channel, mafiaPlayer);
                    }
                    else {
                        beginNight(channel, mafiaPlayer);
                    }
                }, 120000);
                yield msg.react("❌");
                for (let player of players) {
                    yield msg.react(player.number + "\u20e3");
                }
                return;
            }
        }
        else {
            channel.send("Nobody was lynched.");
        }
        if (nightlessGame) {
            beginDay(channel, mafiaPlayer);
        }
        else {
            beginNight(channel, mafiaPlayer);
        }
    });
}
function endGame(channel, mafiaPlayer) {
    gameRunning = false;
    gameInfo.endTime = Date.now();
    for (let player of players) {
        let member = channel.guild.members.find((x) => x.id === player.id);
        player.role.endGame(member, player);
        member.removeRole(mafiaPlayer);
    }
    if (dayCollector) {
        dayCollector.stop();
        dayCollector = null;
    }
    if (dayTimeout) {
        clearTimeout(dayTimeout);
        dayTimeout = null;
    }
    if (nightTimeout) {
        clearTimeout(nightTimeout);
        nightTimeout = null;
    }
    let text = "";
    for (let player of deadPlayers) {
        players.push(player);
    }
    for (let player of players.sort((a, b) => a.number - b.number)) {
        text += player.number + "- " + player.name + " (" + (player.role.realName || player.role.name) + ")\n";
    }
    channel.send(text);
    players = [];
    deadPlayers = [];
    channel.overwritePermissions(channel.guild.roles.find((x) => x.name === "@everyone"), { SEND_MESSAGES: true, ADD_REACTIONS: true, ATTACH_FILES: true });
    channel.overwritePermissions(mafiaPlayer, { SEND_MESSAGES: true, ADD_REACTIONS: true, ATTACH_FILES: true });
    let secret = channel.guild.channels.find((x) => x.name === "mafia-secret-chat");
    for (let overwrites of secret.permissionOverwrites.values()) {
        if (overwrites.type === "member") {
            overwrites.delete();
        }
    }
    cantEndDay = false;
    cantBeginDay = false;
    vengefulGame = false;
    nightlessGame = false;
    daystartGame = false;
    daychatGame = false;
    if (!dontRecordGame) {
        collection.findOne({}, (err, doc) => {
            doc.games.push(gameInfo);
            collection.updateOne({}, { $set: { games: doc.games } });
        });
    }
    dontRecordGame = false;
    mafiaChannel = null;
}
function beginGame(channel, mafiaPlayer, setup) {
    if (signupCollector) {
        signupCollector.stop();
        signupCollector = null;
    }
    gameRunning = true;
    mafiaChannel = channel.id;
    let setupName = Object.entries(setups).find(([name, s]) => s === setup);
    if (setupName) {
        setupName = setupName[0];
    }
    ;
    gameInfo = {
        setup: setupName,
        players: [],
        startTime: Date.now()
    };
    nightlessGame = setup.nightless;
    vengefulGame = setup.vengeful;
    daystartGame = setup.daystart;
    daychatGame = setup.daychat;
    dontRecordGame = setup.dontRecord;
    let sroles = shuffleArray(setup.roles);
    players = [];
    deadPlayers = [];
    for (let member of mafiaPlayer.members.values()) {
        let role = sroles[players.length];
        if (role.constructor === Array) {
            let arr = role;
            role = arr[Math.round(Math.random() * (arr.length - 1))];
        }
        let player = {
            name: member.user.username,
            id: member.id,
            number: 0,
            role: role,
            data: null,
            gun: false,
            actionDone: false,
            oracleVisit: null,
            frame: 0,
            janitorCleaned: false,
            cleaned: false,
            lynchVote: null,
            saved: false,
            hooked: false
        };
        players.push(player);
    }
    players = shuffleArray(players);
    let n = 1;
    for (let player of players) {
        player.number = n++;
        player.role.beginGame(channel.guild.members.find((x) => x.id === player.id), player);
    }
    channel.overwritePermissions(channel.guild.roles.find((x) => x.name === "@everyone"), { SEND_MESSAGES: false, ADD_REACTIONS: false, ATTACH_FILES: false });
    day = 1;
    if (daystartGame || nightlessGame) {
        beginDay(channel, mafiaPlayer);
    }
    else {
        beginNight(channel, mafiaPlayer);
    }
}
const setups = {
    "confused cops": { roles: [roles.InsaneCop, roles.ParanoidCop, roles.NaiveCop, roles.Cop, roles.Vanilla] },
    "hookers into dreams": { roles: [roles.Blue, roles.Blue, roles.Doc, roles.Dreamer, roles.Hooker] },
    "hookers into dreams 6": { roles: [roles.Blue, roles.Blue, roles.Doc, roles.Dreamer, roles.Vanilla, roles.Hooker] },
    "solo hooker": { roles: [roles.Blue, roles.Blue, roles.Blue, roles.Cop, roles.Hooker] },
    "classic": { roles: [roles.Blue, roles.Blue, roles.Blue, roles.Doc, roles.Cop, roles.Vanilla, roles.Vanilla] },
    "guns and hookers": { roles: [roles.Blue, roles.Blue, roles.Blue, roles.Cop, roles.Gunsmith, roles.Vanilla, roles.Hooker] },
    "fancy pants": { roles: [roles.Blue, roles.Blue, roles.Blue, roles.Cop, [roles.Bomb, roles.Gunsmith, roles.Oracle, roles.Doc], roles.Vanilla, roles.Janitor] },
    "fancy hookers": { roles: [roles.Blue, roles.Blue, roles.Blue, roles.Cop, [roles.Bomb, roles.Gunsmith, roles.Oracle, roles.Doc], roles.Vanilla, roles.Hooker] },
    "sinister sundown": { roles: [roles.Blue, roles.Blue, roles.Deputy, roles.Deputy, roles.Oracle, roles.Vanilla, roles.Illusionist] },
    "cold stone": { roles: [roles.Blue, roles.Blue, roles.Blue, roles.Cop, roles.TalentScout, roles.Vanilla, roles.Godfather] },
    "team cops": { roles: [roles.Blue, roles.Blue, roles.Blue, roles.Doc, roles.Cop, roles.Cop, roles.Vanilla, roles.Vanilla, roles.Hooker] },
    "revengeful": {
        roles: [roles.VengefulBlue, roles.VengefulBlue, roles.VengefulBlue, roles.VengefulBlue, roles.VengefulBlue, roles.VengefulBlue, roles.VengefulBlue, roles.VengefulVanilla, roles.VengefulVanilla, roles.VengefulVanilla, roles.VengefulVanilla],
        daystart: true,
        nightless: true,
        vengeful: true,
        daychat: true
    },
    "revengeful 7": {
        roles: [roles.VengefulBlue, roles.VengefulBlue, roles.VengefulBlue, roles.VengefulBlue, roles.VengefulBlue, roles.VengefulVanilla, roles.VengefulVanilla],
        daystart: true,
        nightless: true,
        vengeful: true,
        daychat: true
    },
    "revengeful 5": {
        roles: [roles.VengefulBlue, roles.VengefulBlue, roles.VengefulBlue, roles.VengefulVanilla, roles.VengefulVanilla],
        daystart: true,
        nightless: true,
        vengeful: true,
        daychat: true
    },
    "hope plus one": {
        roles: [roles.Blue, roles.Blue, roles.Blue, roles.Blue, roles.Blue, roles.Blue, roles.Blue, roles.MachoDoc, roles.MachoDoc, roles.Cop, roles.Cop, roles.Vanilla, roles.Vanilla, roles.Vanilla],
        daystart: true
    }
};
mclient.connect((error) => {
    if (error) {
        client.destroy();
        mclient.close();
        console.error("Failed to connect to Mongo server");
        console.error(error.message);
    }
    else {
        console.log("Connected to Mongo server");
        let db = mclient.db("keebot");
        collection = db.collection("mafia");
    }
});
client.on("ready", () => {
    console.log("Connected as " + client.user.tag);
});
client.on("error", (error) => {
    console.error(error.message);
});
client.on("message", (message) => {
    if (message.channel.type === "dm" && message.author && dayCollector && !message.author.bot) {
        if (mafiaChannel) {
            let channel = client.channels.find((c) => c.id === mafiaChannel);
            let mafiaPlayer = channel.guild.roles.find((role) => role.name === "Mafia Player");
            let match = message.content.match(/^;shoot ([0-9]+)$/);
            if (match) {
                let player;
                for (let [i, p] of players.entries()) {
                    if (p.id === message.author.id) {
                        player = p;
                        break;
                    }
                }
                if (player) {
                    if (player.gun) {
                        let number = parseInt(match[1]);
                        for (let [i, player2] of players.entries()) {
                            if (player2.number === number) {
                                player.gun = false;
                                let shooter = player.id;
                                if (player.frame !== 0) {
                                    for (let p of players) {
                                        if (p.number === player.frame) {
                                            shooter = p.id;
                                            break;
                                        }
                                    }
                                    for (let p of deadPlayers) {
                                        if (p.number === player.frame) {
                                            shooter = p.id;
                                            break;
                                        }
                                    }
                                }
                                if (player.role.name === "Illusionist" || (player.role.name !== "Deputy" && Math.random() < 0.5)) {
                                    channel.send("<@" + player2.id + ">, the " + player2.role.name + ", was shot by <@" + shooter + ">.");
                                }
                                else {
                                    channel.send("<@" + player2.id + ">, the " + player2.role.name + ", was shot.");
                                }
                                let member = channel.guild.members.find((x) => x.id === player2.id);
                                player2.role.die(member, player2);
                                member.removeRole(mafiaPlayer);
                                players.splice(i, 1);
                                deadPlayers.push(player2);
                                if (player2.role.name === "Bomb") {
                                    for (let [i, p] of players.entries()) {
                                        if (p.id === player.id && (!player.saved || player.role.macho)) {
                                            channel.send("<@" + player.id + ">, the " + player.role.name + ", exploded.");
                                            let member = channel.guild.members.find((x) => x.id === player.id);
                                            player.role.die(member, player);
                                            member.removeRole(mafiaPlayer);
                                            players.splice(i, 1);
                                            deadPlayers.push(player);
                                            break;
                                        }
                                    }
                                }
                                let [village, mafia, third] = countSides();
                                if (mafia > 0 && (vengefulGame ? village === 0 : mafia >= village)) {
                                    let text = "";
                                    for (let player of players) {
                                        let won = player.role.side === Side.MAFIA;
                                        if (won) {
                                            text += " <@" + player.id + ">";
                                        }
                                        gameInfo.players.push({
                                            id: player.id,
                                            name: player.name,
                                            role: player.role.realName || player.role.name,
                                            side: Side[player.role.side].toLowerCase(),
                                            won,
                                            alive: true
                                        });
                                    }
                                    for (let player of deadPlayers) {
                                        let won = player.role.side === Side.MAFIA;
                                        if (won) {
                                            text += " <@" + player.id + ">";
                                        }
                                        gameInfo.players.push({
                                            id: player.id,
                                            name: player.name,
                                            role: player.role.realName || player.role.name,
                                            side: Side[player.role.side].toLowerCase(),
                                            won,
                                            alive: false
                                        });
                                    }
                                    gameInfo.winningSide = "mafia";
                                    channel.send("<@&" + mafiaPlayer.id + "> The Mafia won!" + text);
                                    endGame(channel, mafiaPlayer);
                                    return;
                                }
                                else if (vengefulGame ? mafia === 0 && village > 0 : mafia === 0) {
                                    let text = "";
                                    for (let player of players) {
                                        let won = player.role.side === Side.VILLAGE;
                                        if (won) {
                                            text += " <@" + player.id + ">";
                                        }
                                        gameInfo.players.push({
                                            id: player.id,
                                            name: player.name,
                                            role: player.role.realName || player.role.name,
                                            side: Side[player.role.side].toLowerCase(),
                                            won,
                                            alive: true
                                        });
                                    }
                                    for (let player of deadPlayers) {
                                        let won = player.role.side === Side.VILLAGE;
                                        if (won) {
                                            text += " <@" + player.id + ">";
                                        }
                                        gameInfo.players.push({
                                            id: player.id,
                                            name: player.name,
                                            role: player.role.realName || player.role.name,
                                            side: Side[player.role.side].toLowerCase(),
                                            won,
                                            alive: false
                                        });
                                    }
                                    gameInfo.winningSide = "village";
                                    channel.send("<@&" + mafiaPlayer.id + "> The Village won!" + text);
                                    endGame(channel, mafiaPlayer);
                                    return;
                                }
                                else if (mafia === 0 && village === 0) {
                                    gameInfo.winningSide = "tie";
                                    channel.send("<@&" + mafiaPlayer.id + "> It was a tie!");
                                    endGame(channel, mafiaPlayer);
                                    return;
                                }
                            }
                        }
                    }
                    else {
                        message.author.send("You don't have a gun.");
                    }
                }
            }
        }
    }
    else if (message.guild && message.member) {
        if (message.author.id === "197436970052354049" && message.content.startsWith(";echo ")) {
            message.channel.send(message.content.substr(6));
            return;
        }
        let mafiaPlayer = message.guild.roles.find((x) => x.name === "Mafia Player");
        let channel = message.channel;
        if (mafiaPlayer && message.member.roles.find((x) => x.name === "Mafia Manager") && !message.author.bot) {
            if (!channel.permissionOverwrites.find((overwrites) => overwrites.type === "role" && overwrites.id === mafiaPlayer.id)) {
                if (mafiaChannel) {
                    channel = client.channels.find((c) => c.id === mafiaChannel);
                }
                else {
                    return;
                }
            }
            if (message.content === ";startsignup") {
                if (!signupCollector) {
                    channel.send("Signup for a new round of Mafia has started! If you want to join, type `;signup`.");
                    signupCollector = channel.createMessageCollector((message) => message.content.match(/^;sign(up|out)$/));
                    signupCollector.on("collect", (message) => {
                        if (message.content === ";signup") {
                            message.member.addRole(mafiaPlayer);
                            message.react("497430068331544577");
                        }
                        else if (message.content === ";signout") {
                            message.member.removeRole(mafiaPlayer);
                            message.react("497430068331544577");
                        }
                        else if (message.content === ";players") {
                            let count = message.guild.members.filter((m) => m.roles.find((r) => r.id === mafiaPlayer.id) !== null).map((v) => v).length;
                            if (count < 10) {
                                message.react(count + "\u20e3");
                            }
                            else if (count === 10) {
                                message.react("🔟");
                            }
                            else if (count < 21) {
                                let one = false;
                                count.toString().split("").forEach((v) => __awaiter(void 0, void 0, void 0, function* () {
                                    if (v === "1") {
                                        if (one) {
                                            yield message.react("538537337609781258");
                                        }
                                        else {
                                            yield message.react("1\u20e3");
                                            one = true;
                                        }
                                    }
                                    else {
                                        yield message.react(v + "\u20e3");
                                    }
                                }));
                            }
                            else {
                                message.reply(count);
                            }
                        }
                    });
                }
            }
            else if (message.content === ";stopsignup") {
                if (signupCollector) {
                    signupCollector.stop();
                    signupCollector = null;
                }
                for (let member of mafiaPlayer.members.values()) {
                    member.removeRole(mafiaPlayer);
                }
                message.react("497430068331544577");
            }
            else if (message.content === ";listroles") {
                let text;
                for (let [i] of Object.entries(roles)) {
                    if (text) {
                        text += ", " + i;
                    }
                    else {
                        text = i;
                    }
                }
                message.reply("Roles: " + text);
            }
            else if (message.content === ";listsetups") {
                let text;
                for (let [i, v] of Object.entries(setups)) {
                    if (text) {
                        text += ", " + i + " (" + v.roles.length + ")";
                    }
                    else {
                        text = i + " (" + v.roles.length + ")";
                    }
                }
                message.reply("Setups: " + text);
            }
            else if (message.content.startsWith(";setupinfo ")) {
                let name = message.content.substr(11).toLowerCase();
                if (name in setups) {
                    let setup = setups[name];
                    let text = "";
                    for (let role of setup.roles) {
                        if (role instanceof Array) {
                            text += " [" + role.map((r) => Object.entries(roles).find((v) => v[1] === r)[0]).join("/") + "]";
                        }
                        else {
                            let name = Object.entries(roles).find((v) => v[1] === role)[0];
                            text += " [" + name + "]";
                        }
                    }
                    if (setup.daystart)
                        text += " -daystart";
                    if (setup.nightless)
                        text += " -nightless";
                    if (setup.daychat)
                        text += " -daychat";
                    if (setup.vengeful)
                        text += " -vengeful";
                    if (setup.dontRecord)
                        text += " -dontRecord";
                    message.reply(name + " (" + setup.roles.length + "): " + text);
                }
                else {
                    message.reply("That setup doesn't exist");
                }
            }
            else if (message.content.match(/^;\s*setupcustom\s+.*$/)) {
                let desc = message.content.match(/^;\s*setupcustom\s+(.*)$/)[1];
                let match = desc.match(/\[.*?\](?:x[0-9]+)?(?=\s*)/g);
                let setup = new Setup();
                setup.roles = [];
                setup.dontRecord = true;
                let error = [];
                for (let m of match) {
                    let count = 1;
                    let idx = m.indexOf("]");
                    if (m.length > idx + 1) {
                        count = parseInt(m.substr(idx + 2));
                    }
                    let role = m.substr(1, idx - 1);
                    let alts = (role.includes("/") ? role.split("/") : [role])
                        .map((v) => {
                        if (v in roles) {
                            return roles[v];
                        }
                        else {
                            error.push(v);
                        }
                    });
                    for (let i = 0; i < count; i++) {
                        setup.roles.push(alts);
                    }
                }
                let oerror = [];
                match = desc.match(/-[a-zA-Z]+/g);
                if (match) {
                    for (let opt of match) {
                        switch (opt) {
                            case "-nightless":
                                setup.nightless = true;
                                break;
                            case "-daystart":
                                setup.daystart = true;
                                break;
                            case "-daychat":
                                setup.daychat = true;
                                break;
                            case "-vengeful":
                                setup.vengeful = true;
                                break;
                            default:
                                oerror.push(opt);
                                break;
                        }
                    }
                }
                if (error.length != 0 || oerror.length != 0) {
                    let text = "";
                    if (error.length != 0) {
                        text += "Roles not found: " + error + "\n";
                    }
                    if (oerror.length != 0) {
                        text += "Options not found: " + oerror + "\n";
                    }
                    message.reply(text);
                    return;
                }
                if (signupCollector) {
                    signupCollector.stop();
                    signupCollector = null;
                }
                let count = mafiaPlayer.members.map((v) => v).length;
                if (count === setup.roles.length) {
                    message.react("497430068331544577");
                    beginGame(channel, mafiaPlayer, setup);
                }
                else if (count < setup.roles.length) {
                    message.reply("Not enough players. You need " + setup.roles.length + ", but there are " + count + ".");
                }
                else {
                    message.reply("Too many players. You need " + setup.roles.length + ", but there are " + count + ".");
                }
            }
            else if (message.content.startsWith(";setup ")) {
                if (signupCollector) {
                    signupCollector.stop();
                    signupCollector = null;
                }
                let count = mafiaPlayer.members.map((v) => v).length;
                let setup = setups[message.content.substr(7).toLowerCase()];
                if (setup) {
                    if (count === setup.roles.length) {
                        message.react("497430068331544577");
                        beginGame(channel, mafiaPlayer, setup);
                    }
                    else if (count < setup.roles.length) {
                        message.reply("Not enough players. You need " + setup.roles.length + ", but there are " + count + ".");
                    }
                    else {
                        message.reply("Too many players. You need " + setup.roles.length + ", but there are " + count + ".");
                    }
                }
                else {
                    message.reply("That setup doesn't exist.");
                }
            }
            else if (message.content === ";cleanup") {
                gameRunning = false;
                if (dayCollector) {
                    dayCollector.stop();
                    dayCollector = null;
                    clearTimeout(dayTimeout);
                    endDay(channel, mafiaPlayer);
                }
                if (nightTimeout) {
                    clearTimeout(nightTimeout);
                    nightTimeout = null;
                    for (let player of players) {
                        player.role.endNight(channel.guild.members.find((x) => x.id === player.id), player);
                    }
                    if (mafiaKill === 0) {
                        mafiaKill = -2;
                    }
                    updateNight();
                }
                channel.overwritePermissions(mafiaPlayer, { SEND_MESSAGES: true, ADD_REACTIONS: true, ATTACH_FILES: true });
                for (let member of mafiaPlayer.members.values()) {
                    member.removeRole(mafiaPlayer);
                }
                let secret = channel.guild.channels.find((x) => x.name === "mafia-secret-chat");
                for (let overwrites of secret.permissionOverwrites.values()) {
                    if (overwrites.type === "member") {
                        overwrites.delete();
                    }
                }
                channel.overwritePermissions(channel.guild.roles.find((x) => x.name === "@everyone"), { SEND_MESSAGES: true, ADD_REACTIONS: true, ATTACH_FILES: true });
                cantEndDay = false;
                cantBeginDay = false;
                vengefulGame = false;
                nightlessGame = false;
                daystartGame = false;
                daychatGame = false;
                dontRecordGame = false;
                mafiaChannel = null;
            }
            else if (message.content === ";partialcleanup") {
                gameRunning = false;
                if (dayCollector) {
                    dayCollector.stop();
                    dayCollector = null;
                    clearTimeout(dayTimeout);
                    endDay(channel, mafiaPlayer);
                }
                if (nightTimeout) {
                    clearTimeout(nightTimeout);
                    nightTimeout = null;
                    for (let player of players) {
                        player.role.endNight(channel.guild.members.find((x) => x.id === player.id), player);
                    }
                    if (mafiaKill === 0) {
                        mafiaKill = -2;
                    }
                    updateNight();
                }
                channel.overwritePermissions(mafiaPlayer, { SEND_MESSAGES: true, ADD_REACTIONS: true, ATTACH_FILES: true });
                let secret = channel.guild.channels.find((x) => x.name === "mafia-secret-chat");
                for (let overwrites of secret.permissionOverwrites.values()) {
                    if (overwrites.type === "member") {
                        overwrites.delete();
                    }
                }
                channel.overwritePermissions(channel.guild.roles.find((x) => x.name === "@everyone"), { SEND_MESSAGES: true, ADD_REACTIONS: true, ATTACH_FILES: true });
                cantEndDay = false;
                cantBeginDay = false;
                vengefulGame = false;
                nightlessGame = false;
                daystartGame = false;
                daychatGame = false;
                dontRecordGame = false;
                mafiaChannel = null;
            }
            else {
                let match = message.content.match(/^;stat((?:-[A-Za-z])*)(?:-([0-9]+))? ([A-Za-z_0-9\-]+)$/);
                if (match) {
                    let oinverse = false;
                    let orate = false;
                    for (let opt of match[1].split("-")) {
                        switch (opt) {
                            case "i":
                                oinverse = true;
                                break;
                            case "r":
                                orate = true;
                                break;
                            case "":
                                break;
                            default:
                                message.reply("Option -" + opt + " doesn't exist.");
                                return;
                        }
                    }
                    let entries = [];
                    let mode = 0;
                    let value = null;
                    function set(x) {
                        mode = 1;
                        value = x;
                    }
                    function freq(value, display) {
                        mode = 2;
                        let entry = entries.find((y) => y[0] === value);
                        if (entry) {
                            entry[2]++;
                        }
                        else {
                            entries.push([value, display || value, 1]);
                        }
                    }
                    function rate(b, value, display) {
                        mode = 3;
                        let entry = entries.find((y) => y[0] === value);
                        if (entry) {
                            if (b) {
                                entry[2]++;
                            }
                            else {
                                entry[3]++;
                            }
                        }
                        else {
                            entries.push([value, display || value, b ? 1 : 0, b ? 0 : 1]);
                        }
                    }
                    collection.findOne({}, (err, doc) => {
                        let stat = doc.statfns[match[3].toLowerCase()];
                        if (!stat) {
                            message.reply("That statistic function doesn't exist.");
                            return;
                        }
                        if (stat.scope === "o") {
                            try {
                                new Function(stat.code).call({
                                    games: doc.games,
                                    set,
                                    rate,
                                    freq
                                });
                            }
                            catch (e) {
                                message.reply("Error:\n" + e);
                                return;
                            }
                        }
                        else if (stat.scope === "g") {
                            for (let game of doc.games) {
                                try {
                                    new Function(stat.code).call({
                                        game,
                                        set,
                                        rate,
                                        freq
                                    });
                                }
                                catch (e) {
                                    message.reply("Error:\n" + e);
                                    return;
                                }
                            }
                        }
                        else if (stat.scope === "p") {
                            for (let game of doc.games) {
                                for (let player of game.players) {
                                    try {
                                        new Function(stat.code).call({
                                            game,
                                            player,
                                            set,
                                            rate,
                                            freq
                                        });
                                    }
                                    catch (e) {
                                        message.reply("Error:\n" + e);
                                        return;
                                    }
                                }
                            }
                        }
                        if (mode === 1) {
                            message.reply(match[3] + ":\n" + (value || "<null value!>"));
                        }
                        else if (mode === 2) {
                            entries = entries.sort((a, b) => b[2] - a[2]);
                            let res = [];
                            let counts = [];
                            let lastCount = -1;
                            let total = 0;
                            for (let [x, v, count] of entries) {
                                total += count;
                                if (count === lastCount) {
                                    res[res.length - 1].push(v);
                                }
                                else {
                                    lastCount = count;
                                    res.push([v]);
                                    counts.push(count);
                                }
                                if (lastCount === -1) {
                                    lastCount = count;
                                }
                            }
                            if (oinverse) {
                                let text = match[3] + " (inverse):";
                                for (let i = 1; i <= (match[2] ? parseInt(match[2]) : 5); i++) {
                                    if (res[res.length - i]) {
                                        if (orate) {
                                            text += "\n" + i + "- " + res[res.length - i].join(", ") + " (" + Math.round(counts[res.length - i] * 100 / total) + "%)";
                                        }
                                        else {
                                            text += "\n" + i + "- " + res[res.length - i].join(", ") + " (" + counts[res.length - i] + ")";
                                        }
                                    }
                                }
                                message.reply(text);
                            }
                            else {
                                let text = match[3] + ":";
                                for (let i = 1; i <= (match[2] ? parseInt(match[2]) : 5); i++) {
                                    if (res[i - 1]) {
                                        if (orate) {
                                            text += "\n" + i + "- " + res[i - 1].join(", ") + " (" + Math.round(counts[i - 1] * 100 / total) + "%)";
                                        }
                                        else {
                                            text += "\n" + i + "- " + res[i - 1].join(", ") + " (" + counts[i - 1] + ")";
                                        }
                                    }
                                }
                                message.reply(text);
                            }
                        }
                        else if (mode === 3) {
                            entries = entries.map((v) => [v[0], v[1], v[2] * 100 / (v[2] + v[3])]).sort((a, b) => b[2] - a[2]);
                            let res = [];
                            let counts = [];
                            let lastCount = -1;
                            for (let [x, v, count] of entries) {
                                if (count === lastCount) {
                                    res[res.length - 1].push(v);
                                }
                                else {
                                    lastCount = count;
                                    res.push([v]);
                                    counts.push(count);
                                }
                                if (lastCount === -1) {
                                    lastCount = count;
                                }
                            }
                            if (oinverse) {
                                let text = match[3] + " (inverse):";
                                for (let i = 1; i <= (match[2] ? parseInt(match[2]) : 5); i++) {
                                    if (res[res.length - i]) {
                                        text += "\n" + i + "- " + res[res.length - i].join(", ") + " (" + Math.round(counts[res.length - i]) + "%)";
                                    }
                                }
                                message.reply(text);
                            }
                            else {
                                let text = match[3] + ":";
                                for (let i = 1; i <= (match[2] ? parseInt(match[2]) : 5); i++) {
                                    if (res[i - 1]) {
                                        text += "\n" + i + "- " + res[i - 1].join(", ") + " (" + Math.round(counts[i - 1]) + "%)";
                                    }
                                }
                                message.reply(text);
                            }
                        }
                    });
                }
                else {
                    match = message.content.match(/^;addstat((?:-[a-zA-Z])*) ([A-Za-z_0-9]+) ([\s\S]+)$/);
                    if (match) {
                        let statfn = { scope: "g" };
                        for (let opt of match[1].split("-")) {
                            switch (opt) {
                                case "o":
                                case "g":
                                case "p":
                                    statfn.scope = opt;
                                case "":
                                    break;
                                default:
                                    message.reply("Option -" + opt + " doesn't exist.");
                                    return;
                            }
                        }
                        collection.findOne({}, (err, doc) => {
                            try {
                                new Function(match[3]);
                                statfn.code = match[3];
                                doc.statfns[match[2].toLowerCase()] = statfn;
                                collection.updateOne({}, { $set: { statfns: doc.statfns } });
                                message.react("497430068331544577");
                            }
                            catch (e) {
                                message.reply("Error:\n" + e.message);
                            }
                        });
                    }
                    else {
                        match = message.content.match(/^;removestat ([A-Za-z_0-9\-]+)$/);
                        if (match) {
                            collection.findOne({}, (err, doc) => {
                                delete doc.statfns[match[1].toLowerCase()];
                                collection.updateOne({}, { $set: { statfns: doc.statfns } });
                                message.react("497430068331544577");
                            });
                        }
                    }
                }
            }
        }
    }
});
client.login("NTAyOTc0NzIwNTQzNjg2NjU2.DqvvVA.KobwnmoBdeqwPbp8dEgx79bQ_uc");
//# sourceMappingURL=old.js.map