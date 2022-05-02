import Discord from "discord.js";
import {Player, Game} from "./game";
import {items} from "./item";
import {State} from "./util";

export type RoleAction = (player: Player, game: Game) => void;
export type RoleActionReport = (target: Player, player: Player, game: Game) => void;
export type RoleActionReportMsg = (msg: Discord.Message, target: Player, player: Player, game: Game) => void;

export enum Side {
	VILLAGE,
	MAFIA,
	THE_JOKER
}

export class Role {
	name: string;
	help: string;
	side: Side;
	fake_side?: Side;
	powerless?: boolean = false;
	/// if can cause its side to win even if they are at a loss, such as with guns
	/// this changes the win condition for the mafia from "mafia >= village" to "village == 0"
	/// the gun item also does this by itself, so this is false for deputy, who can lose their gun
	can_overturn?: boolean = false;
	/// if can't be saved
	macho?: boolean = false;
	actions: {[state: number]: RoleAction} = {};
}

function get_side(role: Role): Side {
	return role.fake_side || role.side;
}

function request_action_targeted(verb: string, report: RoleActionReport, player: Player, game: Game) {
	player.data = {collector: null, target: null};
	let numbers = "";
	for(let p of Object.values(game.players)) {
		if(p.number != player.number) {
			numbers += "\n" + p.number + "- " + (game.hiding_numbers? "<hidden>": p.name);
		}
	}
	player.member.send("Select a player to " + verb + " tonight, or ❌ to do nothing. Targets:" + numbers).then(msg => {
		for(let p of Object.values(game.players)) {
			if(p.number != player.number) {
				msg.react(p.number + "\u20E3");
			}
		}
		msg.react("❌");
		let collector = msg.createReactionCollector();
		player.data.collector = collector;
		collector.on("collect", (reaction, user) => {
			if(!user.bot) {
				if(reaction.emoji.name === "❌") {
                    msg.channel.send("Action cancelled.");
                    collector.stop();
					player.data.collector = null;
					player.data.target = null;
					player.action_pending = false;
					player.action_report_pending = true;
					game.update_night();
                } else if(parseInt(reaction.emoji.name.substring(0, 1)) !== NaN) {
					let n = parseInt(reaction.emoji.name.substring(0, 1));
					if(n === player.number) {
						player.member.send("You can't " + verb + " yourself.");
						return;
					}
					let p = game.players[n];
					if(p) {
						collector.stop();
						player.data.collector = null;
						player.action_pending = false;
						player.action_report_pending = true;
						msg.edit(msg.content + `\nYou chose to ${verb} ${p.name}.`);
						player.data.target = p;
						game.update_night();
					} else {
						player.member.send("Invalid target.");
					}
				}
			}
		});
	});
}

/**
 * @param report callback to execute the action
 * @param hooked_report if hooked, calls this instead of report, or says "You were hooked." if this is true, or does nothing if null
 * @param cancel_report if the player cancelled the action, calls this instead of report
 */
function template_targeted(verb: string, report: RoleActionReport, hooked_report?: RoleActionReport | boolean, cancel_report?: RoleAction): {[state: number]: RoleAction} {
	return {
		[State.NIGHT]: (player, game) => {
			player.action_pending = true;
			player.action_report_pending = false;
			request_action_targeted(verb, report, player, game);
		},
		[State.NIGHT_REPORT]: (player, game) => {
			if(!player.action_pending && player.action_report_pending) {
				player.action_report_pending = false;
				if(!player.data.target) {
					if(cancel_report) cancel_report(player, game);
				} else {
					if(player.hooked) {
						if(hooked_report === true) {
							player.member.send("You were hooked.");
						} else if(hooked_report) {
							hooked_report(player.data.target, player, game);
						}
					} else {
						report(player.data.target, player, game);
					}
				}
				game.update_night();
			}
		},
		[State.NIGHT_END]: (player, game) => {
			if(player.action_pending) {
				player.member.send("The night is over. Action cancelled.");
				player.data.collector.stop("night end");
			}
			player.data = null;
		}
	}
}

function request_action_targeted_mafia(verb: string, report: RoleActionReport, cancel_report: RoleAction | null, player: Player, game: Game) {
	player.data = {collector: null, target: null};
	game.mafia_secret_chat.send("<@" + player.member.id + "> Select a player to " + verb + " tonight with `;" + verb + " <number>`, or `;" + verb + "` to do nothing.").then(msg => {
		let collector = game.mafia_secret_chat.createMessageCollector();
		player.data.collector = collector;
		collector.on("collect", action_msg => {
			if(!action_msg.member.user.bot && action_msg.member.id === player.member.id) {
				if(action_msg.content.match(new RegExp("^; *" + verb + "$", "i"))) {
                    action_msg.reply("Action cancelled.");
                    collector.stop();
					player.data.collector = null;
					player.data.target = null;
					player.action_pending = false;
					player.action_report_pending = false;
					if(cancel_report) {
						cancel_report(player, game);
					}
					game.update_night();
                } else {
					let m = action_msg.content.match(new RegExp("^; *" + verb + " +([0-9]+)$", "i"));
					if(m) {
						let n = parseInt(m[1]);
						let p = game.players[n];
						if(p) {
							collector.stop();
							player.data.collector = null;
							player.action_pending = false;
							player.action_report_pending = false;
							action_msg.reply(`You chose to ${verb} ${p.name}.`);
							report(p, player, game);
							player.data.target = p;
							game.update_night();
						} else {
							action_msg.reply("Invalid target.");
						}
					}
				}
			}
		});
	});
}

/**
 * @param report callback to execute the action
 * @param hooked_report if hooked, calls this instead of report, or says "You were hooked." if this is true, or does nothing if null
 * @param cancel_report if the player cancelled the action, calls this instead of report
 */
function template_targeted_mafia(verb: string, report: RoleActionReport, hooked_report?: RoleActionReport | boolean, cancel_report?: RoleAction): {[state: number]: RoleAction} {
	return {
		[State.NIGHT]: (player, game) => {
			player.action_pending = true;
			player.action_report_pending = false;
			request_action_targeted_mafia(verb, report, cancel_report, player, game);
		},
		[State.NIGHT_REPORT]: (player, game) => {
			if(!player.action_pending && player.action_report_pending) {
				player.action_report_pending = false;
				if(!player.data.target) {
					cancel_report(player, game);
				} else {
					if(player.hooked) {
						if(hooked_report === true) {
							game.mafia_secret_chat.send(`<@${player.member.id}> You were hooked.`);
						} else if(hooked_report) {
							hooked_report(player.data.target, player, game);
						}
					} else {
						report(player.data.target, player, game);
					}
				}
				game.update_night();
			}
		},
		[State.NIGHT_END]: (player, game) => {
			if(player.action_pending) {
				player.member.send("The night is over. Action cancelled.");
				player.data.collector.stop("night end");
			}
			player.data = null;
		}
	}
}

export let roles: {[name: string]: Role} = {
	Blue: {
		name: "Blue",
		help: "No powers.",
		side: Side.VILLAGE,
		powerless: true,
		actions: {}
	},
	Cop: {
		name: "Cop",
		help: "Every night, investigate a player to learn their role.",
		side: Side.VILLAGE,
		actions: template_targeted("investigate", (target, player, game) => {
			player.member.send(`${target.name} is ${Side[get_side(target.role)]}.`);
		}, true)
	},
	Gunsmith: {
		name: "Gunsmith",
		help: "Every night, choose a player to give a gun to.",
		side: Side.VILLAGE,
		can_overturn: true,
		actions: template_targeted("give a gun to", (target, player, game) => {
			target.receive(items.Gun);
		})
	},
	Deputy: {
		name: "Deputy",
		help: "You start with a single gun that won't reveal that you shot it.",
		side: Side.VILLAGE,
		actions: {}
	},
	Doc: {
		name: "Doc",
		help: "Every night, choose a player to prevent from dying that night.",
		side: Side.VILLAGE,
		actions: template_targeted("protect", (target, player, game) => {
			target.protected = true;
		})
	},
	Vanilla: {
		name: "Vanilla",
		help: "No powers.",
		side: Side.MAFIA,
		powerless: true,
		actions: {}
	},
	Godfather: {
		name: "Godfather",
		help: "You appear as village-aligned to investigative roles.",
		side: Side.MAFIA,
		fake_side: Side.VILLAGE,
		actions: {}
	},
	Hooker: {
		name: "Hooker",
		help: "Every night, choose a player to prevent their action from being done that night if they are village-aligned.",
		side: Side.MAFIA,
		actions: Object.assign(template_targeted_mafia("hook", (target, player, game) => {
			target.hooked = true;
			game.night_report_passed = true;
		}, null, (player, game) => {
			game.mafia_secret_chat.send("[debug] hooker action registered");
			game.night_report_passed = true;
		}), {[State.PRE_NIGHT]: (player: Player, game: Game) => {
			game.night_report_passed = false;
		}})
	}
};