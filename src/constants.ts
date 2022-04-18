import { Player, Role, Setup } from "./classes";
import { Side } from "./enum";
import * as Discord from 'discord.js';
import { getSide, isSide } from "./Helpers";
import { updateNight } from "./bot_v13";

export const mafiaSecretChannel: string = "509048097993654312"; // Hard coded Trinity Fiction mafia secret chat channel.

export const kaismile = "497430068331544577";

export const death_messages = [
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

export const roles: { [name: string]: Role } = {
    Blue: {
        name: "Blue",
        side: Side.VILLAGE,
        beginGame: (member: Discord.GuildMember, player: Player, other) => {
            member.send("You are a Blue, number " + player.number + ".");
        },
        endGame: (member: Discord.GuildMember, player: Player, other) => { },
        beginNight: (member: Discord.GuildMember, player: Player, other) => {
            player.actionDone = true;
        },
        endNight: (member: Discord.GuildMember, player: Player, other) => { },
        die: (member: Discord.GuildMember, player: Player, other) => { }
    },

    VengefulBlue: {
        name: "Vengeful Blue",
        side: Side.VILLAGE,
        vengeful: true,
        beginGame: (member: Discord.GuildMember, player: Player, other) => {
            member.send("You are a Vengeful Blue, number " + player.number + ".");
        },
        endGame: (member: Discord.GuildMember, player: Player, other) => { },
        beginNight: (member: Discord.GuildMember, player: Player, other) => {
            player.actionDone = true;
        },
        endNight: (member: Discord.GuildMember, player: Player, other) => { },
        die: (member: Discord.GuildMember, player: Player, other) => { }
    },

    Bomb: {
        name: "Bomb",
        side: Side.VILLAGE,
        beginGame: (member: Discord.GuildMember, player: Player, other) => {
            member.send("You are a Bomb, number " + player.number + ". If you are killed by the mafia or shot, the killer will die as well.");
        },
        endGame: (member: Discord.GuildMember, player: Player, other) => { },
        beginNight: (member: Discord.GuildMember, player: Player, other) => {
            player.actionDone = true;
        },
        endNight: (member: Discord.GuildMember, player: Player, other) => { },
        die: (member: Discord.GuildMember, player: Player, other) => { }
    },

    Oracle: {
        name: "Oracle",
        side: Side.VILLAGE,
        beginGame: (member: Discord.GuildMember, player: Player, other) => {
            member.send("You are an Oracle, number " + player.number + ". Select a player each night. If you die, the role of the last player visited will be revealed to everyone. Your action can't be blocked.");
        },
        endGame: (member: Discord.GuildMember, player: Player, other) => { },
        beginNight: (member: Discord.GuildMember, player: Player, other) => {
            let text = "";
            if (other.day === 1) {
                text = " 1-" + other.players.length;
            } else {
                for (let player of other.players) {
                    if (player.id !== member.id) {
                        text += "\n" + player.number + "- " + player.name;
                    }
                }
            }
            member.send("Night " + other.day + " has begun. React with the number of who you wish to visit." + text).then(async (message: Discord.Message) => {
                await message.react("❌");
                for (let player of other.players) {
                    if (player.id !== member.id) {
                        await message.react(player.number + "\u20e3");
                    }
                }
                let collector = message.createReactionCollector({
                    time: 15000,
                    filter: (_reaction, user: Discord.User) => user.id === member.id
                });
                player.data = [message, collector];
                collector.on("collect", (reaction) => {
                    if (reaction.emoji.name === "❌") {
                        player.data = null;
                        player.actionDone = true;
                        player.oracleVisit = null;
                        message.edit(message.content + "\nYou visited no one.");
                        collector.stop();
                        updateNight();
                    } else {
                        for (let target of other.players) {
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
            });
        },
        endNight: (member: Discord.GuildMember, player: Player, other) => {
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
        die: (member: Discord.GuildMember, player: Player, other) => {
            other.client.channels.fetch(other.mafiaChannel).then((channel: Discord.TextChannel) => {
                if (player.oracleVisit) {
                    for (let p of other.players) {
                        if (p.id === player.oracleVisit) {
                            channel.send("<@" + p.id + "> is a " + p.role.name + ".");
                            return;
                        }
                    }
                    for (let p of other.deadPlayers) {
                        if (p.id === player.oracleVisit) {
                            channel.send("<@" + p.id + "> is a " + p.role.name + ".");
                            return;
                        }
                    }
                } else {
                    channel.send("The Oracle didn't visit anyone.");
                }
            });
        }
    },

    Doc: {
        name: "Doc",
        side: Side.VILLAGE,
        beginGame: (member: Discord.GuildMember, player: Player, other) => {
            member.send("You are a Doc, number " + player.number + ".");
        },
        endGame: (member: Discord.GuildMember, player: Player, other) => { },
        beginNight: (member: Discord.GuildMember, player: Player, other) => {
            let text = "";
            if (other.day === 1) {
                text = " 1-" + other.players.length;
            } else {
                for (let player of other.players) {
                    if (player.id !== member.id) {
                        text += "\n" + player.number + "- " + player.name;
                    }
                }
            }
            member.send("Night " + other.day + " has begun. React with the number of who you wish to save." + text).then(async (message: Discord.Message) => {
                await message.react("❌");
                for (let player of other.players) {
                    if (player.id !== member.id) {
                        await message.react(player.number + "\u20e3");
                    }
                }
                let collector = message.createReactionCollector({ filter: (_reaction, user: Discord.User) => user.id === member.id });
                player.data = [message, collector];
                collector.on("collect", (reaction) => {
                    if (reaction.emoji.name === "❌") {
                        player.data = null;
                        player.actionDone = true;
                        message.edit(message.content + "\nYou saved no one.");
                        collector.stop();
                        updateNight();
                    } else {
                        for (let target of other.players) {
                            if (target.id !== member.id && reaction.emoji.name === target.number + "\u20e3") {
                                player.data = null;
                                player.actionDone = true;
                                message.edit(message.content + "\nYou chose to save " + target.name + ".");
                                if (other.hookDecided) {
                                    other.hookDecided.push(() => {
                                        if (!player.hooked) {
                                            target.saved = true;
                                        }
                                    });
                                } else {
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
            });
        },
        endNight: (member: Discord.GuildMember, player: Player, other) => {
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
        die: (member: Discord.GuildMember, player: Player, other) => { }
    },

    MachoDoc: {
        name: "Macho Doc",
        side: Side.VILLAGE,
        macho: true,
        beginGame: (member: Discord.GuildMember, player: Player, other) => {
            member.send("You are a Macho Doc, number " + player.number + ".");
        },
        endGame: (member: Discord.GuildMember, player: Player, other) => { },
        beginNight: (member: Discord.GuildMember, player: Player, other) => {
            let text = "";
            if (other.day === 1) {
                text = " 1-" + other.players.length;
            } else {
                for (let player of other.players) {
                    if (player.id !== member.id) {
                        text += "\n" + player.number + "- " + player.name;
                    }
                }
            }
            member.send("Night " + other.day + " has begun. React with the number of who you wish to save." + text).then(async (message: Discord.Message) => {
                await message.react("❌");
                for (let player of other.players) {
                    if (player.id !== member.id) {
                        await message.react(player.number + "\u20e3");
                    }
                }
                let collector = message.createReactionCollector({ filter: (_reaction, user: Discord.User) => user.id === member.id });
                player.data = [message, collector];
                collector.on("collect", (reaction) => {
                    if (reaction.emoji.name === "❌") {
                        player.data = null;
                        player.actionDone = true;
                        message.edit(message.content + "\nYou saved no one.");
                        collector.stop();
                        updateNight();
                    } else {
                        for (let target of other.players) {
                            if (target.id !== member.id && reaction.emoji.name === target.number + "\u20e3") {
                                player.data = null;
                                player.actionDone = true;
                                message.edit(message.content + "\nYou chose to save " + target.name + ".");
                                if (other.hookDecided) {
                                    other.hookDecided.push(() => {
                                        if (!player.hooked) {
                                            if (target.saved) {
                                                target.saved = false;
                                            } else {
                                                target.saved = true;
                                            }
                                        }
                                    });
                                } else {
                                    if (!player.hooked) {
                                        if (target.saved) {
                                            target.saved = false;
                                        } else {
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
            });
        },
        endNight: (member: Discord.GuildMember, player: Player, other) => {
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
        die: (member: Discord.GuildMember, player: Player, other) => {
            for (let p of other.players) {
                if (p.role.name === "Cop") {
                    p.role = roles.MachoCop;
                    member.guild.members.fetch(p.id).then((member) => member.send("You became a Macho Cop. You can't be saved by a doc anymore."));
                    break;
                }
            }
        }
    },

    Cop: {
        name: "Cop",
        side: Side.VILLAGE,
        beginGame: (member: Discord.GuildMember, player: Player, other) => {
            member.send("You are a Cop, number " + player.number + ".");
        },
        endGame: (member: Discord.GuildMember, player: Player, other) => { },
        beginNight: (member: Discord.GuildMember, player: Player, other) => {
            let text = "";
            if (other.day === 1) {
                text = " 1-" + other.players.length;
            } else {
                for (let player of other.players) {
                    if (player.id !== member.id) {
                        text += "\n" + player.number + "- " + player.name;
                    }
                }
            }
            member.send("Night " + other.day + " has begun. React with the number of who you wish to investigate." + text).then(async (message: Discord.Message) => {
                let collector = message.createReactionCollector({ filter: (_reaction, user: Discord.User) => user.id === member.id });
                collector.on("collect", (reaction) => {
                    if (reaction.emoji.name === "❌") {
                        player.data = null;
                        player.actionDone = true;
                        message.edit(message.content + "\nYou investigated no one.");
                        collector.stop();
                        updateNight();
                    } else {
                        for (let target of other.players) {
                            if (target.id !== member.id && reaction.emoji.name === target.number + "\u20e3") {
                                player.data = null;
                                player.actionDone = true;
                                if (other.hookDecided) {
                                    other.hookDecided.push(() => {
                                        if (player.hooked) {
                                            member.send("You were hooked.");
                                        } else {
                                            member.send(target.name + " is sided with the " + Side[getSide(target)].toLowerCase() + ".");
                                        }
                                    });
                                } else {
                                    if (player.hooked) {
                                        member.send("You were hooked.");
                                    } else {
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
                await message.react("❌");
                for (let player of other.players) {
                    if (player.id !== member.id) {
                        await message.react(player.number + "\u20e3");
                    }
                }
                player.data = [message, collector];
            });
        },
        endNight: (member: Discord.GuildMember, player: Player, other) => {
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
        die: (member: Discord.GuildMember, player: Player, other) => { }
    },

    TalentScout: {
        name: "Talent Scout",
        side: Side.VILLAGE,
        beginGame: (member: Discord.GuildMember, player: Player, other) => {
            member.send("You are a Talent Scout, number " + player.number + ". Each night, you can check whether someone has a talent. The only roles without talents are Blue and Vanilla.");
        },
        endGame: (member: Discord.GuildMember, player: Player, other) => { },
        beginNight: (member: Discord.GuildMember, player: Player, other) => {
            let text = "";
            if (other.day === 1) {
                text = " 1-" + other.players.length;
            } else {
                for (let player of other.players) {
                    if (player.id !== member.id) {
                        text += "\n" + player.number + "- " + player.name;
                    }
                }
            }
            member.send("Night " + other.day + " has begun. React with the number of who you wish to scout." + text).then(async (message: Discord.Message) => {
                let collector = message.createReactionCollector({ filter: (_reaction, user: Discord.User) => user.id === member.id });
                collector.on("collect", (reaction) => {
                    if (reaction.emoji.name === "❌") {
                        player.data = null;
                        player.actionDone = true;
                        message.edit(message.content + "\nYou scouted no one.");
                        collector.stop();
                        updateNight();
                    } else {
                        for (let target of other.players) {
                            if (target.id !== member.id && reaction.emoji.name === target.number + "\u20e3") {
                                player.data = null;
                                player.actionDone = true;
                                if (other.hookDecided) {
                                    other.hookDecided.push(() => {
                                        if (player.hooked) {
                                            member.send("You were hooked.");
                                        } else {
                                            member.send(target.name + ((target.role.name === "Blue" || target.role.name === "Vanilla") ? " doesn't have a talent." : " has a talent."));
                                        }
                                    });
                                } else {
                                    if (player.hooked) {
                                        member.send("You were hooked.");
                                    } else {
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
                await message.react("❌");
                for (let player of other.players) {
                    if (player.id !== member.id) {
                        await message.react(player.number + "\u20e3");
                    }
                }
                player.data = [message, collector];
            });
        },
        endNight: (member: Discord.GuildMember, player: Player, other) => {
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
        die: (member: Discord.GuildMember, player: Player, other) => { }
    },

    MachoCop: {
        name: "Macho Cop",
        side: Side.VILLAGE,
        macho: true,
        beginGame: (member: Discord.GuildMember, player: Player, other) => {
            member.send("You are a Macho Cop, number " + player.number + ".");
        },
        endGame: (member: Discord.GuildMember, player: Player, other) => { },
        beginNight: (member: Discord.GuildMember, player: Player, other) => {
            let text = "";
            if (other.day === 1) {
                text = " 1-" + other.players.length;
            } else {
                for (let player of other.players) {
                    if (player.id !== member.id) {
                        text += "\n" + player.number + "- " + player.name;
                    }
                }
            }
            member.send("Night " + other.day + " has begun. React with the number of who you wish to investigate." + text).then(async (message: Discord.Message) => {
                let collector = message.createReactionCollector({ filter: (_reaction, user: Discord.User) => user.id === member.id });
                collector.on("collect", (reaction) => {
                    if (reaction.emoji.name === "❌") {
                        player.data = null;
                        player.actionDone = true;
                        message.edit(message.content + "\nYou investigated no one.");
                        collector.stop();
                        updateNight();
                    } else {
                        for (let target of other.players) {
                            if (target.id !== member.id && reaction.emoji.name === target.number + "\u20e3") {
                                player.data = null;
                                player.actionDone = true;
                                if (other.hookDecided) {
                                    other.hookDecided.push(() => {
                                        if (player.hooked) {
                                            member.send("You were hooked.");
                                        } else {
                                            member.send(target.name + " is sided with the " + Side[getSide(target)].toLowerCase() + ".");
                                        }
                                    });
                                } else {
                                    if (player.hooked) {
                                        member.send("You were hooked.");
                                    } else {
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
                await message.react("❌");
                for (let player of other.players) {
                    if (player.id !== member.id) {
                        await message.react(player.number + "\u20e3");
                    }
                }
                player.data = [message, collector];
            });
        },
        endNight: (member: Discord.GuildMember, player: Player, other) => {
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
        die: (member: Discord.GuildMember, player: Player, other) => { }
    },

    InsaneCop: {
        name: "Cop",
        realName: "Insane Cop",
        side: Side.VILLAGE,
        beginGame: (member: Discord.GuildMember, player: Player, other) => {
            member.send("You are a Cop, number " + player.number + ".");
        },
        endGame: (member: Discord.GuildMember, player: Player, other) => { },
        beginNight: (member: Discord.GuildMember, player: Player, other) => {
            let text = "";
            if (other.day === 1) {
                text = " 1-" + other.players.length;
            } else {
                for (let player of other.players) {
                    if (player.id !== member.id) {
                        text += "\n" + player.number + "- " + player.name;
                    }
                }
            }
            member.send("Night " + other.day + " has begun. React with the number of who you wish to investigate." + text).then(async (message: Discord.Message) => {
                let collector = message.createReactionCollector({ filter: (_reaction, user: Discord.User) => user.id === member.id });
                collector.on("collect", (reaction) => {
                    if (reaction.emoji.name === "❌") {
                        player.data = null;
                        player.actionDone = true;
                        message.edit(message.content + "\nYou investigated no one.");
                        collector.stop();
                        updateNight();
                    } else {
                        for (let target of other.players) {
                            if (target.id !== member.id && reaction.emoji.name === target.number + "\u20e3") {
                                player.data = null;
                                player.actionDone = true;
                                if (other.hookDecided) {
                                    other.hookDecided.push(() => {
                                        if (player.hooked) {
                                            member.send("You were hooked.");
                                        } else {
                                            member.send(target.name + " is sided with the " + (target.role.side === Side.MAFIA ? "village" : "mafia") + ".");
                                        }
                                    });
                                } else {
                                    if (player.hooked) {
                                        member.send("You were hooked.");
                                    } else {
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
                await message.react("❌");
                for (let player of other.players) {
                    if (player.id !== member.id) {
                        await message.react(player.number + "\u20e3");
                    }
                }
                player.data = [message, collector];
            });
        },
        endNight: (member: Discord.GuildMember, player: Player, other) => {
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
        die: (member: Discord.GuildMember, player: Player, other) => { }
    },

    ParanoidCop: {
        name: "Cop",
        realName: "Paranoid Cop",
        side: Side.VILLAGE,
        beginGame: (member: Discord.GuildMember, player: Player, other) => {
            member.send("You are a Cop, number " + player.number + ".");
        },
        endGame: (member: Discord.GuildMember, player: Player, other) => { },
        beginNight: (member: Discord.GuildMember, player: Player, other) => {
            let text = "";
            if (other.day === 1) {
                text = " 1-" + other.players.length;
            } else {
                for (let player of other.players) {
                    if (player.id !== member.id) {
                        text += "\n" + player.number + "- " + player.name;
                    }
                }
            }
            member.send("Night " + other.day + " has begun. React with the number of who you wish to investigate." + text).then(async (message: Discord.Message) => {
                let collector = message.createReactionCollector({ filter: (_reaction, user: Discord.User) => user.id === member.id });
                collector.on("collect", (reaction) => {
                    if (reaction.emoji.name === "❌") {
                        player.data = null;
                        player.actionDone = true;
                        message.edit(message.content + "\nYou investigated no one.");
                        collector.stop();
                        updateNight();
                    } else {
                        for (let target of other.players) {
                            if (target.id !== member.id && reaction.emoji.name === target.number + "\u20e3") {
                                player.data = null;
                                player.actionDone = true;
                                if (other.hookDecided) {
                                    other.hookDecided.push(() => {
                                        if (player.hooked) {
                                            member.send("You were hooked.");
                                        } else {
                                            member.send(target.name + " is sided with the mafia.");
                                        }
                                    });
                                } else {
                                    if (player.hooked) {
                                        member.send("You were hooked.");
                                    } else {
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
                await message.react("❌");
                for (let player of other.players) {
                    if (player.id !== member.id) {
                        await message.react(player.number + "\u20e3");
                    }
                }
                player.data = [message, collector];
            });
        },
        endNight: (member: Discord.GuildMember, player: Player, other) => {
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
        die: (member: Discord.GuildMember, player: Player, other) => { }
    },

    NaiveCop: {
        name: "Cop",
        realName: "Naive Cop",
        side: Side.VILLAGE,
        beginGame: (member: Discord.GuildMember, player: Player, other) => {
            member.send("You are a Cop, number " + player.number + ".");
        },
        endGame: (member: Discord.GuildMember, player: Player, other) => { },
        beginNight: (member: Discord.GuildMember, player: Player, other) => {
            let text = "";
            if (other.day === 1) {
                text = " 1-" + other.players.length;
            } else {
                for (let player of other.players) {
                    if (player.id !== member.id) {
                        text += "\n" + player.number + "- " + player.name;
                    }
                }
            }
            member.send("Night " + other.day + " has begun. React with the number of who you wish to investigate." + text).then(async (message: Discord.Message) => {
                let collector = message.createReactionCollector({ filter: (_reaction, user: Discord.User) => user.id === member.id });
                collector.on("collect", (reaction) => {
                    if (reaction.emoji.name === "❌") {
                        player.data = null;
                        player.actionDone = true;
                        message.edit(message.content + "\nYou investigated no one.");
                        collector.stop();
                        updateNight();
                    } else {
                        for (let target of other.players) {
                            if (target.id !== member.id && reaction.emoji.name === target.number + "\u20e3") {
                                player.data = null;
                                player.actionDone = true;
                                if (other.hookDecided) {
                                    other.hookDecided.push(() => {
                                        if (player.hooked) {
                                            member.send("You were hooked.");
                                        } else {
                                            member.send(target.name + " is sided with the village.");
                                        }
                                    });
                                } else {
                                    if (player.hooked) {
                                        member.send("You were hooked.");
                                    } else {
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
                await message.react("❌");
                for (let player of other.players) {
                    if (player.id !== member.id) {
                        await message.react(player.number + "\u20e3");
                    }
                }
                player.data = [message, collector];
            });
        },
        endNight: (member: Discord.GuildMember, player: Player, other) => {
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
        die: (member: Discord.GuildMember, player: Player, other) => { }
    },

    Gunsmith: {
        name: "Gunsmith",
        side: Side.VILLAGE,
        beginGame: (member: Discord.GuildMember, player: Player, other) => {
            member.send("You are a Gunsmith, number " + player.number + ".");
        },
        endGame: (member: Discord.GuildMember, player: Player, other) => { },
        beginNight: (member: Discord.GuildMember, player: Player, other) => {
            let text = "";
            if (other.day === 1) {
                text = " 1-" + other.players.length;
            } else {
                for (let player of other.players) {
                    if (player.id !== member.id) {
                        text += "\n" + player.number + "- " + player.name;
                    }
                }
            }
            member.send("Night " + other.day + " has begun. React with the number of who you wish to give a gun to." + text).then(async (message: Discord.Message) => {
                let collector = message.createReactionCollector({ filter: (_reaction, user: Discord.User) => user.id === member.id });
                collector.on("collect", (reaction) => {
                    if (reaction.emoji.name === "❌") {
                        player.data = null;
                        player.actionDone = true;
                        message.edit(message.content + "\nYou gave a gun to no one.");
                        collector.stop();
                        updateNight();
                    } else {
                        for (let target of other.players) {
                            if (target.id !== member.id && reaction.emoji.name === target.number + "\u20e3") {
                                player.data = null;
                                player.actionDone = true;
                                message.edit(message.content + "\nYou decided to give a gun to " + target.name + ".");
                                if (other.hookDecided) {
                                    other.hookDecided.push(() => {
                                        if (!player.hooked) {
                                            target.gun = true;
                                        }
                                    });
                                } else {
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
                await message.react("❌");
                for (let player of other.players) {
                    if (player.id !== member.id) {
                        await message.react(player.number + "\u20e3");
                    }
                }
                player.data = [message, collector];
            });
        },
        endNight: (member: Discord.GuildMember, player: Player, other) => {
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
        die: (member: Discord.GuildMember, player: Player, other) => { }
    },

    Deputy: {
        name: "Deputy",
        side: Side.VILLAGE,
        beginGame: (member: Discord.GuildMember, player: Player, other) => {
            member.send("You are a Deputy, number " + player.number + ". Your identity will not be revealed when shooting someone.");
            player.gun = true;
        },
        endGame: (member: Discord.GuildMember, player: Player, other) => { },
        beginNight: (member: Discord.GuildMember, player: Player, other) => {
            player.actionDone = true;
        },
        endNight: (member: Discord.GuildMember, player: Player, other) => { },
        die: (member: Discord.GuildMember, player: Player, other) => { }
    },

    Vanilla: {
        name: "Vanilla",
        side: Side.MAFIA,
        beginGame: (member: Discord.GuildMember, player: Player, other) => {
            member.guild.channels.fetch(mafiaSecretChannel).then((secret: Discord.TextChannel) => {
                secret.permissionOverwrites.create(member, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ADD_REACTIONS: true })
                setTimeout(() => {
                    secret.send(`<@${member.id}>, You are a Vanilla, number ${player.number}.`);
                }, 2000);
            });
        },
        endGame: (member: Discord.GuildMember, player: Player, other) => {
            member.guild.channels.fetch(mafiaSecretChannel).then((secret) => {
                secret.permissionOverwrites.delete(member);
            });
        },
        beginNight: (member: Discord.GuildMember, player: Player, other) => {
            member.guild.channels.fetch(mafiaSecretChannel).then((secret: Discord.TextChannel) => {
                secret.permissionOverwrites.create(member, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ADD_REACTIONS: true })
                player.actionDone = true;
            });
        },
        endNight: (member: Discord.GuildMember, player: Player, other) => { },
        die: (member: Discord.GuildMember, player: Player, other) => {
            member.guild.channels.fetch(mafiaSecretChannel).then((secret: Discord.TextChannel) => {
                secret.permissionOverwrites.create(member, { VIEW_CHANNEL: true, SEND_MESSAGES: false, ADD_REACTIONS: false })
            });
        }
    },

    VengefulVanilla: {
        name: "Vengeful Vanilla",
        side: Side.MAFIA,
        vengeful: true,
        beginGame: (member: Discord.GuildMember, player: Player, other) => {
            let secret = member.guild.channels.find((x) => x.name === mafiaSecretChannel) as Discord.TextChannel;
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ADD_REACTIONS: true });
            setTimeout(() => {
                secret.send("<@" + member.id + ">, You are a Vanilla, number " + player.number + ".");
            }, 2000);
        },
        endGame: (member: Discord.GuildMember, player: Player, other) => {
            let secret = member.guild.channels.find((x) => x.name === mafiaSecretChannel);
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ADD_REACTIONS: true });
            let overwrites = secret.permissionOverwrites.find((overwrites) => overwrites.type === "member" && overwrites.id === member.id);
            if (overwrites) {
                overwrites.delete();
            }
        },
        beginNight: (member: Discord.GuildMember, player: Player, other) => {
            let secret = member.guild.channels.find((x) => x.name === mafiaSecretChannel);
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ADD_REACTIONS: true });
            player.actionDone = true;
        },
        endNight: (member: Discord.GuildMember, player: Player, other) => { },
        die: (member: Discord.GuildMember, player: Player, other) => {
            let secret = member.guild.channels.find((x) => x.name === mafiaSecretChannel);
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: false, ADD_REACTIONS: false });
        }
    },

    Hooker: {
        name: "Hooker",
        side: Side.MAFIA,
        beginGame: (member: Discord.GuildMember, player: Player, other) => {
            let secret = member.guild.channels.find((x) => x.name === mafiaSecretChannel) as Discord.TextChannel;
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ADD_REACTIONS: true });
            setTimeout(() => {
                secret.send("<@" + member.id + ">, You are a Hooker, number " + player.number + ".");
            }, 2000);
        },
        endGame: (member: Discord.GuildMember, player: Player, other) => {
            let secret = member.guild.channels.find((x) => x.name === mafiaSecretChannel);
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ADD_REACTIONS: true });
            let overwrites = secret.permissionOverwrites.find((overwrites) => overwrites.type === "member" && overwrites.id === member.id);
            if (overwrites) {
                overwrites.delete();
            }
        },
        beginNight: (member: Discord.GuildMember, player: Player, other) => {
            other.hookDecided = [];
            let secret = member.guild.channels.find((x) => x.name === mafiaSecretChannel) as Discord.TextChannel;
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ADD_REACTIONS: true });
            secret.send("<@" + member.id + "> Use `;hook <number>` to hook someone, or just `;hook` to not hook tonight.");
            let collector = secret.createMessageCollector((message: Discord.Message) =>
                message.content.match(/^;hook( [0-9]+)?$/) && message.author.id === member.id
            );
            collector.on("collect", (message, collector) => {
                let match = message.content.match(/^;hook ([0-9]+)$/);
                if (match) {
                    let n = parseInt(match[1]);
                    for (let target of other.players) {
                        if (target.number === n) {
                            collector.stop();
                            player.data = null;
                            target.hooked = true;
                            for (let cb of other.hookDecided) {
                                cb();
                            }
                            other.hookDecided = null;
                            message.reply("You decided to hook number " + target.number + ", " + target.name + ".");
                            player.actionDone = true;
                            updateNight();
                        }
                    }
                } else if (message.content === ";hook") {
                    collector.stop();
                    player.data = null;
                    let secret = member.guild.channels.find((x) => x.name === mafiaSecretChannel) as Discord.TextChannel;
                    secret.send("<@" + member.id + "> You decided to hook no one.");
                    for (let cb of other.hookDecided) {
                        cb();
                    }
                    other.hookDecided = null;
                    player.actionDone = true;
                    updateNight();
                }
            });
            player.data = collector;
        },
        endNight: (member: Discord.GuildMember, player: Player, other) => {
            if (player.data) {
                if (!player.actionDone) {
                    let secret = member.guild.channels.find((x) => x.name === mafiaSecretChannel) as Discord.TextChannel;
                    secret.send("<@" + member.id + "> Hook timed out. You hook no one.");
                    player.actionDone = true;
                    for (let cb of other.hookDecided) {
                        cb();
                    }
                    other.hookDecided = null;
                }
                player.data.stop();
                player.data = null;
            }
        },
        die: (member: Discord.GuildMember, player: Player, other) => {
            let secret = member.guild.channels.find((x) => x.name === mafiaSecretChannel);
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: false, ADD_REACTIONS: false });
        }
    },

    Godfather: {
        name: "Godfather",
        side: Side.MAFIA,
        fakeSide: Side.VILLAGE,
        beginGame: (member: Discord.GuildMember, player: Player, other) => {
            let secret = member.guild.channels.find((x) => x.name === mafiaSecretChannel) as Discord.TextChannel;
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ADD_REACTIONS: true });
            setTimeout(() => {
                secret.send("<@" + member.id + ">, You are a Godfather, number " + player.number + ".");
            }, 2000);
        },
        endGame: (member: Discord.GuildMember, player: Player, other) => {
            let secret = member.guild.channels.find((x) => x.name === mafiaSecretChannel);
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ADD_REACTIONS: true });
            let overwrites = secret.permissionOverwrites.find((overwrites) => overwrites.type === "member" && overwrites.id === member.id);
            if (overwrites) {
                overwrites.delete();
            }
        },
        beginNight: (member: Discord.GuildMember, player: Player, other) => {
            let secret = member.guild.channels.find((x) => x.name === mafiaSecretChannel);
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ADD_REACTIONS: true });
            player.actionDone = true;
        },
        endNight: (member: Discord.GuildMember, player: Player, other) => { },
        die: (member: Discord.GuildMember, player: Player, other) => {
            let secret = member.guild.channels.find((x) => x.name === mafiaSecretChannel);
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: false, ADD_REACTIONS: false });
        }
    },

    Janitor: {
        name: "Janitor",
        side: Side.MAFIA,
        beginGame: (member: Discord.GuildMember, player: Player, other) => {
            let secret = member.guild.channels.find((x) => x.name === mafiaSecretChannel) as Discord.TextChannel;
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ADD_REACTIONS: true });
            setTimeout(() => {
                secret.send("<@" + member.id + ">, You are a Janitor, number " + player.number + ".");
            }, 2000);
        },
        endGame: (member: Discord.GuildMember, player: Player, other) => {
            let secret = member.guild.channels.find((x) => x.name === mafiaSecretChannel);
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ADD_REACTIONS: true });
            let overwrites = secret.permissionOverwrites.find((overwrites) => overwrites.type === "member" && overwrites.id === member.id);
            if (overwrites) {
                overwrites.delete();
            }
        },
        beginNight: (member: Discord.GuildMember, player: Player, other) => {
            let secret = member.guild.channels.find((x) => x.name === mafiaSecretChannel) as Discord.TextChannel;
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ADD_REACTIONS: true });
            if (player.janitorCleaned) {
                secret.send("<@" + member.id + "> You already cleaned someone. You can't clean anymore.");
                player.actionDone = true;
                return;
            }
            secret.send("<@" + member.id + "> Use `;clean <number>` to clean someone, or just `;clean` to not clean tonight. **You can only do this successfully once.**");
            let collector = secret.createMessageCollector((message: Discord.Message) =>
                message.content.match(/^;clean( [0-9]+)?$/) && message.author.id === member.id
            );
            collector.on("collect", (message, collector) => {
                let match = message.content.match(/^;clean ([0-9]+)$/);
                if (match) {
                    let n = parseInt(match[1]);
                    for (let target of other.players) {
                        if (target.number === n) {
                            collector.stop();
                            player.data = null;
                            target.cleaned = true;
                            message.reply("You decided to clean number " + target.number + ", " + target.name + ".");
                            player.actionDone = true;
                            updateNight();
                        }
                    }
                } else if (message.content === ";clean") {
                    collector.stop();
                    player.data = null;
                    let secret = member.guild.channels.find((x) => x.name === mafiaSecretChannel) as Discord.TextChannel;
                    secret.send("<@" + member.id + "> You decided to clean no one.");
                    player.actionDone = true;
                    updateNight();
                }
            });
            player.data = collector;
        },
        endNight: (member: Discord.GuildMember, player: Player, other) => {
            if (player.data) {
                if (!player.actionDone) {
                    let secret = member.guild.channels.find((x) => x.name === mafiaSecretChannel) as Discord.TextChannel;
                    secret.send("<@" + member.id + "> Clean timed out. You clean no one.");
                    player.actionDone = true;
                }
                player.data.stop();
                player.data = null;
            }
        },
        die: (member: Discord.GuildMember, player: Player, other) => {
            let secret = member.guild.channels.find((x) => x.name === mafiaSecretChannel);
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: false, ADD_REACTIONS: false });
        }
    },

    Illusionist: {
        name: "Illusionist",
        side: Side.MAFIA,
        beginGame: (member: Discord.GuildMember, player: Player, other) => {
            let secret = member.guild.channels.find((x) => x.name === mafiaSecretChannel) as Discord.TextChannel;
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ADD_REACTIONS: true });
            setTimeout(() => {
                secret.send("<@" + member.id + ">, You are an Illusionist, number " + player.number + ".");
            }, 2000);
            player.gun = true;
        },
        endGame: (member: Discord.GuildMember, player: Player, other) => {
            let secret = member.guild.channels.find((x) => x.name === mafiaSecretChannel);
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ADD_REACTIONS: true });
            let overwrites = secret.permissionOverwrites.find((overwrites) => overwrites.type === "member" && overwrites.id === member.id);
            if (overwrites) {
                overwrites.delete();
            }
        },
        beginNight: (member: Discord.GuildMember, player: Player, other) => {
            let secret = member.guild.channels.find((x) => x.name === mafiaSecretChannel) as Discord.TextChannel;
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: true, ADD_REACTIONS: true });
            if (!player.gun) {
                secret.send("<@" + member.id + "> You don't have a gun. You can't frame someone.");
                player.actionDone = true;
                return;
            }
            secret.send("<@" + member.id + "> Use `;frame <number>` to frame someone, or just `;frame` to not frame someone tonight. If you shoot someone tomorrow, that person will be shown as the shooter. If you don't frame someone, you will be revealed as the shooter.");
            let collector = secret.createMessageCollector((message: Discord.Message) =>
                message.content.match(/^;frame( [0-9]+)?$/) && message.author.id === member.id
            );
            collector.on("collect", (message, collector) => {
                let match = message.content.match(/^;frame ([0-9]+)$/);
                if (match) {
                    let n = parseInt(match[1]);
                    for (let target of other.players) {
                        if (target.number === n) {
                            collector.stop();
                            player.data = null;
                            player.frame = target.number;
                            message.reply("You decided to frame number " + target.number + ", " + target.name + ".");
                            player.actionDone = true;
                            updateNight();
                        }
                    }
                } else if (message.content === ";frame") {
                    collector.stop();
                    player.data = null;
                    player.frame = 0;
                    let secret = member.guild.channels.find((x) => x.name === mafiaSecretChannel) as Discord.TextChannel;
                    secret.send("<@" + member.id + "> You decided to frame no one.");
                    player.actionDone = true;
                    updateNight();
                }
            });
            player.data = collector;
        },
        endNight: (member: Discord.GuildMember, player: Player, other) => {
            if (player.data) {
                if (!player.actionDone) {
                    player.frame = 0;
                    let secret = member.guild.channels.find((x) => x.name === mafiaSecretChannel) as Discord.TextChannel;
                    secret.send("<@" + member.id + "> Frame timed out. You frame no one.");
                    player.actionDone = true;
                }
                player.data.stop();
                player.data = null;
            }
        },
        die: (member: Discord.GuildMember, player: Player, other) => {
            let secret = member.guild.channels.find((x) => x.name === mafiaSecretChannel);
            secret.overwritePermissions(member, { VIEW_CHANNEL: true, SEND_MESSAGES: false, ADD_REACTIONS: false });
        }
    },

    Dreamer: {
        name: "Dreamer",
        side: Side.VILLAGE,
        beginGame: (member: Discord.GuildMember, player: Player, other) => {
            member.send("You are a Dreamer, number " + player.number + ".");
        },
        endGame: (member: Discord.GuildMember, player: Player, other) => { },
        beginNight: (member: Discord.GuildMember, player: Player, other) => {
            let v = Math.floor(Math.random() * 2);
            let dream: string;
            if (v == 0) {
                // dream of one innocent person
                let innos = [];
                for (let p of other.players) {
                    if (p.id !== player.id && getSide(p) === Side.VILLAGE) {
                        innos.push(p);
                    }
                }
                if (innos.length == 0) {
                    dream = "You dreamt of an innocent person: yourself! Everybody else is guilty!";
                } else {
                    dream = "You dreamt of an innocent person: " + innos[Math.floor(Math.random() * innos.length)].name + "!";
                }

            } else if (v == 1) {
                // dream of three people, at least one of which is mafia
                let others = other.players.filter((v) => v.id !== player.id);
                if (others.length == 1) {
                    dream = "You dreamt of a suspect: " + others[0].name + "! They're guilty!";
                } else if (others.length == 2) {
                    dream = "You dreamt of two suspects: " + others.map((v) => v.name).join(", ") + "! At least one of them is guilty.";
                } else if (others.length == 3) {
                    dream = "You dreamt of three suspects: " + others.map((v) => v.name).join(", ") + "! At least one of them is guilty.";
                } else {
                    let p: number[];
                    do {
                        p = [Math.floor(Math.random() * others.length),
                        Math.floor(Math.random() * (others.length - 1)),
                        Math.floor(Math.random() * (others.length - 2))];
                        if (p[1] >= p[0]) p[1]++;
                        if (p[2] >= p[0]) p[2]++;
                        if (p[2] >= p[1]) p[2]++;
                    } while (!isSide(others[p[0]], Side.MAFIA) && !isSide(others[p[1]], Side.MAFIA) && !isSide(others[p[2]], Side.MAFIA));
                    dream = "You dreamt of three suspects: " + p.map((v) => others[v].name).join(", ") + "! At least one of them is guilty.";
                }
            }
            member.send("Night " + other.day + " has begun, and you went to sleep.");
            player.actionDone = true;
            if (other.hookDecided) {
                other.hookDecided.push(() => {
                    if (player.hooked) {
                        member.send("You were hooked.");
                    } else {
                        member.send(dream);
                    }
                    player.actionDone = true;
                });
            } else {
                if (player.hooked) {
                    member.send("You were hooked.");
                } else {
                    member.send(dream);
                }
                player.actionDone = true;
            }
            updateNight();
        },
        endNight: (member: Discord.GuildMember, player: Player, other) => { },
        die: (member: Discord.GuildMember, player: Player, other) => { }
    }
};

export const setups: { [name: string]: Setup } = {
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
