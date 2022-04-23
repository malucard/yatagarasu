import { Client, GuildMember } from "discord.js";
import { Side } from "./enum";

export class Player {
    /**
     * Name of the player
     */
    name: string;
    /**
     * User id of the player
     */
    id: string;
    /**
     * Number of the player in the game
     */
    number: number;
    /**
     * Role assigned to the player
     */
    role: Role;

    /**
     * misc data of the player being stored as needed
     * Generally contains message and it's reaction collector
     */
    data: any;
    /**
     * Sets as being visited by the oracle
     */
    oracleVisit: string;
    /**
     * Set true if framed for a kill
     */
    frame: number;
    /**
     * Tracks if the player has a gun
     */
    gun: boolean;
    /**
     * Tracks if they have used their action for the night.
     */
    actionDone: boolean;
    /**
     * Id of the user they chose to lynch
     */
    lynchVote: string;
    /**
     * Sets the player as saved by a Doc-like
     */
    saved: boolean;
    /**
     * Sets the player as hooked by a Hooker-like
     */
    hooked: boolean;
    /**
     * Sets the player as cleaned and will not show their role on death.
     */
    cleaned: boolean;
    /**
     * Used by Janitor to track if they have used clean
     */
    janitorCleaned: boolean;
}

/**
 * Other Parameters for the `RoleActionFn` callbacks.
 */
export interface OtherParams {
    /**
     * Current day of the game
     */
    day?: number;
    /**
     * List of players in the game
     */
    players?: Player[];
    /**
     * List of dead players in the game
     */
    deadPlayers?: Player[];
    /**
     * Discord client for sending the messages
     */
    client?: Client;
    /**
     * Channel id of the main mafia channel
     */
    mafiaChannel?: string;
    /**
     * Array of callbacks of hooker actions
     */
    hookDecided?: (() => void)[];
}
/**
 * Callback Syntax for role actions
 * @param member - Discord.GuildMember object of the player
 * @param player - Player object of the player with this role
 * @param other - Misc data needed by the callback, see `OtherParams` interface.
 */
export type RoleActionFn = (member: GuildMember, player: Player, other?: OtherParams) => void;

/**
 * Describes a Role in the mafia game.
 */
export class Role {
    /**
     * Name of the role, shown to the players and other roles.
     */
    name: string;
    /**
     * The real name of the role, which may be different and may only
     * be shown to the player with it.
     */
    realName?: string;
    /**
     * The side this role aligns with, actually.
     */
    side: Side;
    /**
     * The side the role appears to align with to other roles.
     */
    fakeSide?: Side = Side.NONE;
    /**
     * If the role is vengeful, needs game to be vengeful to be useful.
     * A vengeful role is allowed to kill one player in retaliation on
     * being killed.
     */
    vengeful?: boolean = false;
    /**
     * If true, cannot be saved by a Doc or doc-like role.
     */
    macho?: boolean = false;
    /**
     * Callback called at the start of the game
     */
    beginGame: RoleActionFn;
    /**
     * Callback called at the end of the game
     */
    endGame: RoleActionFn;
    /**
     * Callback called at the start of a night
     */
    beginNight: RoleActionFn;
    /**
     * Callback called at the end of a night
     */
    endNight: RoleActionFn;
    /**
     * Callback called when the player
     */
    die: RoleActionFn;
}

/**
 * Describes a mafia game setup
 */
export class Setup {
    /**
     * Array of roles present per game, each element can be a Role or Role[]
     * from which the player will be assigned one randomly.
     */
    roles: (Role | Role[])[];
    /**
     * In a nightless game, the mafia side does not get a turn, and must win
     * without using kills or hooks.
     */
    nightless?: boolean = false;
    /**
     * In a vengeful game, vengeful roles are allowed to kill someone
     * when they are killed in revenge.
     */
    vengeful?: boolean = false;
    /**
     * By default games start on Night 1, this changes them to start on Day 1.
     */
    daystart?: boolean = false;
    /**
     * If true, allows mafia to chat in the secret chat during the day as
     * well (provided not nightless).
     */
    daychat?: boolean = false;
    /**
     * If true, this game will not be recorded in the database.
     */
    dontRecord?: boolean = false;
}