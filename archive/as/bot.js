const http = require("http");
const Discord = require("discord.js");
const client = new Discord.Client();

const server = http.createServer((req, res) => {
	res.end();
});

server.listen();

let stopped;
let signup;
let signupsize = 0;
let savedsetup;
let votes = {};
let timers;

function shuffleArray(array) {
	for(let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
}

function toTime(ms) {
	let min = Math.floor(ms / 60000);
	let sec = Math.floor(ms % 60000 / 1000);
	if(min === 0) {
		return sec + "s";
	} else if(sec === 0) {
		return min + "min";
	}
	return min + "min" + sec + "s";
}

function listLynch(mafiaPlayers) {
	let text = "";
	let count = {};
	for(let [user1, user2] of Object.entries(votes)) {
		text += user1 + " voted to lynch " + user2 + "\n";
		if(count.hasOwnProperty(user2)) {
			count[user2]++;
		} else {
			count[user2] = 1;
		}
	}
	let dead = "<nobody>";
	let biggest = 0;
	for(let [user, num] of Object.entries(count)) {
		if(num > biggest) {
			dead = user;
			biggest = num;
		} else if(num === biggest) {
			dead = "<nobody>";
		}
	}
	return text + "\n**The consensus is to lynch " + dead + ".**\n" + Object.keys(votes).length + "/" + mafiaPlayers + " players have voted so far.";
}

function setup(receivedMessage, content, mafiaPlayer, everyone) {
	signup = false;
	let matches = content.match(/[mt]?\[[\s\S]*?\](x[0-9]+)?/g);
	let roles = [];
	for(let i = 0; i < matches.length; i++) {
		let matches2 = matches[i].match(/([mt])?\[([\s\S]+?)(?:\/([\s\S]+?))?\](?:x([0-9]+))?/);
		let count = matches2[4]? parseInt(matches2[4]): 1;
		for(let i = 0; i < count; i++) {
			roles.push([matches2[2], matches2[3] || matches2[2], matches2[1]]);
		}
	}
	let players = mafiaPlayer.members.array();
	if(roles.length === players.length) {
		shuffleArray(roles);
		shuffleArray(players);
		let village = "**Full Description**";
		let mafia = "";
		let third = "";
		let village2 = "\n---------------------------------------------";
		let mafia2 = "";
		let third2 = "";
		let text = "**Player Numbers**";
		let secret = receivedMessage.guild.channels.find("name", "mafia-secret-chat");
		for(let i = 0; i < roles.length; i++) {
			if(roles[i][2] === "m") {
				if(mafia === "") {
					mafia = "\n";
					mafia2 = "\n";
				}
				secret.overwritePermissions(players[i], {VIEW_CHANNEL: true, READ_MESSAGE_HISTORY: true});
				if(roles[i][1] !== roles[i][0]) {
					mafia += "\n" + roles[i][0] + "/" + roles[i][1] + ": " + players[i].user.username;
					mafia2 += "\n" + players[i].user.username + ": " + roles[i][0] + "/" + roles[i][1];
				} else {
					mafia += "\n" + roles[i][0] + ": " + players[i].user.username;
					mafia2 += "\n" + players[i].user.username + ": " + roles[i][0];
				}
				setTimeout(() => {
					secret.send("<@" + players[i].id + ">, You are a " + roles[i][1] + ", number " + (i + 1) + ".");
				}, 3000);
			} else if(roles[i][2] === "t") {
				if(third === "") {
					third = "\n";
					third2 = "\n";
				}
				secret.overwritePermissions(players[i], {VIEW_CHANNEL: false, READ_MESSAGE_HISTORY: false});
				if(roles[i][1] !== roles[i][0]) {
					third += "\n" + roles[i][0] + "/" + roles[i][1] + ": " + players[i].user.username;
					third2 += "\n" + players[i].user.username + ": " + roles[i][0] + "/" + roles[i][1];
				} else {
					third += "\n" + roles[i][0] + ": " + players[i].user.username;
					third2 += "\n" + players[i].user.username + ": " + roles[i][0];
				}
				players[i].send("You are a " + roles[i][1] + ", number " + (i + 1) + ".\n\n\
If you're a power role, please send your actions to the game master, not to me!");
			} else {
				if(roles[i][1] !== roles[i][0]) {
					village += "\n" + roles[i][0] + "/" + roles[i][1] + ": " + players[i].user.username;
					village2 += "\n" + players[i].user.username + ": " + roles[i][0] + "/" + roles[i][1];
				} else {
					village += "\n" + roles[i][0] + ": " + players[i].user.username;
					village2 += "\n" + players[i].user.username + ": " + roles[i][0];
				}
				secret.overwritePermissions(players[i], {VIEW_CHANNEL: false, READ_MESSAGE_HISTORY: false});
				players[i].send("You are a " + roles[i][1] + ", number " + (i + 1) + ".\n\n\
If you're a power role, please send your actions to the game master, not to me!");
			}
			text += "\n" + (i + 1) + ": " + players[i].user.username;
		}
		receivedMessage.member.send(village + mafia + third + village2 + mafia2 + third2 + "\n---------------------------------------------");
		receivedMessage.member.send(text);
		signup = false;
		votes = {};
		receivedMessage.channel.overwritePermissions(everyone, {SEND_MESSAGES: false, ADD_REACTIONS: false});
		receivedMessage.channel.overwritePermissions(mafiaPlayer, {SEND_MESSAGES: false, ADD_REACTIONS: false});
		receivedMessage.react("497430068331544577");
		receivedMessage.pin();
	} else {
		receivedMessage.reply("Number of roles (" + roles.length + ") doesn't match number of players (" + players.length + ")");
	}
}

client.on("ready", () => {
	console.log("Connected as " + client.user.tag);
});

client.on("message", async receivedMessage => {
	if(receivedMessage.author !== client.user) {
		if(receivedMessage.channel.name === "mafia-general" || receivedMessage.channel.name === "mafia-lobby" || receivedMessage.channel.name === "bot-test-channel") {
			let moderator = receivedMessage.guild.roles.find(role => role.name === "moderator");
			let mafiaPlayer = receivedMessage.guild.roles.find(role => role.name === "Mafia Player");
			let master = receivedMessage.guild.roles.find(role => role.name === "Mafia Master");
			let everyone = receivedMessage.guild.roles.find(role => role.name === "@everyone");
			if(receivedMessage.content === ":startmafia" && receivedMessage.member.roles.has(moderator.id)) {
				stopped = false;
				receivedMessage.react("497430068331544577");
			} else if(receivedMessage.content === ":stopmafia" && receivedMessage.member.roles.has(moderator.id)) {
				stopped = true;
				receivedMessage.react("497430068331544577");
			} else if(!stopped) {
				if(receivedMessage.content.match(/^[lL]ynch:[\s\S]*$/) && receivedMessage.member.roles.has(mafiaPlayer.id)) {
					let user1 = receivedMessage.author.username;
					let user2 = receivedMessage.mentions.users.array().length != 0?
						receivedMessage.mentions.users.array()[0].username:
						"<nobody>";	
					votes[user1] = user2;
					receivedMessage.react("497430068331544577");
				} else if(receivedMessage.content === ":removelynch" && receivedMessage.member.roles.has(mafiaPlayer.id)) {
					delete votes[receivedMessage.author.username];
					receivedMessage.react("497430068331544577");
				} else if(receivedMessage.content === ":listlynch") {
					receivedMessage.reply(listLynch(mafiaPlayer.members.size));
				} else if(receivedMessage.content === ":resetlynch" && receivedMessage.member.roles.has(master.id)) {
					votes = {};
					receivedMessage.react("497430068331544577");
				} else if(receivedMessage.content === ":setup" && receivedMessage.member.roles.has(master.id)) {
					setup(receivedMessage, savedsetup, mafiaPlayer, everyone);
					savedsetup = undefined;
				} else if(receivedMessage.content.startsWith(":setup") && receivedMessage.member.roles.has(master.id)) {
					setup(receivedMessage, receivedMessage.content, mafiaPlayer, everyone);
				} else if(receivedMessage.content.match(/^:startsignup(\s+[0-9]+)?$/) && receivedMessage.member.roles.has(master.id)) {
					let matches = receivedMessage.content.match(/^:startsignup(?:\s+([0-9]+))?$/);
					signupsize = matches[1]? parseInt(matches[1]): 0;
					signup = true;
					if(signupsize !== 0) {
						receivedMessage.channel.send("Everybody! Signup for a new round of Mafia has started! If you want to join, type `:signup`. There are only " + signupsize + " slots, so be quick!");
					} else {
						receivedMessage.channel.send("Everybody! Signup for a new round of Mafia has started! If you want to join, type `:signup`.");
					}
				} else if(receivedMessage.content === ":standoff") {
					receivedMessage.reply("https://pbs.twimg.com/media/DYYRl-XVAAEalDH.jpg");
				} else if(receivedMessage.content === ":standoffgif") {
					receivedMessage.reply("https://thumbs.gfycat.com/SmoothGraciousHomalocephale-size_restricted.gif");
				} else if(receivedMessage.content === ":endsignup" && receivedMessage.member.roles.has(master.id)) {
					signup = false;
					receivedMessage.react("497430068331544577");
				} else if(receivedMessage.content === ":signup") {
					if(signup) {
						await receivedMessage.member.addRole(mafiaPlayer);
						if(signupsize !== 0 && mafiaPlayer.members.size >= signupsize) {
							receivedMessage.channel.send("Maximum of " + signupsize + " players reached. Ending signup.")
							signup = false;
						}
						receivedMessage.react("497430068331544577");
					}
				} else if(receivedMessage.content === ":signout" && receivedMessage.member.roles.has(mafiaPlayer.id)) {
					if(signup) {
						receivedMessage.member.removeRole(mafiaPlayer);
						receivedMessage.react("497430068331544577");
					}
				} else if(receivedMessage.content.match(/^:timer [0-9]+$/) && receivedMessage.member.roles.has(master.id)) {
					let ms = parseInt(receivedMessage.content.match(/^:timer ([0-9]+)$/)[1]) * 60000;
					if(timers) {
						for(let timer of timers) {
							clearTimeout(timer);
						}
					}
					timers = [
						setTimeout(() => {
							receivedMessage.channel.send("Half the time has passed. " + toTime(ms / 2) + " remaining.");
						}, ms / 2),
						setTimeout(() => {
							receivedMessage.channel.send(toTime(ms / 4) + " remaining.");
						}, ms * 3 / 4),
						setTimeout(() => {
							receivedMessage.channel.send("1min remaining.");
						}, ms - 60000),
						setTimeout(() => {
							receivedMessage.channel.send("10");
							setTimeout(() => {
								receivedMessage.channel.send("9");
								setTimeout(() => {
									receivedMessage.channel.send("8");
									setTimeout(() => {
										receivedMessage.channel.send("7");
										setTimeout(() => {
											receivedMessage.channel.send("6");
											setTimeout(() => {
												receivedMessage.channel.send("5");
												setTimeout(() => {
													receivedMessage.channel.send("4");
													setTimeout(() => {
														receivedMessage.channel.send("3");
														setTimeout(() => {
															receivedMessage.channel.send("2");
															setTimeout(() => {
																receivedMessage.channel.send("1");
																setTimeout(() => {
																	receivedMessage.channel.send("Time's up.");
																	receivedMessage.channel.overwritePermissions(mafiaPlayer, {SEND_MESSAGES: false, ADD_REACTIONS: false});
																	receivedMessage.channel.send(listLynch(mafiaPlayer.members.size));
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
						}, ms - 10000)
					];
					receivedMessage.react("497430068331544577");
				} else if(receivedMessage.content === ":stoptimer" && receivedMessage.member.roles.has(master.id)) {
					if(timers) {
						for(let timer of timers) {
							clearTimeout(timer);
						}
						timers = undefined;
						receivedMessage.react("497430068331544577");
					}
				} else if(receivedMessage.content === ":startgame" && receivedMessage.member.roles.has(master.id)) {
					signup = false;
					votes = {};
					receivedMessage.channel.overwritePermissions(everyone, {SEND_MESSAGES: false, ADD_REACTIONS: false});
					receivedMessage.react("497430068331544577");
				} else if(receivedMessage.content === ":endgame" && receivedMessage.member.roles.has(master.id)) {
					signup = false;
					if(timers) {
						for(let timer of timers) {
							clearTimeout(timer);
						}
						timers = undefined;
					}
					let secret = receivedMessage.guild.channels.find("name", "mafia-secret-chat");
					let a = [];
					a.length = 2;
					for(let [, overwrites] of secret.permissionOverwrites) {
						if(overwrites.type === "member" && overwrites.id !== client.user.id) {
							overwrites.delete();
						}
					}
					for(let [, member] of mafiaPlayer.members) {
						member.removeRole(mafiaPlayer);
					}
					receivedMessage.channel.overwritePermissions(everyone, {SEND_MESSAGES: true, ADD_REACTIONS: true});
					receivedMessage.channel.overwritePermissions(mafiaPlayer, {SEND_MESSAGES: true, ADD_REACTIONS: true});
					receivedMessage.react("497430068331544577");
				} else if(receivedMessage.content === ":silence" && receivedMessage.member.roles.has(master.id)) {
					receivedMessage.channel.overwritePermissions(mafiaPlayer, {SEND_MESSAGES: false, ADD_REACTIONS: false});
					receivedMessage.react("497430068331544577");
				} else if(receivedMessage.content === ":nosilence" && receivedMessage.member.roles.has(master.id)) {
					receivedMessage.channel.overwritePermissions(mafiaPlayer, {SEND_MESSAGES: true, ADD_REACTIONS: true});
					receivedMessage.react("497430068331544577");
				} else if(receivedMessage.content === ":listlunch") {
					let foods = [
						"spaghetti",
						"rice",
						"burger",
						"macaroni",
						"chicken meat",
						"steak",
						"fish",
						"instant noodles",
						"chicken nuggets",
						"strawberry",
						"lemon pie",
						"chocolate",
						"mashed potatoes",
						"fries"
					];
					receivedMessage.reply(foods[Math.round(Math.random() * 7)] + "\n" + foods[Math.round(Math.random() * 7)] + "\n" + foods[Math.round(Math.random() * 7)]);
				} else if(receivedMessage.content.match(/^[lL]unch:/) && receivedMessage.member.roles.has(mafiaPlayer.id)) {
					receivedMessage.reply("Good lunch choice");
				}
			}
		} else if(receivedMessage.channel instanceof Discord.DMChannel) {
			if(client.guilds.find("id", "485666008128946179").member(receivedMessage.channel.recipient).roles.find("name", "Mafia Master")) {
				savedsetup = receivedMessage.content;
				receivedMessage.react("👍");
			}
		}
	}
});

client.login("NTAyOTc0NzIwNTQzNjg2NjU2.DqvvVA.KobwnmoBdeqwPbp8dEgx79bQ_uc");
