import Discord from "discord.js";
import {Player, Game} from "./game";
import {items} from "./item";
import {shuffle_array, State} from "./util";

/** if returning true, should cancel further callbacks to this state for this player */
export type RoleAction = (player: Player, game: Game) => void | boolean;
/** if returning true, should cancel further callbacks to this state for this player */
export type RoleActionReport = (target: Player, player: Player, game: Game) => void | boolean;
/** if returning true, should cancel further callbacks to this state for this player */
export type RoleActionReportMsg = (msg: Discord.Message, target: Player, player: Player, game: Game) => void | boolean;

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
	actions: {[state: number]: RoleAction} = {};

	/** override village and mafia wins, but not other third parties */
	override_sides_win?: boolean;
	/** for third parties, if returns true, this will cause a win to be checked, and post_win for more players */
	cause_win?: RoleAction;
	/** to win even without causing a win, or to cancel a win */
	ensure_win?: RoleAction;
}

export function role_name(player: Player): string {
	let role = player.role;
	return role.fake_name === undefined || role.fake_name === null || (role.death_reveal && player.dead)? role.name: role.fake_name;
}

function get_side(role: Role): Side {
	return role.fake_side === undefined || role.fake_side === null? role.side: role.fake_side;
}

/**
 * @param immediate request an answer now, cannot be hooked, will still cause pending, and can be either day or night
 * @param dont_wait this action will not have a cancel and will not be waited for; usually for optional secondary actions
 * @param yes_no this action will have a single check instead of targets
 */
function request_action(verb: string, report: RoleActionReport, cancel_report: RoleAction, player: Player, game: Game, dont_wait: boolean = false, immediate: boolean = false, yes_no: boolean = false, max_shots: number = -1) {
	player.data.collector = null;
	player.data.target = null;
	let numbers = "";
	for(let p of Object.values(game.players)) {
		if(p.number != player.number) {
			numbers += "\n" + p.number + "- " + (game.hiding_names? "<hidden>": p.name);
		}
	}
	let left = max_shots !== -1? max_shots - (player.data.shots_done || 0): null;
	player.member.send(
		(yes_no? "Select whether to " + verb + ".":
		(immediate? "Select a player to " + verb + ". Targets:":
		(dont_wait? "Optionally, before anything else, select a player to " + verb + " tonight. Targets:":
		"Select a player to " + verb + " tonight, or ❌ to do nothing. Targets:")) + numbers)
		+ (left !== null? ` You have ${left} use${left !== 1? "s": ""} of this action left.`: "")).then(msg => {
			if(yes_no) {
				msg.react("✅");
			} else {
				for(let p of Object.values(game.players)) {
					if(p.number != player.number) {
						msg.react(p.number + "\u20E3");
					}
				}
			}
			if(!dont_wait && (yes_no || !immediate)) msg.react("❌");
			let collector = msg.createReactionCollector();
			player.data.collector = collector;
			collector.on("collect", (reaction, user) => {
				if(!user.bot) {
					if(reaction.emoji.name === "❌" && (!dont_wait && (yes_no || !immediate))) {
        	            collector.stop();
						player.data.collector = null;
        	            msg.channel.send("Action cancelled.");
						player.data.target = null;
						player.action_pending = false;
						if(immediate) {
							player.action_report_pending = false;
							if(cancel_report) cancel_report(player, game);
						} else {
							player.action_report_pending = true;
						}
						game.update_night();
        	        } else if(yes_no && reaction.emoji.name === "✅") {
						collector.stop();
						player.data.collector = null;
						player.action_pending = false;
						msg.edit(msg.content + `\nYou chose to ${verb}.`);
						if(immediate) {
							player.action_report_pending = false;
							report(null, player, game);
							player.data.shots_done++;
							if(max_shots !== -1 && player.data.shots_done >= max_shots) {
								player.member.send("This was your last use of this action.");
							}
						} else {
							player.action_report_pending = true;
							player.data.target = null;
						}
						game.update_night();
					} else if(!yes_no && parseInt(reaction.emoji.name.substring(0, 1)) !== NaN) {
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
							msg.edit(msg.content + `\nYou chose to ${verb} ${p.name}.`);
							p.data.night_targeted_by = player;
							if(immediate) {
								if(!p.do_state(State.NIGHT_TARGETED, game)) {
									player.data.target = p;
									report(p, player, game);
								}
								player.data.shots_done++;
								if(max_shots !== -1 && player.data.shots_done >= max_shots) {
									player.member.send("This was your last use of this action.");
								}
								player.action_report_pending = false;
							} else {
								player.data.target = p;
								player.action_report_pending = true;
							}
							game.update_night();
						} else {
							player.member.send("Invalid target.");
						}
					}
				}
			});
	});
}

function request_action_targeted_mafia(verb: string, report: RoleActionReport, cancel_report: RoleAction | null, player: Player, game: Game, dont_wait: boolean, max_shots: number) {
	player.data.collector = null;
	player.data.target = null;
	let left = max_shots !== -1? max_shots - player.data.shots_done: null;
	game.mafia_secret_chat.send((dont_wait?
		"<@" + player.member.id + "> Optionally, before anything else, select a player to " + verb + " tonight with `;" + verb + " <number>`.":
		"<@" + player.member.id + "> Select a player to " + verb + " tonight with `;" + verb + " <number>`, or `;" + verb + "` to do nothing.")
		+ (left? ` You have ${left} use${left !== 1? "s": ""} of this action left.`: "")).then(msg => {
		let collector = game.mafia_secret_chat.createMessageCollector();
		player.data.collector = collector;
		collector.on("collect", action_msg => {
			if(!action_msg.member.user.bot && action_msg.member.id === player.member.id) {
				if(action_msg.content.match(new RegExp("^; *" + verb + "$", "i")) && !dont_wait) {
                    action_msg.reply("Action cancelled.");
                    collector.stop();
					player.data.collector = null;
					player.data.target = null;
					player.action_pending = false;
					player.action_report_pending = false;
					if(cancel_report) cancel_report(player, game);
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
							p.data.night_targeted_by = player;
							if(!p.do_state(State.NIGHT_TARGETED, game)) {
								player.data.target = p;
								report(p, player, game);
							}
							player.data.shots_done++;
							if(max_shots !== -1 && player.data.shots_done >= max_shots) {
								game.mafia_secret_chat.send(`<@${player.member.id}> This was your last use of this action.`);
							}
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
 * template for targeted actions
 * @param report callback to execute the action
 * @param hooked_report if hooked, calls this instead of report, or says "You were hooked." if this is true, or does nothing if null
 * @param cancel_report if the player cancelled the action, calls this instead of report
 * @param mafia this action will use commands in the mafia secret chat instead of reacts in DMs
 * @param dont_wait this action will not have a cancel and will not be waited for; usually for optional secondary actions
 * @param max_shots limit how many times the action can be done
 */
function template_targeted(verb: string, report: RoleActionReport, hooked_report?: RoleActionReport | boolean, cancel_report?: RoleAction, mafia: boolean = false, dont_wait: boolean = false, immediate: boolean = false, max_shots: number = -1): {[state: number]: RoleAction} {
	return {
		[State.NIGHT]: (player, game) => {
			if(!player.data.shots_done) player.data.shots_done = 0;
			if(max_shots !== -1 && player.data.shots_done >= max_shots) {
				return;
			}
			player.action_pending = !dont_wait;
			player.action_report_pending = dont_wait;
			if(mafia) {
				request_action_targeted_mafia(verb, report, cancel_report, player, game, dont_wait, max_shots);
			} else {
				request_action(verb, report, cancel_report, player, game, dont_wait, immediate, false, max_shots);
			}
		},
		[State.NIGHT_REPORT]: (player, game) => {
			if(!player.action_pending && player.action_report_pending) {
				player.action_report_pending = false;
				if(!player.data.target) {
					if(cancel_report) cancel_report(player, game);
				} else {
					if(player.hooked) {
						if(hooked_report === true) {
							if(mafia) {
								game.mafia_secret_chat.send(`<@${player.member.id}> You were hooked.`);
							} else {
								player.member.send("You were hooked.");
							}
						} else if(hooked_report) {
							hooked_report(player.data.target, player, game);
						}
					} else {
						player.data.target.data.night_targeted_by = player;
						if(!player.data.target.do_state(State.NIGHT_TARGETED, game)) {
							report(player.data.target, player, game);
						}
					}
					player.data.shots_done++;
					if(max_shots !== -1 && player.data.shots_done >= max_shots) {
						if(mafia) game.mafia_secret_chat.send(`<@${player.member.id}> This was your last use of this action.`);
						else player.member.send(`<@${player.member.id}> This was your last use of this action.`);
					}
				}
				game.update_night();
			}
		},
		[State.NIGHT_END]: (player, game) => {
			if(player.action_pending) {
				if(mafia) {
					if(!dont_wait) game.mafia_secret_chat.send(`<@${player.member.id}> The night is over. Action cancelled.`);
				} else {
					if(!dont_wait) player.member.send("The night is over. Action cancelled.");
				}
			}
			if(player.data.collector) {
				player.data.collector.stop("night end");
				player.data.collector = null;
			}
		}
	};
}

/**
 * template for yes/no actions
 * @param report callback to execute the action if confirmed
 * @param hooked_report if hooked, calls this instead of report, or says "You were hooked." if this is true, or does nothing if null
 * @param cancel_report if the player cancelled the action, calls this instead of report
 * @param dont_wait this action will not have a cancel and will not be waited for; usually for optional secondary actions
 * @param max_shots limit how many times the action can be done
 */
function template_yes_no(verb: string, report: RoleActionReport, hooked_report?: RoleActionReport | boolean, cancel_report?: RoleAction, dont_wait: boolean = false, immediate: boolean = false, max_shots: number = -1): {[state: number]: RoleAction} {
	return {
		[State.NIGHT]: (player, game) => {
			if(!player.data.shots_done) player.data.shots_done = 0;
			if(max_shots !== -1 && player.data.shots_done >= max_shots) {
				return;
			}
			player.action_pending = !dont_wait;
			player.action_report_pending = dont_wait;
			request_action(verb, report, cancel_report, player, game, dont_wait, immediate, true, max_shots);
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
						player.data.target.data.night_targeted_by = player;
						if(!player.data.target.do_state(State.NIGHT_TARGETED, game)) {
							report(player.data.target, player, game);
						}
					}
					player.data.shots_done++;
					if(max_shots !== -1 && player.data.shots_done >= max_shots) {
						player.member.send(`<@${player.member.id}> This was your last use of this action.`);
					}
				}
				game.update_night();
			}
		},
		[State.NIGHT_END]: (player, game) => {
			if(player.action_pending) {
				if(!dont_wait) player.member.send("The night is over. Action cancelled.");
			}
			if(player.data.collector) {
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
function template_report(report: RoleAction, hooked_report?: RoleAction | boolean): {[state: number]: RoleAction} {
	return {
		[State.NIGHT]: (player, game) => {
			player.action_report_pending = true;
		},
		[State.NIGHT_REPORT]: (player, game) => {
			if(player.action_report_pending) {
				if(player.hooked) {
					if(hooked_report === true) {
						player.member.send("You were hooked.");
					} else if(hooked_report) {
						hooked_report(player, game);
					}
				} else {
					report(player, game);
				}
				player.action_report_pending = false;
				game.update_night();
			}
		}
	};
}

function template_join(first: {[state: number]: RoleAction}, second: {[state: number]: RoleAction}) {
	for(let [i_, v] of Object.entries(second)) {
		let i = parseInt(i_);
		let o = first[i];
		if(o) {
			first[i] = (player, game) => {
				o(player, game);
				v(player, game);
			};
		} else {
			first[i] = v;
		}
	}
	return first;
}

export let roles: {[name: string]: Role} = {
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
		actions: template_targeted("investigate", (target, player, game) => {
			player.member.send(`${target.name} is sided with ${Side[get_side(target.role)]}.`);
		}, true)
	},
	MachoCop: {
		name: "MachoCop",
		help: "Every night, investigate a player to learn their side. You can't be protected, such as by docs.",
		side: Side.VILLAGE,
		macho: true,
		actions: template_targeted("investigate", (target, player, game) => {
			player.member.send(`${target.name} is sided with ${Side[get_side(target.role)]}.`);
		}, true)
	},
	ParanoidCop: {
		name: "ParanoidCop",
		fake_name: "Cop",
		help: "Every night, investigate a player to learn their side.",
		hidden_help: "Sees everyone as mafia.",
		side: Side.VILLAGE,
		actions: template_targeted("investigate", (target, player, game) => {
			player.member.send(`${target.name} is sided with ${Side[Side.MAFIA]}.`);
		}, true)
	},
	NaiveCop: {
		name: "NaiveCop",
		fake_name: "Cop",
		help: "Every night, investigate a player to learn their side.",
		hidden_help: "Sees everyone as village.",
		side: Side.VILLAGE,
		actions: template_targeted("investigate", (target, player, game) => {
			player.member.send(`${target.name} is sided with ${Side[Side.VILLAGE]}.`);
		}, true)
	},
	InsaneCop: {
		name: "InsaneCop",
		fake_name: "Cop",
		help: "Every night, investigate a player to learn their side.",
		hidden_help: "Gets inverted reports.",
		side: Side.VILLAGE,
		actions: template_targeted("investigate", (target, player, game) => {
			player.member.send(`${target.name} is sided with ${Side[get_side(target.role) === Side.MAFIA? Side.VILLAGE: Side.MAFIA]}.`);
		}, true)
	},
	TalentScout: {
		name: "TalentScout",
		help: "Every night, investigate a player to learn whether they have a talent.",
		side: Side.VILLAGE,
		actions: template_targeted("investigate", (target, player, game) => {
			player.member.send(`${target.name} ${target.role.powerless? "doesn't have": "has"} a talent.`);
		}, true)
	},
	Doc: {
		name: "Doc",
		help: "Every night, choose a player to prevent from dying that night.",
		side: Side.VILLAGE,
		actions: template_targeted("protect", (target, player, game) => {
			if(!target.role.macho) target.protected = true;
		})
	},
	MachoDoc: {
		name: "MachoDoc",
		help: "Every night, choose a player to prevent from dying that night. You can't be protected, such as by other docs.",
		side: Side.VILLAGE,
		macho: true,
		actions: template_targeted("protect", (target, player, game) => {
			if(!target.role.macho) target.protected = true;
		})
	},
	Bomb: {
		name: "Bomb",
		help: "If killed, not counting lynches, your attacker dies too.",
		side: Side.VILLAGE,
		can_overturn: true,
		actions: {[State.DEAD]: (player, game) => {
			if(player.killed_by instanceof Player && !player.killed_by.dead) {
				let killer = player.killed_by;
				game.kill(player.killed_by, player, () => {
					game.day_channel.send(`<@${killer.member.id}>, the ${role_name(killer)}, exploded.`);
				});
			}
		}}
	},
	Granny: {
		name: "Granny",
		help: "3 nights per game, choose whether to use your gun. If targeted by any action or kill that night, they die. This is reported together with the mafia kill in a random order. You can still die. ",
		side: Side.VILLAGE,
		can_overturn: true,
		unhookable: true,
		actions: template_join({[State.NIGHT]: (player: Player, game: Game) => {
			player.data.granny_kills = [];
		}, [State.NIGHT_TARGETED]: (player: Player, game: Game) => {
			if(player.data.night_targeted_by) {
				player.data.granny_kills.push([player.data.night_targeted_by, player]);
			}
		}, [State.NIGHT_END]: (player: Player, game: Game) => {
			if(player.data.granny_use_gun) {
				for(let k of player.data.granny_kills) {
					game.extra_kills.push(k);
				}
			}
		}, [State.DEAD]: (player: Player, game: Game) => {
			if(player.data.granny_use_gun && (game.cur_state === State.NIGHT || game.cur_state === State.NIGHT_END)) {
				game.extra_kills.push([player.data.night_targeted_by, player]);
			}
		}}, template_yes_no("use your gun tonight", (target, player, game) => {
			player.data.granny_use_gun = true;
		}, null, (player, game) => {
			player.data.granny_use_gun = false;
		}, false, true, 3))
	},
	Oracle: {
		name: "Oracle",
		help: "Every night, choose a player to prophesy about. When you die, the role of your last chosen will be revealed.",
		side: Side.VILLAGE,
		actions: Object.assign(template_targeted("prophesy about", (target, player, game) => {
			player.data.oracle_target = target;
		}, null, (player, game) => {
			player.data.oracle_target = null;
			player.member.send("No prophecy will be revealed today.")
		}), {[State.DEAD]: (player: Player, game: Game) => {
			if(player.data.oracle_target) {
				game.day_channel.send(`Oracle's prophecy: ${player.data.oracle_target.name} is a ${role_name(player.data.oracle_target)}.`);
			} else {
				game.day_channel.send(`Oracle's prophecy: none.`);
			}
		}})
	},
	Dreamer: {
		name: "Dreamer",
		help: "Every night, you receive a dream of either 1 innocent person, or 3 people, at least 1 of which is mafia-aligned.",
		side: Side.VILLAGE,
		actions: template_report((player, game) => {
			if(Math.random() < 0.5) {
				let vil: Player[] = Object.values(game.players).filter(x => get_side(x.role) === Side.VILLAGE && x.number !== player.number);
				player.member.send(vil[Math.floor(Math.random() * vil.length)]?.name + " is sided with the VILLAGE.");
			} else {
				let list: Player[] = shuffle_array(Object.values(game.players));
				let maf = list.find(x => get_side(x.role) === Side.MAFIA);
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
		actions: template_targeted("give a gun to", (target, player, game) => {
			target.receive(items.Gun);
		})
	},
	Deputy: {
		name: "Deputy",
		help: "You start with a single gun that won't reveal that you shot it.",
		side: Side.VILLAGE,
		actions: {[State.GAME]: (player, game) => {
			player.receive(items.DeputyGun);
		}}
	},
	Blacksmith: {
		name: "Blacksmith",
		help: "Every night, choose a player to give armor to. Each armor will absorb one attempt at their life.",
		side: Side.VILLAGE,
		can_overturn: true,
		actions: template_targeted("give armor to", (target, player, game) => {
			target.receive(items.Armor);
		})
	},
	Bulletproof: {
		name: "Bulletproof",
		help: "You start with a single armor that will absorb one attempt at your life.",
		side: Side.VILLAGE,
		actions: {[State.GAME]: (player, game) => {
			player.receive(items.Armor);
		}}
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
		actions: template_targeted("clean", (target, player, game) => {
			if(game.kill_pending) {
				game.kill_pending = false;
				game.killing = -1;
				game.mafia_killer = player;
				game.mafia_collector.stop("janitor cleaned");
				game.mafia_collector = null;
				game.kill(target, player, () => {
					game.day_channel.send(`<@${target.member.id}> is missing!`);
					game.mafia_secret_chat.send(`<@&${game.role_mafia_player.id}> While cleaning up the mess, you learned that ${target.name} is a ${role_name(target)}.`);
				});
			}
		}, null, null, true, true, false, 1)
	},
	Hooker: {
		name: "Hooker",
		help: "Every night, choose a village-aligned player, and their action will be prevented that night.",
		side: Side.MAFIA,
		actions: Object.assign(template_targeted("hook", (target, player, game) => {
			if(!target.role.unhookable) {
				target.hooked = true;
			}
			game.night_report_passed = true;
		}, null, (player, game) => {
//			game.mafia_secret_chat.send("[debug] hooker action registered");
			game.night_report_passed = true;
		}, true), {[State.PRE_NIGHT]: (player: Player, game: Game) => {
			game.night_report_passed = false;
		}})
	},
	Illusionist: {
		name: "Illusionist",
		help: "You start with one gun. Every night, choose a player, and if you shoot it at day, your last choice will be framed as the killer.",
		side: Side.MAFIA,
		actions: (() => {
			let actions = template_targeted("frame", (target, player, game) => {
				player.data.framing = target;
			}, null, null, true, false);
			let onight = actions[State.NIGHT];
			actions[State.GAME] = (player, game) => {
				player.receive(items.IllusionistGun);
			};
			actions[State.NIGHT] = (player, game) => { // only request the action if they still have the gun
				if(!!player.inventory.items.find(x => x.name === "IllusionistGun")) onight(player, game);
			};
			return actions;
		})()
	},
	Kirby: {
		name: "Kirby",
		help: "You deflect attacks and absorb the attacker's role if they die. If lynched, will absorb a random voter.",
		side: Side.THIRD,
		can_overturn: true,
		actions: {[State.DEAD]: (player, game) => {
			if(!player.killed_by) return;
			let target = Array.isArray(player.killed_by)?
				player.killed_by[Math.floor(Math.random() * player.killed_by.length)]:
				player.killed_by;
			player.dead = false;
			game.kill(target, player, () => {
				player.role = Object.assign({}, target.role);
				if(!player.role.fake_name) player.role.fake_name = player.role.name;
				player.role.name += " (Kirby)";
				if(player.role.side == Side.MAFIA) {
					game.mafia_secret_chat.send(`<@${player.member.id}> You ate ${target.name} and became their role.`);
				} else {
					player.member.send(`You ate ${target.name} and became their role.`);
				}
				game.day_channel.send(`${target.name} was eaten.`);
				player.do_state(State.GAME, game); // send them help and do whatever that role does when starting
			});
			return true;
		}}
	},
	Survivor: {
		name: "Survivor",
		help: "If you are alive when the game ends, you win.",
		side: Side.THIRD,
		actions: {},
		ensure_win: (player, game) => !player.dead
	},
	Angel: {
		name: "Angel",
		help: "You protect a random player. If they are killed, you will die in their place. If they are alive when the game ends, you win.",
		side: Side.THIRD,
		actions: {[State.GAME]: (player, game) => {
			let others = Object.values(game.players).filter(p => p.number !== player.number);
			player.data.angel_of = others[Math.floor(Math.random() * others.length)];
			player.data.angel_of.hook_action(State.DEAD, (angel_of: Player, game: Game) => {
				if(!player.dead) {
					angel_of.dead = false;
					game.kill(player, angel_of.killed_by, () => {
						player.member.send(`You sacrificed yourself to save ${angel_of.name}.`);
						game.day_channel.send(`${player.name} sacrificed themselves.`);
					});
					return true;
				}
			});
			player.member.send(`You are watching over ${player.data.angel_of.name}.`);
		}},
		ensure_win: (player, game) => player.data.angel_of && !player.data.angel_of.dead
	}
};