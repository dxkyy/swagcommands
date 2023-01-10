import CommandHandler from "./command-handler/CommandHandler";
import mongoose from "mongoose";
import { ISWAGCommands } from "./types";

class SWAGCommands {
	_testServers;
	_botOwners;
	constructor({
		client,
		commandsDir,
		prefix = "!",
		mongoUri,
		testServers = [],
		botOwners = [],
	}: ISWAGCommands) {
		if (!client) {
			throw new Error("A client is required.");
		}

		this._testServers = testServers;
		this._botOwners = botOwners;

		if (mongoUri) {
			this.connectToMongo(mongoUri);
		}

		if (commandsDir) {
			new CommandHandler(this, commandsDir, client, prefix);
		}
	}

	get testServers() {
		return this._testServers;
	}

	get botOwners() {
		return this._botOwners;
	}

	connectToMongo(mongoUri: string) {
		mongoose.connect(mongoUri, { keepAlive: true });
	}
}

export default SWAGCommands;
