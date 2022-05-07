import Discord from "discord.js";
import { Player, Game } from "./game";
import { Item, items } from "./item";
import { shuffle_array, State } from "./util";

/** if returning true, should cancel further callbacks to this state for this player */
export type RoleAction = (player: Player) => void | boolean;
/** if returning true, should cancel further callbacks to this state for this player */
export type RoleActionReport = (target: Player, player: Player) => void | boolean;
/** if returning true, should cancel further callbacks to this state for this player */
export type RoleActionReportMsg = (msg: Discord.Message, target: Player, player: Player) => void | boolean;

export enum Side {
	NONE,
	VILLAGE,
	MAFIA,
	/** players that each have their own win condition */
	THIRD,
	TIE
}

export class Role {
	name: string;
	/** will be called this before the game ends, even to themselves */
	fake_name?: string;
	/** whether the real role should be revealed on death, and not just at the end of the game */
	death_reveal?: boolean;
	/** will be in a DM to the player at the start of the game, and in help commands */
	help: string;
	/** will be appended in help commands, but not in the DM to the player */
	hidden_help?: string;
	side: Side;
	/** what will appear to investigative roles */
	fake_side?: Side;
	/** only Blue and Vanilla */
	powerless?: boolean;
	/** if can cause a side to win even if they are at a loss, such as with guns
		this changes the win condition for the mafia from "mafia >= village" to "village == 0"
		the gun item also does this by itself, so this is false for deputy, who can lose their gun */
	can_overturn?: boolean;
	/** if can't be saved */
	macho?: boolean;
	/** if can't be hooked; will also cause its report to come earlier than for other roles */
	unhookable?: boolean;
	/** callbacks for states */
	actions: { [state: number]: RoleAction } = {};

	/** override village and mafia wins, but not other third parties */
	override_sides_win?: boolean;
	/** for third parties, if returns true, this will cause a win to be checked, and post_win for more players */
	cause_win?: RoleAction;
	/** to win even without causing a win, or to cancel a win */
	ensure_win?: RoleAction;
}

export function role_name(player: Player): string {
	const role = player.role;
	return role.fake_name === undefined || role.fake_name === null || (role.death_reveal && player.dead) ? role.name : role.fake_name;
}

function get_side(role: Role): Side {
	return role.fake_side === undefined || role.fake_side === null ? role.side : role.fake_side;
}

function action_follow_up(player: Player, mafia: boolean, to: Discord.Message | Discord.MessageReaction | null, content: string): Promise<Discord.Message> {
	if (mafia) {
		return to instanceof Discord.Message ? to.reply(content) :
			player.game.mafia_secret_chat.send(`<@${player.member.id}> ${content}`);
	} else {
		return to instanceof Discord.MessageReaction && to.message.editable ? to.message.edit(`${to.message.content}\n${content}`) :
			player.member.send(content);
	}
}

function request_action(verb: string, report: RoleActionReport, opt: ActionOptions, player: Player) {
	player.data.collector = null;
	player.data.target = null;
	const can_cancel = opt.immediate || opt.dont_wait;
	let msg_txt = opt.dont_wait ? "Optionally, before anything else, select " : "Select ";
	msg_txt += opt.yes_no ? `whether to ${verb} tonight.` :
		can_cancel ?
			opt.mafia ? `a player to ${verb} tonight with \`;${verb} <number>\`.` :
				`a player to ${verb} tonight.` :
			opt.mafia ? `a player to ${verb} tonight with \`;${verb} <number>\`, or just \`;${verb}\` to do nothing.` :
				`a player to ${verb} tonight, or ❌ to do nothing.`;
	if (opt.max_shots !== undefined) {
		const left = opt.max_shots - (player.data.shots_done || 0);
		msg_txt += ` You have ${left} use${left !== 1 ? "s" : ""} of this action left.`;
	}
	if (!opt.yes_no && !opt.mafia) { // night kill already has target list so don't duplicate it
		msg_txt += " Targets:";
		for (const p of Object.values(player.game.players)) {
			if (p.number !== player.number) {
				msg_txt += `\n${p.number}- ${player.game.hiding_names ? "<hidden>" : p.name}`;
			}
		}
	}
	action_follow_up(player, opt.mafia, null, msg_txt).then(req_msg => {
		let collector: Discord.ReactionCollector | Discord.MessageCollector;
		if (opt.mafia) {
			collector = req_msg.channel.createMessageCollector();
		} else {
			if (opt.yes_no) {
				req_msg.react("✅");
			} else {
				for (const p of Object.values(player.game.players)) {
					if (p.number !== player.number) req_msg.react(p.number + "\u20E3");
				}
			}
			if (can_cancel) req_msg.react("❌");
			collector = req_msg.createReactionCollector();
		}
		player.data.collector = collector;
		collector.on("collect", (recv: Discord.Message | Discord.MessageReaction, user?: Discord.User) => {
			let reaction, content;
			if (recv instanceof Discord.Message) {
				content = recv.content;
				user = recv.member.user;
			} else {
				reaction = recv.emoji.name;
			}
			if (user.id !== player.member.id) return;
			if (can_cancel && (reaction ? reaction === "❌" : content.match(new RegExp(`^; *${verb}$`)))) {
				collector.stop();
				player.data.collector = null;
				player.action_pending = false;
				action_follow_up(player, opt.mafia, recv, "Action cancelled.");
				player.data.target = null;
				if (opt.mafia || opt.immediate) {
					player.action_report_pending = false;
					if (opt.cancel_report) opt.cancel_report(player);
				} else {
					player.action_report_pending = true;
				}
				player.game.update_night();
			} else if (opt.yes_no && reaction === "✅") {
				collector.stop();
				player.data.collector = null;
				player.action_pending = false;
				player.data.shots_done++;
				const last_use_txt = opt.max_shots !== undefined && player.data.shots_done >= opt.max_shots ?
					" This was your last use of this action." : "";
				action_follow_up(player, opt.mafia, recv, `You chose to ${verb}.${last_use_txt}`);
				if (opt.immediate) {
					player.action_report_pending = false;
					report(null, player);
				} else {
					player.action_report_pending = true;
				}
				player.game.update_night();
			} else if (!opt.yes_no) {
				let targetNo: number;
				if (reaction) {
					targetNo = parseInt(reaction.substring(0, 1));
				} else {
					const match = content.match(new RegExp(`^; *${verb} +([0-9]+)$`, "i"));
					targetNo = match ? parseInt(match[1]) : NaN;
				}
				if (isNaN(targetNo) || !player.game.players[targetNo]) {
					action_follow_up(player, opt.mafia, recv, "Invalid target.");
				} else if (targetNo === player.number) {
					action_follow_up(player, opt.mafia, recv, `You can't ${verb} yourself.`);
				} else {
					const target = player.game.players[targetNo];
					collector.stop();
					player.data.collector = null;
					player.action_pending = false;
					player.data.shots_done++;
					const last_use_txt = opt.max_shots !== undefined && player.data.shots_done >= opt.max_shots ?
						" This was your last use of this action." : "";
					action_follow_up(player, opt.mafia, recv, `You chose to ${verb} ${target.name}.${last_use_txt}`);
					target.data.night_targeted_by = player;
					if (opt.mafia || opt.immediate) {
						if (!target.do_state(State.NIGHT_TARGETED)) {
							player.data.target = target;
							report(target, player);
						}
						player.action_report_pending = false;
					} else {
						player.data.target = target;
						player.action_report_pending = true;
					}
					player.game.update_night();
				}
			}
		});
	});
}

class ActionOptions {
	/** if hooked, calls this instead of report, or DMs "You were hooked." if this is true, or does nothing if null */
	hooked_report?: RoleActionReport | boolean;
	/** if the player cancelled the action, calls this instead of report */
	cancel_report?: RoleAction;
	/** use commands in the mafia secret chat instead of reacts in DMs */
	mafia?: boolean;
	/** don't have a cancel option and don't be waited for; usually for optional secondary actions */
	dont_wait?: boolean;
	/** want an answer before night reports come, cannot be hooked, will still cause pending */
	immediate?: boolean;
	/** this action will have a single check instead of a target list [incompatible with the mafia flag] */
	yes_no?: boolean;
	/** uses deplete every time the player confirms, after they're over, will not request the action at all */
	max_shots?: number;
}

/**
 * template for night actions
 * @param report callback to execute the action
 * @param opt additional optional flags
 */
function template_action(verb: string, report: RoleActionReport, opt: ActionOptions = {}): { [state: number]: RoleAction } {
	return {
		[State.NIGHT]: player => {
			if (!player.data.shots_done) player.data.shots_done = 0;
			if (opt.max_shots !== undefined && player.data.shots_done >= opt.max_shots) return;
			player.action_pending = !opt.dont_wait; // do not make them wait
			player.action_report_pending = opt.dont_wait; // we don't need NIGHT_REPORT if we're not waiting for it
			request_action(verb, report, opt, player);
		},
		[State.NIGHT_REPORT]: player => {
			if (!player.action_pending && player.action_report_pending) {
				player.action_report_pending = false;
				if (!player.data.target) {
					if (opt.cancel_report) opt.cancel_report(player);
				} else {
					if (player.hooked) {
						if (opt.hooked_report === true) {
							action_follow_up(player, opt.mafia, null, "You were hooked.");
						} else if (opt.hooked_report) {
							opt.hooked_report(player.data.target, player);
						}
					} else {
						player.data.target.data.night_targeted_by = player;
						if (!player.data.target.do_state(State.NIGHT_TARGETED)) {
							report(player.data.target, player);
						}
					}
				}
				player.game.update_night();
			}
		},
		[State.NIGHT_END]: player => {
			if (player.action_pending && !opt.dont_wait) {
				action_follow_up(player, opt.mafia, null, "The night is over. Action cancelled.");
			}
			if (player.data.collector) {
				player.data.collector.stop("night end");
				player.data.collector = null;
			}
		}
	};
}

/**
 * template for actions that happen automatically and only need a report
 * @param report callback to execute the action
 * @param hooked_report if hooked, calls this instead of report, or says "You were hooked." if this is true, or does nothing if null
 */
function template_report(report: RoleAction, hooked_report?: RoleAction | boolean): { [state: number]: RoleAction } {
	return {
		[State.NIGHT]: player => {
			player.action_report_pending = true;
		},
		[State.NIGHT_REPORT]: player => {
			if (player.action_report_pending) {
				if (player.hooked) {
					if (hooked_report === true) {
						player.member.send("You were hooked.");
					} else if (hooked_report) {
						hooked_report(player);
					}
				} else {
					report(player);
				}
				player.action_report_pending = false;
				player.game.update_night();
			}
		}
	};
}

/** joins two templates so that each callback goes to the one in the first, then unless canceled, the one in the second. */
function template_join(first: { [state: number]: RoleAction }, second: { [state: number]: RoleAction }) {
	for (const [i_, v] of Object.entries(second)) {
		const i = parseInt(i_);
		const o = first[i];
		if (o) {
			first[i] = player => o(player) ? true : v(player);
		} else {
			first[i] = v;
		}
	}
	return first;
}

export const roles: { [name: string]: Role } = {
	Blue: {
		name: "Blue",
		help: "No powers.",
		side: Side.VILLAGE,
		powerless: true,
		actions: {}
	},
	Suspect: {
		name: "Suspect",
		fake_name: "Blue",
		death_reveal: true,
		help: "No powers.",
		hidden_help: "You appear as mafia-aligned to investigative roles.",
		side: Side.VILLAGE,
		fake_side: Side.MAFIA,
		powerless: true,
		actions: {}
	},
	Cop: {
		name: "Cop",
		help: "Every night, investigate a player to learn their side.",
		side: Side.VILLAGE,
		actions: template_action("investigate", (target, player) => {
			player.member.send(`${target.name} is sided with ${Side[get_side(target.role)]}.`);
		}, { hooked_report: true })
	},
	MachoCop: {
		name: "MachoCop",
		help: "Every night, investigate a player to learn their side. You can't be protected, such as by docs.",
		side: Side.VILLAGE,
		macho: true,
		actions: template_action("investigate", (target, player) => {
			player.member.send(`${target.name} is sided with ${Side[get_side(target.role)]}.`);
		}, { hooked_report: true })
	},
	ParanoidCop: {
		name: "ParanoidCop",
		fake_name: "Cop",
		help: "Every night, investigate a player to learn their side.",
		hidden_help: "Sees everyone as mafia.",
		side: Side.VILLAGE,
		actions: template_action("investigate", (target, player) => {
			player.member.send(`${target.name} is sided with ${Side[Side.MAFIA]}.`);
		}, { hooked_report: true })
	},
	NaiveCop: {
		name: "NaiveCop",
		fake_name: "Cop",
		help: "Every night, investigate a player to learn their side.",
		hidden_help: "Sees everyone as village.",
		side: Side.VILLAGE,
		actions: template_action("investigate", (target, player) => {
			player.member.send(`${target.name} is sided with ${Side[Side.VILLAGE]}.`);
		}, { hooked_report: true })
	},
	InsaneCop: {
		name: "InsaneCop",
		fake_name: "Cop",
		help: "Every night, investigate a player to learn their side.",
		hidden_help: "Gets inverted reports.",
		side: Side.VILLAGE,
		actions: template_action("investigate", (target, player) => {
			player.member.send(`${target.name} is sided with ${Side[get_side(target.role) === Side.MAFIA ? Side.VILLAGE : Side.MAFIA]}.`);
		}, { hooked_report: true })
	},
	TalentScout: {
		name: "TalentScout",
		help: "Every night, investigate a player to learn whether they have a talent.",
		side: Side.VILLAGE,
		actions: template_action("investigate", (target, player) => {
			player.member.send(`${target.name} ${target.role.powerless ? "doesn't have" : "has"} a talent.`);
		}, { hooked_report: true })
	},
	Doc: {
		name: "Doc",
		help: "Every night, choose a player to prevent from dying that night.",
		side: Side.VILLAGE,
		actions: template_action("protect", (target, player) => {
			if (!target.role.macho) target.protected = true;
		})
	},
	MachoDoc: {
		name: "MachoDoc",
		help: "Every night, choose a player to prevent from dying that night. You can't be protected, such as by other docs.",
		side: Side.VILLAGE,
		macho: true,
		actions: template_action("protect", (target, player) => {
			if (!target.role.macho) target.protected = true;
		})
	},
	Bomb: {
		name: "Bomb",
		help: "If killed, not counting lynches, your attacker dies too.",
		side: Side.VILLAGE,
		can_overturn: true,
		actions: {
			[State.DEAD]: player => {
				if (player.killed_by instanceof Player && !player.killed_by.dead) {
					const killer = player.killed_by;
					player.game.kill(player.killed_by, player, () => {
						player.game.day_channel.send(`<@${killer.member.id}>, the ${role_name(killer)}, exploded.`);
					});
				}
			}
		},
	},
	Granny: {
		name: "Granny",
		help: "3 nights per game, choose whether to use your gun. If targeted by any action or kill that night, they die. This is reported together with the mafia kill in a random order. You can still die. ",
		side: Side.VILLAGE,
		can_overturn: true,
		unhookable: true,
		actions: template_join(
			{
				[State.NIGHT]: player => {
					player.data.granny_kills = [];
				}, [State.NIGHT_TARGETED]: player => {
					if (player.data.night_targeted_by) {
						player.data.granny_kills.push([player.data.night_targeted_by, player]);
					}
				}, [State.NIGHT_END]: player => {
					if (player.data.granny_use_gun) {
						for (const k of player.data.granny_kills) {
							player.game.extra_kills.push(k);
						}
					}
				}, [State.DEAD]: player => {
					if (player.data.granny_use_gun && (player.game.cur_state === State.NIGHT || player.game.cur_state === State.NIGHT_END)) {
						player.game.extra_kills.push([player.data.night_targeted_by, player]);
					}
				}
			},

			template_action("use your gun tonight", (target, player) => {
				player.data.granny_use_gun = true;
			}, {
				cancel_report: player => {
					player.data.granny_use_gun = false;
				}, immediate: true, yes_no: true, max_shots: 3
			})
		)
	},
	Oracle: {
		name: "Oracle",
		help: "Every night, choose a player to prophesy about. When you die, the role of your last chosen will be revealed.",
		side: Side.VILLAGE,
		actions: template_join(
			template_action("prophesy about", (target, player) => {
				player.data.oracle_target = target;
			}, {
				cancel_report: player => {
					player.data.oracle_target = null;
					player.member.send("No prophecy will be revealed today.");
				}
			}),

			{
				[State.DEAD]: player => {
					if (player.data.oracle_target) {
						player.game.day_channel.send(`Oracle's prophecy: ${player.data.oracle_target.name} is a ${role_name(player.data.oracle_target)}.`);
					} else {
						player.game.day_channel.send("Oracle's prophecy: none.");
					}
				}
			}
		)
	},
	Dreamer: {
		name: "Dreamer",
		help: "Every night, you receive a dream of either 1 innocent person, or 3 people, at least 1 of which is mafia-aligned.",
		side: Side.VILLAGE,
		actions: template_report(player => {
			if (Math.random() < 0.5) {
				const vil: Player[] = Object.values(player.game.players).filter(x => get_side(x.role) === Side.VILLAGE && x.number !== player.number);
				player.member.send(vil[Math.floor(Math.random() * vil.length)]?.name + " is sided with the VILLAGE.");
			} else {
				let list: Player[] = shuffle_array(Object.values(player.game.players));
				const maf = list.find(x => get_side(x.role) === Side.MAFIA);
				list = list.filter(x => x.number !== player.number && x.number !== maf.number).slice(0, 2);
				list.push(maf);
				player.member.send(shuffle_array(list.map(p => p.name)).join(", ") + ". At least one of them is sided with the MAFIA.");
			}
		}, true)
	},
	Gunsmith: {
		name: "Gunsmith",
		help: "Every night, choose a player to give a gun to.",
		side: Side.VILLAGE,
		can_overturn: true,
		actions: template_action("give a gun to", (target, player) => {
			target.receive(items.Gun);
		})
	},
	Deputy: {
		name: "Deputy",
		help: "You start with a single gun that won't reveal that you shot it.",
		side: Side.VILLAGE,
		actions: {
			[State.GAME]: (player: { receive: (arg0: Item) => void; }) => {
				player.receive(items.DeputyGun);
			}
		}
	},
	Blacksmith: {
		name: "Blacksmith",
		help: "Every night, choose a player to give armor to. Each armor will absorb one attempt at their life.",
		side: Side.VILLAGE,
		can_overturn: true,
		actions: template_action("give armor to", (target, player) => {
			target.receive(items.Armor);
		})
	},
	Bulletproof: {
		name: "Bulletproof",
		help: "You start with a single armor that will absorb one attempt at your life.",
		side: Side.VILLAGE,
		actions: {
			[State.GAME]: (player: { receive: (arg0: Item) => void; }) => {
				player.receive(items.Armor);
			}
		}
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
	Janitor: {
		name: "Janitor",
		help: "Once per game, choose a player to clean, and their role will only be revealed to the mafia. When used, this replaces the mafia's night kill.",
		side: Side.MAFIA,
		actions: template_action("clean", (target, player) => {
			if (player.game.kill_pending) {
				player.game.kill_pending = false;
				player.game.killing = -1;
				player.game.mafia_killer = player;
				player.game.mafia_collector.stop("janitor cleaned");
				player.game.mafia_collector = null;
				player.game.kill(target, player, () => {
					player.game.day_channel.send(`<@${target.member.id}> is missing!`);
					player.game.mafia_secret_chat.send(`<@&${player.game.role_mafia_player.id}> While cleaning up the mess, you learned that ${target.name} is a ${role_name(target)}.`);
				});
			}
		}, { mafia: true, dont_wait: true, max_shots: 1 })
	},
	Hooker: {
		name: "Hooker",
		help: "Every night, choose a village-aligned player, and their action will be prevented that night.",
		side: Side.MAFIA,
		actions: template_join(
			template_action("hook", (target, player) => {
				if (!target.role.unhookable) {
					target.hooked = true;
				}
				player.game.night_report_passed = true;
			}, {
				cancel_report: player => {
					player.game.night_report_passed = true;
				}, immediate: true
			}),

			{
				[State.PRE_NIGHT]: player => {
					player.game.night_report_passed = false;
				}
			}
		)
	},
	Illusionist: {
		name: "Illusionist",
		help: "You start with one gun. Every night, choose a player, and if you shoot it at day, your last choice will be framed as the killer.",
		side: Side.MAFIA,
		actions: template_join(
			{
				[State.GAME]: player => {
					player.receive(items.IllusionistGun);
				}, [State.NIGHT]: player => { // don't request the action if they don't have the gun
					if (!player.inventory.items.find(x => x.name === "IllusionistGun")) return true;
				}
			},

			template_action("frame", (target, player) => {
				player.data.framing = target;
			}, { mafia: true })
		)
	},
	Kirby: {
		name: "Kirby",
		help: "You deflect attacks and absorb the attacker's role if they die. If lynched, will absorb a random voter.",
		side: Side.THIRD,
		can_overturn: true,
		actions: {
			[State.DEAD]: (player: Player) => {
				if (!player.killed_by) return;
				const target = Array.isArray(player.killed_by) ?
					player.killed_by[Math.floor(Math.random() * player.killed_by.length)] :
					player.killed_by;
				player.dead = false;
				player.game.kill(target, player, () => {
					player.role = Object.assign({}, target.role);
					if (!player.role.fake_name) player.role.fake_name = player.role.name;
					player.role.name += " (Kirby)";
					if (player.role.side == Side.MAFIA) {
						player.game.mafia_secret_chat.send(`<@${player.member.id}> You ate ${target.name} and became their role.`);
					} else {
						player.member.send(`You ate ${target.name} and became their role.`);
					}
					player.game.day_channel.send(`${target.name} was eaten.`);
					player.do_state(State.GAME); // send them help and do whatever that role does when starting
				});
				return true;
			}
		}
	},
	Survivor: {
		name: "Survivor",
		help: "If you are alive when the game ends, you win.",
		side: Side.THIRD,
		actions: {},
		ensure_win: (player: Player) => !player.dead
	},
	Angel: {
		name: "Angel",
		help: "You protect a random player. If they are killed, you will die in their place. If they are alive when the game ends, you win.",
		side: Side.THIRD,
		actions: {
			[State.GAME]: (player: Player) => {
				const others = Object.values(player.game.players).filter(p => p.number !== player.number);
				player.data.angel_of = others[Math.floor(Math.random() * others.length)];
				player.data.angel_of.hook_action(State.DEAD, (angel_of: Player, game: Game) => {
					if (!player.dead) {
						angel_of.dead = false;
						game.kill(player, angel_of.killed_by, () => {
							player.member.send(`You sacrificed yourself to save ${angel_of.name}.`);
							game.day_channel.send(`${player.name} sacrificed themselves.`);
						});
						return true;
					}
				});
				player.member.send(`You are watching over ${player.data.angel_of.name}.`);
			}
		},
		ensure_win: (player: Player) => player.data.angel_of && !player.data.angel_of.dead
	}
};