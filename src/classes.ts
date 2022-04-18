import { Client, GuildMember } from "discord.js";
import { Side } from "./enum";

export class Player {
    name: string;
    id: string;
    number: number;
    role: Role;

    data: any;
    oracleVisit: string;
    frame: number;
    gun: boolean;
    actionDone: boolean;
    lynchVote: string;
    saved: boolean;
    hooked: boolean;
    cleaned: boolean;
    janitorCleaned: boolean;
}

export interface OtherParams {
    day?: number;
    players?: Player[];
    deadPlayers?: Player[];
    client?: Client;
    mafiaChannel?: string;
    hookDecided?: (() => void)[];
}

type RoleActionFn = (member: GuildMember, player: Player, other?: OtherParams) => void;

export class Role {
    name: string;
    realName?: string;
    side: Side;
    fakeSide?: Side = Side.NONE;
    vengeful?: boolean = false;
    macho?: boolean = false;
    beginGame: RoleActionFn;
    endGame: RoleActionFn;
    beginNight: RoleActionFn;
    endNight: RoleActionFn;
    die: RoleActionFn;
}

export class Setup {
    roles: (Role | Role[])[];
    nightless?: boolean = false;
    vengeful?: boolean = false;
    daystart?: boolean = false;
    daychat?: boolean = false;
    dontRecord?: boolean = false;
}