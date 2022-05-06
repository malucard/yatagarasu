import { Game, Player } from "./game";
import { role_name, RoleAction } from "./role";
import { State } from "./util";

export class Item {
	name: string;
	help: string;
	no_target?: boolean;
	night_use?: boolean;
	/** if can cause owner's side to win even if they are at a loss, such as with guns
		this changes the win condition for the mafia from "mafia >= village" to "village == 0" */
	can_overturn?: boolean;
	stays_after_use?: boolean;

	use?: (target: Player, player: Player, game: Game) => void;
	/** will be called before the role's own state callbacks, and may cancel them */
	hook_actions?: { [state: number]: RoleAction };
	/** will be called after the role's own state callbacks, and may be cancelled by them */
	post_actions?: { [state: number]: RoleAction };
}

export class Inventory {
	items: Item[] = [];

	add_item(it: Item) {
		this.items.push(it);
	}

	print(player: Player, game: Game): string {
		let res = "Inventory:";
		let map: { [id: string]: number } = {};
		for (let it of this.items) {
			if (map.hasOwnProperty(it.name)) {
				map[it.name]++;
			} else {
				map[it.name] = 1;
			}
		}
		for (let [id, count] of Object.entries(map)) {
			let it = items[id];
			res += `\n- ${id} x${count} `;
			if (it.use) {
				res += it.night_use ? "(use at night" : "(use at day";
				res += it.no_target ? ", does not require a target)" : ", requires a target)";
			} else {
				res += "(passive)";
			}
			res += `\n= ${it.help}`;
		}
		res += "\nUse an item by sending me `;use <item name> <target number>` at any time during the day or night depending on the item. Check your inventory at any time with `;inv`.";
		if (!player.already_sent_player_list) {
			player.already_sent_player_list = true;
			res += " Targets:";
			for (let p of Object.values(game.players)) {
				if (p.number != player.number) {
					res += `\n${p.number}- ${game.hiding_names ? "<hidden>" : p.name}`;
				}
			}
		}
		return res;
	}
};

export const items: { [name: string]: Item } = {
	Gun: {
		name: "Gun",
		help: "Kill a target. Has a 50% chance of revealing who fired it.",
		can_overturn: true,
		use: (target, player, game) => {
			player.member.send(`You chose to shoot ${target.name}.`);
			game.kill(target, player, () => {
				if (Math.random() < 0.5) {
					game.day_channel.send(`<@${target.member.id}>, the ${role_name(target)}, was shot by <@${player.member.id}>.`);
				} else {
					game.day_channel.send(`<@${target.member.id}>, the ${role_name(target)}, was shot.`);
				}
			});
		}
	},
	DeputyGun: {
		name: "DeputyGun",
		help: "Kill a target. Will not reveal who fired it.",
		can_overturn: true,
		use: (target, player, game) => {
			player.member.send(`You chose to shoot ${target.name}.`);
			game.kill(target, player, () => {
				game.day_channel.send(`<@${target.member.id}>, the ${role_name(target)}, was shot.`);
			});
		}
	},
	IllusionistGun: {
		name: "IllusionistGun",
		help: "Kill a target. Will reveal the killer as whoever you've last framed.",
		can_overturn: true,
		use: (target, player, game) => {
			player.member.send(`You chose to shoot ${target.name}.`);
			let framed = player.data.framing ? player.data.framing : player;
			game.kill(target, player, () => {
				game.day_channel.send(`<@${target.member.id}>, the ${role_name(target)}, was shot by <@${framed.member.id}>.`);
			});
		}
	},
	Syringe: {
		name: "Syringe",
		help: "Prevent a target from dying tonight.",
		night_use: true,
		use: (target, player, game) => {
			target.protected = true;
			player.member.send(`You chose to protect ${target.name}.`);
		}
	},
	Bread: {
		name: "Bread",
		help: "Nourish yourself.",
		no_target: true,
		use: (target, player, game) => {
			player.member.send(`You ate Bread.`);
		}
	},
	Money: {
		name: "Money",
		help: "Riches."
	},
	Armor: {
		name: "Armor",
		help: "Will absorb one attempt at your life and break.",
		hook_actions: {
			[State.DEAD]: player => {
				player.remove(items.Armor);
				player.dead = false;
				return true;
			}
		}
	}
}