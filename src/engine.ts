import ws = require("ws");

enum Arg {
	Player
}

interface Client {
	add_command(name: string): void;
}

class LocalClient implements Client {
	commands: { [name: string]: Arg[] } = {};

	add_command(name: string): void {
		this.commands[name] = [Arg.Player];
	}

	clear_command(name: string): void {
		this.commands = {};
	}

	send_packet(data: string) {
		data
	}
}

abstract class Server {
	abstract run_command(name: string, arg: number): void;
}

class WSServer {
	ws: ws.Server;

	constructor() {
		this.ws = new ws.Server({ port: 42066 });
		this.ws.on("connection", () => {

		});
	}


}