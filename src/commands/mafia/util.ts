import { Player } from "./game";

export const death_messages = [
	"%pr's body was found in the river this morning.",
	"A waste collector found %pr's body in an alley dumpster this morning.",
	"%pr's body was found in a public toilet this morning.",
	"%pr's body was found in the site of a fire this morning.",
	"%pr's body was found under an old couch this morning.",
	"%pr was found sleeping peacefully this morning, but they never woke up.",
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
	"%pr's body was found wearing a fancy red suit and sunglasses this morning.",
];

/** points of the game where things happen automatically and roles and items have callbacks to run */
export enum State {
	GAME,
	GAME_END,
	DAY,
	DAY_END,
	PRE_NIGHT,
	NIGHT,
	NIGHT_REPORT,
	/** can return true to cancel the report for the targeted action */
	NIGHT_TARGETED,
	NIGHT_END,
	DEAD,
}

export function shuffle_array<T>(array: Array<T>) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array;
}

export function calculate_lynch(players: {
	[num: number]: Player;
}): [number, Player[]] {
	const votes: { [num: number]: Player[] } = {};
	for (const player of Object.values(players)) {
		if (
			player.lynch_vote === 0 ||
			(player.lynch_vote && player.game.players[player.lynch_vote])
		) {
			if (votes[player.lynch_vote]) {
				votes[player.lynch_vote].push(player);
			} else {
				votes[player.lynch_vote] = [player];
			}
		}
	}
	let lynch = 0;
	let biggest_voters: Player[] = [];
	let biggest = 0;
	for (const [id, voters] of Object.entries(votes)) {
		if (voters.length > biggest) {
			lynch = parseInt(id);
			biggest = voters.length;
			biggest_voters = voters;
		} else if (voters.length === biggest) {
			lynch = 0;
			biggest_voters = votes[0] || [];
		}
	}
	return [lynch, biggest_voters];
}

export function list_lynch(players: { [num: number]: Player }) {
	let text = "";
	for (const player of Object.values(players)) {
		if (player.lynch_vote === 0) {
			text += `\n${player.name} votes to lynch nobody`;
		} else if (!player.lynch_vote) {
			text += `\n*${player.name} has not voted*`;
		} else if (players[player.lynch_vote]) {
			text += `\n${player.name} votes to lynch ${
				players[player.lynch_vote].name
			}`;
		} else {
			text += `\n${player.name} votes to lynch <invalid>`;
		}
	}
	const [lynch] = calculate_lynch(players);
	if (lynch === 0) {
		return `${text}\n**The consensus is to lynch nobody.**`;
	} else {
		return `${text}\n**The consensus is to lynch ${players[lynch].name}.**`;
	}
}

export function everyone_prevent(txt: string): string {
	return txt.replace(/@(everyone|here)/g, ":/");
}
