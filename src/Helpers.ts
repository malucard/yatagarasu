import { Message } from "discord.js";
import { Player } from "./classes";
import { Side } from "./enum";

export function getSide(player: Player): Side {
    return (player.role.fakeSide == Side.VILLAGE || player.role.fakeSide == Side.MAFIA) ? player.role.fakeSide : player.role.side;
}

export function isSide(player: Player, side: Side) {
    return getSide(player) == side;
}

export function shuffleArray(array: any[]) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

export function countSides(players: Player[]) {
    let village = 0;
    let mafia = 0;
    let third = 0;
    for (let player of players) {
        if (player.role.side === Side.VILLAGE) {
            if (player.gun) {
                village += 2;
            } else {
                village++;
            }
        } else if (player.role.side === Side.MAFIA) {
            mafia++;
        } else if (player.role.side === Side.THIRD) {
            third++;
        }
    }
    return [village, mafia, third];
}

export function listLynch(players: Player[]) {
    let text = "";
    for (let player of players) {
        if (player.lynchVote === "nobody") {
            text += "\n" + player.name + " votes to lynch nobody";
        } else {
            for (let player2 of players) {
                if (player.lynchVote === player2.id) {
                    text += "\n" + player.name + " votes to lynch " + player2.name;
                    break;
                }
            }
        }
    }
    let lynch = calculateLynch(players);
    if (!lynch) {
        lynch = "nobody";
    } else {
        let found = false;
        for (let player of players) {
            if (lynch === player.id) {
                lynch = player.name;
                found = true;
            }
        }
        if (!found) {
            lynch = "(no user found <:Oumwha:498525028782964746>, ID " + lynch + " of type " + typeof (lynch) + ")"
        }
    }
    return text + "\n**The consensus is to lynch " + lynch + ".**";
}

export function calculateLynch(players: Player[]): string {
    let votes: { [id: string]: number } = {};
    for (let player of players) {
        if (player.lynchVote) {
            if (votes.hasOwnProperty(player.lynchVote)) {
                votes[player.lynchVote]++;
            } else {
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
        } else if (num === biggest) {
            lynch = "nobody";
        }
    }
    return lynch === "nobody" ? null : lynch;
}

export async function getCount(message: Message, mafiaId: string): Promise<number> {
    const mafiaPlayerLocal = await message.guild.roles.fetch(mafiaId);
    return mafiaPlayerLocal.members.toJSON().length;
}