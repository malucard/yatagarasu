export enum Arg {
	User
}

export class Game {
	commands: { [name: string]: [string[], () => void] };

	add_command(name: string, args: string[], run: () => void) {
		this.commands[name] = [args, run];
	}


}