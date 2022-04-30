import { createServer } from 'http';
import Discord from 'discord.js';

import { death_messages, PARTIAL_SEND_PERMS, kaismile, mafiaSecretChannelId, NO_SEND_PERMS, roles, setups, VIEW_ONLY_PERMS, FULL_SEND_PERMS, mafiaPlayerId, mafiaChannelId } from './constants';
import { shuffleArray, countSides, listLynch, calculateLynch, getCount, getPlayers, listLunch } from './Helpers';
import { Side } from './enum';
import { Player, Role, Setup } from './classes';
import { botLoginAuth } from './auth';

const IntentFlags = Discord.Intents.FLAGS;
const myIntents = [
    IntentFlags.GUILDS,
    IntentFlags.GUILD_MEMBERS,
    IntentFlags.GUILD_MESSAGES,
    IntentFlags.GUILD_MESSAGE_REACTIONS,
    IntentFlags.DIRECT_MESSAGES,
    IntentFlags.DIRECT_MESSAGE_REACTIONS
];
// import * as Mongo from 'mongodb';

// const mclient = new Mongo.MongoClient("mongodb://keebot:keebotdb9@ds035485.mlab.com:35485/keebot");
// let collection: Mongo.Collection;

const client = new Discord.Client({
    intents: myIntents
});

const server = createServer((_req, res) => {
    res.end();
});
server.listen();


let updateNightf: () => void;
export function updateNight() {
    if (updateNightf) {
        updateNightf();
    }
}

let mafiaKill = 0;
let mafiaKiller = 0;
let hookDecided: (() => void)[];
let players: Player[] = [];
let deadPlayers: Player[] = [];
let day = 0;
let cantBeginDay = false;
let cantEndDay = false;
let gameRunning = false;
let vengefulGame = false;
let nightlessGame = false;
let daystartGame = false;
let daychatGame = false;
let dontRecordGame = false;
let gameInfo: { [id: string]: any };
let mafiaPlayer: Discord.Role;

let signupCollector: Discord.MessageCollector;
let dayCollector: Discord.MessageCollector;
let dayTimeout: NodeJS.Timeout;
let nightTimeout: NodeJS.Timeout;

function beginNight(channel: Discord.TextChannel, mafiaPlayer: Discord.Role) {
    if (!gameRunning) return;
    channel.permissionOverwrites.edit(mafiaPlayer, NO_SEND_PERMS);
    channel.send(`<@&${mafiaPlayer.id}> Night ${day} has begun. You have 7 minutes to act. If you are a power role, check your DMs. If you are mafia, check the mafia secret chat.`);

    for (let player of players) {
        channel.guild.members.fetch(player.id).then((member) => player.role.beginNight(member, player, {
            client: client,
            day: day,
            deadPlayers: deadPlayers,
            hookDecided: hookDecided,
            mafiaChannel: mafiaChannelId,
            players: players
        }));
    }

    let text = "";
    if (day === 1) {
        text = ` 1-${players.length}`;
    } else {
        for (let player of players) {
            text += `\n${player.number}- ${player.name}`;
        }
    }
    mafiaKill = 0;
    channel.guild.channels.fetch(mafiaSecretChannelId).then((secret: Discord.TextChannel) => {
        setTimeout(() => {
            secret.send(`<@&${mafiaPlayer.id}> Night ${day} has begun. Use \`;kill <number>\` to choose who to kill, or just \`;kill\` to not kill tonight. You cannot change your choice, so be careful.${text}`);
        }, 1000);
        let collector = secret.createMessageCollector({ filter: (message: Discord.Message) => message.content.match(/^;kill( [1-9][0-9]*)?$/) !== null });
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
            } else {
                let number = parseInt(message.content.match(/^;kill ([1-9][0-9]*)$/)[1]);
                for (let player of players) {
                    if (player.number === number) {
                        mafiaKill = number;
                        mafiaKiller = killer;
                        message.reply(`You decided to kill number ${number}, ${player.name}.`);
                        collector.stop();
                        updateNight();
                        break;
                    }
                }
            }
        });
        updateNightf = () => {
            if ((mafiaKill === 0 && nightTimeout) || !gameRunning) return;
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
                    channel.guild.members.fetch(player.id).then((member) => {
                        if (!daychatGame && player.role.side === Side.MAFIA) {
                            secret.permissionOverwrites.edit(member, VIEW_ONLY_PERMS);
                        }
                        player.role.endNight(member, player, {
                            client: client,
                            day: day,
                            deadPlayers: deadPlayers,
                            hookDecided: hookDecided,
                            mafiaChannel: mafiaChannelId,
                            players: players
                        });
                    });
                }
                if (mafiaKill === -2) {
                    secret.send("Kill timed out. You kill no one.");
                    channel.send("Nobody was killed!");
                } else if (mafiaKill === -1) {
                    channel.send("Nobody was killed!");
                } else {
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
                                channel.send(`<@${player.id}> is missing!`);
                                secret.send(`<@&${mafiaPlayer.id}> While cleaning up the mess, you learned that ${player.name} is a ${player.role.name}.`);
                            } else {
                                let m = death_messages[Math.floor(Math.random() * death_messages.length)];
                                channel.send(m.replace(/%pr/g, `<@${player.id}> (the ${player.role.name})`).replace(/%p/g, `<@${player.id}>`).replace(/%r/g, player.role.name));
                            }
                            channel.guild.members.fetch(player.id).then(member => {
                                player.role.die(member, player, {
                                    client: client,
                                    day: day,
                                    deadPlayers: deadPlayers,
                                    hookDecided: hookDecided,
                                    mafiaChannel: mafiaChannelId,
                                    players: players
                                });
                                member.roles.remove(mafiaPlayer);
                                players.splice(i, 1);
                                deadPlayers.push(player);
                                if (player.role.name === "Bomb") {
                                    for (let [i, player] of players.entries()) {
                                        if (player.number === mafiaKiller && (!player.saved || player.role.macho)) {
                                            if (player.cleaned) {
                                                channel.send(`<@${player.id}> exploded.`);
                                            } else {
                                                channel.send(`<@${player.id}>, the ${player.role.name}, exploded.`);
                                            }
                                            channel.guild.members.fetch(player.id).then(member => {
                                                player.role.die(member, player, {
                                                    client: client,
                                                    day: day,
                                                    deadPlayers: deadPlayers,
                                                    hookDecided: hookDecided,
                                                    mafiaChannel: mafiaChannelId,
                                                    players: players
                                                });
                                                member.roles.remove(mafiaPlayer);
                                                players.splice(i, 1);
                                                deadPlayers.push(player);
                                            });
                                            break;
                                        }
                                    }
                                }
                            });

                            break;
                        }
                    }
                    let [village, mafia, _third] = countSides(players);
                    if (vengefulGame ? village === 0 && mafia > 0 : mafia >= village) {
                        let text = "";
                        for (let player of players) {
                            let won = player.role.side === Side.MAFIA;
                            if (won) {
                                text += ` <@${player.id}>`;
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
                                text += ` <@${player.id}>`;
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
                        channel.send(`<@&${mafiaPlayer.id}> The Mafia won!${text}`);
                        endGame(channel, mafiaPlayer);
                        return;
                    } else if (vengefulGame ? mafia === 0 && village > 0 : mafia === 0) {
                        let text = "";
                        for (let player of players) {
                            let won = player.role.side === Side.VILLAGE;
                            if (won) {
                                text += ` <@${player.id}>`;
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
                                text += ` <@${player.id}>`;
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
                        channel.send(`<@&${mafiaPlayer.id}> The Village won!${text}`);
                        endGame(channel, mafiaPlayer);
                        return;
                    } else if (mafia === 0 && village === 0) {
                        gameInfo.winningSide = "tie";
                        channel.send(`<@&${mafiaPlayer.id}> It was a tie!`);
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
                channel.guild.members.fetch(player.id).then(member => player.role.endNight(member, player, {
                    client: client,
                    day: day,
                    deadPlayers: deadPlayers,
                    hookDecided: hookDecided,
                    mafiaChannel: mafiaChannelId,
                    players: players
                }));
            }
            if (mafiaKill === 0) {
                mafiaKill = -2;
            }
            updateNight();
        }, 420000);
    })
}

function beginDay(channel: Discord.TextChannel, mafiaPlayer: Discord.Role) {
    if (cantBeginDay || !gameRunning) {
        return;
    }
    cantBeginDay = true;
    cantEndDay = false;
    let numbers = "";
    for (let player of players) {
        numbers += `\n${player.number}- ${player.name}`;
    }
    for (let player of players) {
        if (player.gun) {
            channel.guild.members.fetch(player.id).then(member => member.send(`You have a gun. DM me \`;shoot <number>\` at any time during the day to shoot someone.${numbers}`));
        }
    }
    let [village, mafia, _third] = countSides(players);
    channel.send(`<@&${mafiaPlayer.id}> Day ${day++} has begun. You have 10 minutes to vote who to lynch with \`;lynch @usermention\`.${numbers}`);
    if (!vengefulGame) {
        if (village === mafia + 2) {
            channel.send("**It is MYLO, so the village must either lynch correctly or not lynch, otherwise there will be a high chance of losing.**");
        } else if (village === mafia + 1) {
            channel.send("**It is LYLO, so the village must lynch correctly, otherwise there will be a high chance of losing.**");
        }
    }
    channel.permissionOverwrites.edit(mafiaPlayer, PARTIAL_SEND_PERMS);
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
    dayCollector = channel.createMessageCollector({ filter: message => !!message.content.match(/^;((l(u|y)nch|shoot)( <@!?([0-9]{17,18})>)?|listl(u|y)nch|removelynch)$/) });
    dayCollector.on("collect", message => {
        let allVoted = true;
        for (let player of players) {
            if (player.id === message.author.id) {
                if (message.content === ";lynch") {
                    player.lynchVote = "nobody";
                    message.react(kaismile);
                } else if (message.content === ";removelynch") {
                    player.lynchVote = null;
                    message.react(kaismile);
                } else if (message.content === ";listlynch") {
                    message.reply(listLynch(players));
                } else if (message.content === ";listlunch") {
                    message.reply(listLunch());
                } else if (message.content === ";lunch") {
                    message.reply("Don't stay hungry.");
                } else if (message.content.startsWith(";lunch ")) {
                    let match = message.content.match(/^;lunch <@!?([0-9]{17,18})>$/);
                    if (match) {
                        message.reply("Interesting lunch choice.");
                    } else message.reply("Good lunch choice.");
                } else if (message.content === ";lynch") {
                    dontRecordGame = true;
                    player.lynchVote = "nobody";
                    message.react(kaismile);
                } else {
                    let match = message.content.match(/^;lynch <@!?([0-9]{17,18})>$/);
                    if (match) {
                        for (let player2 of players) {
                            if (player2.id === match[1]) {
                                player.lynchVote = player2.id;
                                message.react(kaismile);
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
            dayCollector.stop();
            dayCollector = null;
            clearTimeout(dayTimeout);
            endDay(channel, mafiaPlayer);
        }
    });
}

async function endDay(channel: Discord.TextChannel, mafiaPlayer: Discord.Role) {
    if (cantEndDay || !gameRunning) {
        return;
    }
    cantEndDay = true;
    if (dayCollector) {
        dayCollector.stop();
        dayCollector = null;
    }
    cantBeginDay = false;
    channel.permissionOverwrites.edit(mafiaPlayer, NO_SEND_PERMS);
    channel.send(listLynch(players));
    let lynch = calculateLynch(players);
    if (lynch) {
        let player: Player;
        let member: Discord.GuildMember;
        for (let [i, player] of players.entries()) {
            if (player.id === lynch) {
                channel.send(`<@${player.id}>, the ${player.role.name}, was lynched.`);
                member = await channel.guild.members.fetch(player.id);
                player.role.die(member, player, {
                    client: client,
                    day: day,
                    deadPlayers: deadPlayers,
                    hookDecided: hookDecided,
                    mafiaChannel: mafiaChannelId,
                    players: players
                });
                player = player;
                member.roles.remove(mafiaPlayer);
                players.splice(i, 1);
                deadPlayers.push(player);
                break;
            }
        }
        let testGameEnd = () => {
            let [village, mafia, _third] = countSides(players);
            if (vengefulGame ? village === 0 && mafia > 0 : mafia >= village) {
                let text = "";
                for (let player of players) {
                    let won = player.role.side === Side.MAFIA;
                    if (won) {
                        text += ` <@${player.id}>`;
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
                        text += ` <@${player.id}>`;
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
                channel.send(`<@&${mafiaPlayer.id}> The Mafia won!${text}`);
                endGame(channel, mafiaPlayer);
                return true;
            } else if (vengefulGame ? mafia === 0 && village > 0 : mafia === 0) {
                let text = "";
                for (let player of players) {
                    let won = player.role.side === Side.VILLAGE;
                    if (won) {
                        text += ` <@${player.id}>`;
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
                        text += ` <@${player.id}>`;
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
                channel.send(`<@&${mafiaPlayer.id}> The Village won!${text}`);
                endGame(channel, mafiaPlayer);
                return true;
            } else if (mafia === 0 && village === 0) {
                gameInfo.winningSide = "tie";
                channel.send(`<@&${mafiaPlayer.id}> It was a tie!`);
                endGame(channel, mafiaPlayer);
                return true;
            }
            return false;
        };
        if (testGameEnd()) return;
        if (player && player.role.vengeful) {
            let msg = await channel.send(`<@${player.id}>, choose someone to kill in revenge. You have 2 minutes.`) as Discord.Message;
            let collector = msg.createReactionCollector({ filter: (_reaction, user) => user.id === member.id });
            collector.on("collect", async reaction => {
                if (reaction.emoji.name === "❌") {
                    channel.send("No one was killed in revenge.");
                    clearTimeout(timeout);
                    collector.stop();
                    if (!testGameEnd()) {
                        if (nightlessGame) {
                            beginDay(channel, mafiaPlayer);
                        } else {
                            beginNight(channel, mafiaPlayer);
                        }
                    }
                } else if (reaction.emoji.name.endsWith + "\u20e3") {
                    for (let [i, player] of players.entries()) {
                        if (player.number === parseInt(reaction.emoji.name.substring(0, 1))) {
                            channel.send(`<@${player.id}>, the ${player.role.name}, was killed in revenge.`);
                            let member = await channel.guild.members.fetch(player.id);
                            player.role.die(member, player, {
                                client: client,
                                day: day,
                                deadPlayers: deadPlayers,
                                hookDecided: hookDecided,
                                mafiaChannel: mafiaChannelId,
                                players: players
                            });
                            member.roles.remove(mafiaPlayer);
                            players.splice(i, 1);
                            deadPlayers.push(player);
                            clearTimeout(timeout);
                            collector.stop();
                            if (!testGameEnd()) {
                                if (nightlessGame) {
                                    beginDay(channel, mafiaPlayer);
                                } else {
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
                } else {
                    beginNight(channel, mafiaPlayer);
                }
            }, 120000);
            await msg.react("❌");
            for (let player of players) {
                await msg.react(player.number + "\u20e3");
            }
            return;
        }
    } else {
        channel.send("Nobody was lynched.");
    }
    if (nightlessGame) {
        beginDay(channel, mafiaPlayer);
    } else {
        beginNight(channel, mafiaPlayer);
    }
}

async function endGame(channel: Discord.TextChannel, mafiaPlayer: Discord.Role) {
    gameRunning = false;
    gameInfo.endTime = Date.now();
    for (let player of players) {
        channel.guild.members.fetch(player.id).then((member) => {
            player.role.endGame(member, player, {
                client: client,
                day: day,
                deadPlayers: deadPlayers,
                hookDecided: hookDecided,
                mafiaChannel: mafiaChannelId,
                players: players
            });
            member.roles.remove(mafiaPlayer);
        });
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
        text += `${player.number}- ${player.name} (${player.role.realName || player.role.name})\n`;
    }
    channel.send(text);
    channel.permissionOverwrites.edit(channel.guild.roles.everyone, FULL_SEND_PERMS);
    channel.permissionOverwrites.edit(mafiaPlayer, FULL_SEND_PERMS);
    let secret = await channel.guild.channels.fetch(mafiaSecretChannelId);
    [...players, ...deadPlayers]
        .forEach(player => channel.members
            .filter(member => member.id === player.id && player.role.side === Side.MAFIA)
            .forEach(member => secret.permissionOverwrites.delete(member))
        )
    players = [];
    deadPlayers = [];
    cantEndDay = false;
    cantBeginDay = false;
    vengefulGame = false;
    nightlessGame = false;
    daystartGame = false;
    daychatGame = false;
    if (!dontRecordGame) {
        //     collection.findOne({}, (err, doc) => {
        //         doc.games.push(gameInfo);
        //         collection.updateOne({}, { $set: { games: doc.games } });
        //     });
    }
    dontRecordGame = true;
}

function beginGame(channel: Discord.TextChannel, mafiaPlayer: Discord.Role, setup: Setup) {
    if (signupCollector) {
        signupCollector.stop();
        signupCollector = null;
    }
    gameRunning = true;
    let setupName: any = Object.entries(setups).find(([name, s]) => s === setup);
    if (setupName) { setupName = setupName[0] };
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
    let sroles = shuffleArray(setup.roles) as (Role | Role[])[];
    players = [];
    deadPlayers = [];
    for (let member of mafiaPlayer.members.values()) {
        let role = sroles[players.length];
        if (role.constructor === Array) {
            let arr = role as Role[];
            role = arr[Math.round(Math.random() * (arr.length - 1))];
        }
        let player: Player = {
            name: member.user.username,
            id: member.id,
            number: 0,
            role: role as Role,
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
        channel.guild.members.fetch(player.id).then((member) => player.role.beginGame(member, player, {
            client: client,
            day: day,
            deadPlayers: deadPlayers,
            hookDecided: hookDecided,
            mafiaChannel: mafiaChannelId,
            players: players
        }));
    }
    channel.permissionOverwrites.edit(channel.guild.roles.everyone, NO_SEND_PERMS);
    day = 1;
    if (daystartGame || nightlessGame) {
        beginDay(channel, mafiaPlayer);
    } else {
        beginNight(channel, mafiaPlayer);
    }
}

// mclient.connect((error) => {
// 	if(error) {
// 		client.destroy();
// 		mclient.close();
// 		console.error("Failed to connect to Mongo server");
// 		console.error(error.message);
// 	} else {
// 		console.log("Connected to Mongo server");
// 		let db = mclient.db("keebot");
// 		collection = db.collection("mafia");
// 	}
// });

client.on("ready", () => {
    console.log(`Connected as ${client.user.tag}`);
});

client.on("error", (error) => {
    console.error(error.message);
});

client.on("message", async (message) => {
    if (message.channel.type === "DM" && message.author && dayCollector && !message.author.bot) {
        if (mafiaChannelId) {
            let channel = await client.channels.fetch(mafiaChannelId) as Discord.TextChannel;
            let match = message.content.match(/^;shoot ([0-9]+)$/);
            if (match) {
                let player: Player;
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
                                    channel.send(`<@${player2.id}>, the ${player2.role.name}, was shot by <@${shooter}>.`);
                                } else {
                                    channel.send(`<@${player2.id}>, the ${player2.role.name}, was shot.`);
                                }
                                let member = await channel.guild.members.fetch(player2.id);
                                player2.role.die(member, player2, {
                                    client: client,
                                    day: day,
                                    deadPlayers: deadPlayers,
                                    hookDecided: hookDecided,
                                    mafiaChannel: mafiaChannelId,
                                    players: players
                                });
                                member.roles.remove(mafiaPlayer);
                                players.splice(i, 1);
                                deadPlayers.push(player2);
                                if (player2.role.name === "Bomb") {
                                    for (let [i, p] of players.entries()) {
                                        if (p.id === player.id && (!player.saved || player.role.macho)) {
                                            channel.send(`<@${player.id}>, the ${player.role.name}, exploded.`);
                                            let member = await channel.guild.members.fetch(player.id);
                                            player.role.die(member, player, {
                                                client: client,
                                                day: day,
                                                deadPlayers: deadPlayers,
                                                hookDecided: hookDecided,
                                                mafiaChannel: mafiaChannelId,
                                                players: players
                                            });
                                            member.roles.remove(mafiaPlayer);
                                            players.splice(i, 1);
                                            deadPlayers.push(player);
                                            break;
                                        }
                                    }
                                }
                                let [village, mafia, _third] = countSides(players);
                                if (mafia > 0 && (vengefulGame ? village === 0 : mafia >= village)) {
                                    let text = "";
                                    for (let player of players) {
                                        let won = player.role.side === Side.MAFIA;
                                        if (won) {
                                            text += ` <@${player.id}>`;
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
                                            text += ` <@${player.id}>`;
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
                                    channel.send(`<@&${mafiaPlayer.id}> The Mafia won!${text}`);
                                    endGame(channel, mafiaPlayer);
                                    return;
                                } else if (vengefulGame ? mafia === 0 && village > 0 : mafia === 0) {
                                    let text = "";
                                    for (let player of players) {
                                        let won = player.role.side === Side.VILLAGE;
                                        if (won) {
                                            text += ` <@${player.id}>`;
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
                                            text += ` <@${player.id}>`;
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
                                    channel.send(`<@&${mafiaPlayer.id}> The Village won!${text}`);
                                    endGame(channel, mafiaPlayer);
                                    return;
                                } else if (mafia === 0 && village === 0) {
                                    gameInfo.winningSide = "tie";
                                    channel.send(`<@&${mafiaPlayer.id}> It was a tie!`);
                                    endGame(channel, mafiaPlayer);
                                    return;
                                }
                            }
                        }
                    } else {
                        message.author.send("You don't have a gun.");
                    }
                }
            }
        }
    } else if (message.guild && message.member) {
        if (!message.content.startsWith(";"))
            return;
        else if (message.author.id === "197436970052354049" && message.content.startsWith(";echo ")) {
            message.channel.send(message.content.substring(6));
            return;
        }
        const channel: Discord.TextChannel = message.channel as Discord.TextChannel;
        mafiaPlayer = message.guild.roles.cache.find((x) => x.name === "Mafia Player");
        if (!mafiaPlayer) {
            console.error(mafiaPlayer);
            mafiaPlayer = await message.guild.roles.fetch(mafiaPlayerId);
            if (!mafiaPlayer) {
                console.error(message);
                throw Error('Mafia Player Role not found');
            }
        }
        const mafiaId = mafiaPlayer.id;
        let hasMafiaManager = message.member.roles.cache.find((x) => x.name === "Mafia Manager");
        if (mafiaPlayer && hasMafiaManager && !message.author.bot) {
            // if (!channel.permissionOverwrites.cache.find((overwrites) => overwrites.type === "role" && overwrites.id === mafiaPlayer.id)) {
            //     if (mafiaChannelId) {
            //         channel = client.channels.cache.find((c) => c.id === mafiaChannelId) as Discord.TextChannel;
            //     } else {
            //         return;
            //     }
            // }
            if (message.content === ";startsignup") {
                if (!signupCollector) {
                    channel.send("Signup for a new round of Mafia has started! If you want to join, type `;signup`.");
                    signupCollector = channel.createMessageCollector({ filter: (message) => !!message.content.match(/^;(sign(up|out)|player(s|list))$/) });
                    signupCollector.on("collect", async (message) => {
                        if (message.content === ";signup") {
                            message.member.roles.add(mafiaPlayer);
                            message.react(kaismile);
                        } else if (message.content === ";signout") {
                            message.member.roles.remove(mafiaPlayer);
                            message.react(kaismile);
                        } else if (message.content === ";players") {
                            let count = await getCount(message, mafiaId);
                            if (count < 10) {
                                message.react(`${count}\u20e3`);
                            } else if (count === 10) {
                                message.react("🔟");
                            } else if (count < 21) {
                                let one = false;
                                count.toString().split("").forEach(async (v) => {
                                    if (v === "1") {
                                        if (one) {
                                            await message.react("538537337609781258");
                                        } else {
                                            await message.react("1\u20e3");
                                            one = true;
                                        }
                                    } else {
                                        await message.react(`${v}\u20e3`);
                                    }
                                });
                            } else {
                                message.reply(count.toString());
                            }
                        } else if (message.content === ";playerlist") {
                            const players = await getPlayers(message, mafiaId);
                            if (!players.size) {
                                message.reply({
                                    content: "There are no players currently signed up."
                                })
                            } else {
                                let playerList = "";
                                players.toJSON().forEach((player, index) => {
                                    playerList += `${index + 1}: ${player.user.toString()}\n`;
                                });
                                message.reply({
                                    embeds: [{
                                        title: "Signed up players",
                                        description: playerList
                                    }]
                                });
                            }
                        }
                    });
                }
            } else if (message.content === ";stopsignup") {
                if (signupCollector) {
                    signupCollector.stop();
                    signupCollector = null;
                }
                message.guild.roles.fetch(mafiaId).then(role =>
                    role.members.forEach(member =>
                        member.roles.remove(role)
                    )
                );
                message.react(kaismile);
            } else if (message.content === ";listroles") {
                let text;
                for (let [i] of Object.entries(roles)) {
                    if (text) {
                        text += `, ${i}`;
                    } else {
                        text = i;
                    }
                }
                message.reply(`Roles: ${text}`);
            } else if (message.content === ";listsetups") {
                let text;
                for (let [i, v] of Object.entries(setups)) {
                    if (text) {
                        text += `, ${i} (${v.roles.length})`;
                    } else {
                        text = `${i} (${v.roles.length})`;
                    }
                }
                message.reply(`Setups: ${text}`);
            } else if (message.content.startsWith(";setupinfo ")) {
                let name = message.content.substring(11).toLowerCase();
                if (name in setups) {
                    let setup = setups[name];
                    let text = "";
                    for (let role of setup.roles) {
                        if (role instanceof Array) {
                            text += ` [${role.map((r) => Object.entries(roles).find((v) => v[1] === r)[0]).join("/")}]`;
                        } else {
                            let name = Object.entries(roles).find((v) => v[1] === role)[0];
                            text += ` [${name}]`;
                        }
                    }
                    if (setup.daystart) text += " -daystart";
                    if (setup.nightless) text += " -nightless";
                    if (setup.daychat) text += " -daychat";
                    if (setup.vengeful) text += " -vengeful";
                    if (setup.dontRecord) text += " -dontRecord";
                    message.reply(`${name} (${setup.roles.length}): ${text}`);
                } else {
                    message.reply("That setup doesn't exist");
                }
            } else if (message.content.match(/^;\s*setupcustom\s+.*$/)) {
                let desc = message.content.match(/^;\s*setupcustom\s+(.*)$/)[1];
                let match = desc.match(/\[.*?\](?:x[0-9]+)?(?=\s*)/g);
                let setup = new Setup();
                setup.roles = [];
                setup.dontRecord = true;
                let error: string[] = [];
                for (let m of match) {
                    let count = 1;
                    let idx = m.indexOf("]");
                    if (m.length > idx + 1) {
                        count = parseInt(m.substring(idx + 2));
                    }
                    let role = m.substring(1, idx);
                    let alts = (role.includes("/") ? role.split("/") : [role])
                        .map((v) => {
                            if (v in roles) {
                                return roles[v];
                            } else {
                                error.push(v);
                            }
                        });
                    for (let i = 0; i < count; i++) {
                        setup.roles.push(alts);
                    }
                }
                let oerror: string[] = [];
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
                        text += `Roles not found: ${error}\n`;
                    }
                    if (oerror.length != 0) {
                        text += `Options not found: ${oerror}\n`;
                    }
                    message.reply(text);
                    return;
                }

                if (signupCollector) {
                    signupCollector.stop();
                    signupCollector = null;
                }

                const playerCount = await getCount(message, mafiaId);
                if (playerCount === setup.roles.length) {
                    message.react(kaismile);
                    beginGame(channel, mafiaPlayer, setup);
                } else if (playerCount < setup.roles.length) {
                    message.reply(`Not enough players. You need ${setup.roles.length}, but there are ${playerCount}.`);
                } else {
                    message.reply(`Too many players. You need ${setup.roles.length}, but there are ${playerCount}.`);
                }
            } else if (message.content.startsWith(";setup ")) {
                const playerCount = await getCount(message, mafiaId);
                const setup = setups[message.content.substring(7).toLowerCase()];
                if (setup) {
                    if (playerCount === setup.roles.length) {
                        if (signupCollector) {
                            signupCollector.stop();
                            signupCollector = null;
                        }
                        message.react(kaismile);
                        beginGame(channel, mafiaPlayer, setup);
                    } else if (playerCount < setup.roles.length) {
                        message.reply(`Not enough players. You need ${setup.roles.length}, but there are ${playerCount}.`);
                    } else {
                        message.reply(`Too many players. You need ${setup.roles.length}, but there are ${playerCount}.`);
                    }
                } else {
                    message.reply("That setup doesn't exist.");
                }
            } else if (message.content === ";cleanup") {
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
                        channel.guild.members.fetch(player.id).then(member => player.role.endNight(member, player, {
                            client: client,
                            day: day,
                            deadPlayers: deadPlayers,
                            hookDecided: hookDecided,
                            mafiaChannel: mafiaChannelId,
                            players: players
                        }));
                    }
                    if (mafiaKill === 0) {
                        mafiaKill = -2;
                    }
                    updateNight();
                }
                channel.permissionOverwrites.edit(mafiaPlayer, FULL_SEND_PERMS);
                for (let member of mafiaPlayer.members.values()) {
                    member.roles.remove(mafiaPlayer);
                }
                let secret = await channel.guild.channels.fetch(mafiaSecretChannelId) as Discord.TextChannel;
                for (let overwrites of secret.permissionOverwrites.cache.values()) {
                    if (overwrites.type === "member") {
                        overwrites.delete();
                    }
                }
                channel.permissionOverwrites.edit(channel.guild.roles.everyone, FULL_SEND_PERMS);
                cantEndDay = false;
                cantBeginDay = false;
                vengefulGame = false;
                nightlessGame = false;
                daystartGame = false;
                daychatGame = false;
                dontRecordGame = false;
            } else if (message.content === ";partialcleanup") {
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
                        channel.guild.members.fetch(player.id).then(member => player.role.endNight(member, player, {
                            client: client,
                            day: day,
                            deadPlayers: deadPlayers,
                            hookDecided: hookDecided,
                            mafiaChannel: mafiaChannelId,
                            players: players
                        }));
                    }
                    if (mafiaKill === 0) {
                        mafiaKill = -2;
                    }
                    updateNight();
                }
                channel.permissionOverwrites.edit(mafiaPlayer, FULL_SEND_PERMS);
                let secret = await channel.guild.channels.fetch(mafiaSecretChannelId) as Discord.TextChannel;
                for (let overwrites of secret.permissionOverwrites.cache.values()) {
                    if (overwrites.type === "member") {
                        overwrites.delete();
                    }
                }
                channel.permissionOverwrites.edit(channel.guild.roles.everyone, FULL_SEND_PERMS);
                cantEndDay = false;
                cantBeginDay = false;
                vengefulGame = false;
                nightlessGame = false;
                daystartGame = false;
                daychatGame = false;
                dontRecordGame = false;
            }
            //  else {
            //     let match = message.content.match(/^;stat((?:-[A-Za-z])*)(?:-([0-9]+))? ([A-Za-z_0-9\-]+)$/);
            //     if (match) {
            //         let oinverse = false;
            //         let orate = false;
            //         for (let opt of match[1].split("-")) {
            //             switch (opt) {
            //                 case "i":
            //                     oinverse = true;
            //                     break;
            //                 case "r":
            //                     orate = true;
            //                     break;
            //                 case "":
            //                     break;
            //                 default:
            //                     message.reply("Option -" + opt + " doesn't exist.");
            //                     return;
            //             }
            //         }
            //         let entries: [string, any, number, number?][] = [];
            //         let mode = 0;
            //         let value: string = null;
            //         function set(x: string) {
            //             mode = 1;
            //             value = x;
            //         }
            //         function freq(value: string, display?: any) {
            //             mode = 2;
            //             let entry = entries.find((y) => y[0] === value);
            //             if (entry) {
            //                 entry[2]++;
            //             } else {
            //                 entries.push([value, display || value, 1]);
            //             }
            //         }
            //         function rate(b: boolean, value: string, display?: any) {
            //             mode = 3;
            //             let entry = entries.find((y) => y[0] === value);
            //             if (entry) {
            //                 if (b) {
            //                     entry[2]++;
            //                 } else {
            //                     entry[3]++;
            //                 }
            //             } else {
            //                 entries.push([value, display || value, b ? 1 : 0, b ? 0 : 1]);
            //             }
            //         }
            //         collection.findOne({}, (err, doc) => {
            //             let stat = doc.statfns[match[3].toLowerCase()];
            //             if (!stat) {
            //                 message.reply("That statistic function doesn't exist.");
            //                 return;
            //             }
            //             if (stat.scope === "o") {
            //                 try {
            //                     new Function(stat.code).call({
            //                         games: doc.games,
            //                         set,
            //                         rate,
            //                         freq
            //                     });
            //                 } catch (e) {
            //                     message.reply("Error:\n" + e);
            //                     return;
            //                 }
            //             } else if (stat.scope === "g") {
            //                 for (let game of doc.games) {
            //                     try {
            //                         new Function(stat.code).call({
            //                             game,
            //                             set,
            //                             rate,
            //                             freq
            //                         });
            //                     } catch (e) {
            //                         message.reply("Error:\n" + e);
            //                         return;
            //                     }
            //                 }
            //             } else if (stat.scope === "p") {
            //                 for (let game of doc.games) {
            //                     for (let player of game.players) {
            //                         try {
            //                             new Function(stat.code).call({
            //                                 game,
            //                                 player,
            //                                 set,
            //                                 rate,
            //                                 freq
            //                             });
            //                         } catch (e) {
            //                             message.reply("Error:\n" + e);
            //                             return;
            //                         }
            //                     }
            //                 }
            //             }
            //             if (mode === 1) {
            //                 message.reply(match[3] + ":\n" + (value || "<null value!>"));
            //             } else if (mode === 2) {
            //                 entries = entries.sort((a, b) => b[2] - a[2]);
            //                 let res: any[][] = [];
            //                 let counts: number[] = [];
            //                 let lastCount = -1;
            //                 let total = 0;
            //                 for (let [x, v, count] of entries) {
            //                     total += count;
            //                     if (count === lastCount) {
            //                         res[res.length - 1].push(v);
            //                     } else {
            //                         lastCount = count;
            //                         res.push([v]);
            //                         counts.push(count);
            //                     }
            //                     if (lastCount === -1) {
            //                         lastCount = count;
            //                     }
            //                 }
            //                 if (oinverse) {
            //                     let text = match[3] + " (inverse):";
            //                     for (let i = 1; i <= (match[2] ? parseInt(match[2]) : 5); i++) {
            //                         if (res[res.length - i]) {
            //                             if (orate) {
            //                                 text += "\n" + i + "- " + res[res.length - i].join(", ") + " (" + Math.round(counts[res.length - i] * 100 / total) + "%)";
            //                             } else {
            //                                 text += "\n" + i + "- " + res[res.length - i].join(", ") + " (" + counts[res.length - i] + ")";
            //                             }
            //                         }
            //                     }
            //                     message.reply(text);
            //                 } else {
            //                     let text = match[3] + ":";
            //                     for (let i = 1; i <= (match[2] ? parseInt(match[2]) : 5); i++) {
            //                         if (res[i - 1]) {
            //                             if (orate) {
            //                                 text += "\n" + i + "- " + res[i - 1].join(", ") + " (" + Math.round(counts[i - 1] * 100 / total) + "%)";
            //                             } else {
            //                                 text += "\n" + i + "- " + res[i - 1].join(", ") + " (" + counts[i - 1] + ")";
            //                             }
            //                         }
            //                     }
            //                     message.reply(text);
            //                 }
            //             } else if (mode === 3) {
            //                 entries = (entries.map((v) => [v[0], v[1], v[2] * 100 / (v[2] + v[3])]) as [string, any, number]).sort((a, b) => b[2] - a[2]);
            //                 let res: any[][] = [];
            //                 let counts: number[] = [];
            //                 let lastCount = -1;
            //                 for (let [x, v, count] of entries) {
            //                     if (count === lastCount) {
            //                         res[res.length - 1].push(v);
            //                     } else {
            //                         lastCount = count;
            //                         res.push([v]);
            //                         counts.push(count);
            //                     }
            //                     if (lastCount === -1) {
            //                         lastCount = count;
            //                     }
            //                 }
            //                 if (oinverse) {
            //                     let text = match[3] + " (inverse):";
            //                     for (let i = 1; i <= (match[2] ? parseInt(match[2]) : 5); i++) {
            //                         if (res[res.length - i]) {
            //                             text += "\n" + i + "- " + res[res.length - i].join(", ") + " (" + Math.round(counts[res.length - i]) + "%)";
            //                         }
            //                     }
            //                     message.reply(text);
            //                 } else {
            //                     let text = match[3] + ":";
            //                     for (let i = 1; i <= (match[2] ? parseInt(match[2]) : 5); i++) {
            //                         if (res[i - 1]) {
            //                             text += "\n" + i + "- " + res[i - 1].join(", ") + " (" + Math.round(counts[i - 1]) + "%)";
            //                         }
            //                     }
            //                     message.reply(text);
            //                 }
            //             }
            //         });
            //     } else {
            //         match = message.content.match(/^;addstat((?:-[a-zA-Z])*) ([A-Za-z_0-9]+) ([\s\S]+)$/);
            //         if (match) {
            //             let statfn: { [id: string]: any } = { scope: "g" };
            //             for (let opt of match[1].split("-")) {
            //                 switch (opt) {
            //                     case "o":
            //                     case "g":
            //                     case "p":
            //                         statfn.scope = opt;
            //                     case "":
            //                         break;
            //                     default:
            //                         message.reply("Option -" + opt + " doesn't exist.");
            //                         return;
            //                 }
            //             }
            //             collection.findOne({}, (err, doc) => {
            //                 try {
            //                     new Function(match[3]);
            //                     statfn.code = match[3];
            //                     doc.statfns[match[2].toLowerCase()] = statfn;
            //                     collection.updateOne({}, { $set: { statfns: doc.statfns } });
            //                     message.react(kaismile);
            //                 } catch (e) {
            //                     message.reply("Error:\n" + e.message);
            //                 }
            //             });
            //         } else {
            //             match = message.content.match(/^;removestat ([A-Za-z_0-9\-]+)$/);
            //             if (match) {
            //                 collection.findOne({}, (err, doc) => {
            //                     delete doc.statfns[match[1].toLowerCase()];
            //                     collection.updateOne({}, { $set: { statfns: doc.statfns } });
            //                     message.react(kaismile);
            //                 });
            //             }
            //         }
            //     }
            // }
        }
    }
});

client.login(botLoginAuth);
