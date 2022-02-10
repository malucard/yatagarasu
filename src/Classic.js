import {Game, Arg} from "./Game";

export class Classic extends Game {
	
	start() {
		this.day();
		this.add_command
	}

	day() {
		this.add_command("lynch", [Arg.User]);
		this.add_view("lynches", () => {
			
		});
		this.end_day();
	}

	end_day() {

	}

	night() {

	}

	end_night() {

	}
}

/*

server:
add_command


*/