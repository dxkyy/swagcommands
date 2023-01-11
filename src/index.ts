import CommandHandler from "./command-handler/CommandHandler";
import mongoose from "mongoose";
import { ISWAGCommands } from "./types";
import Cooldowns from "./util/Cooldowns";
import { Logger } from "./lib/structures/Logger";
export const logger = new Logger();

class SWAGCommands {
	_testServers;
	_botOwners;
	_cooldowns;
	_logger = logger;
	_commandHandler;
	constructor({
		client,
		commandsDir,
		prefix = "!",
		mongoUri,
		testServers = [],
		botOwners = [],
		cooldownConfig,
	}: ISWAGCommands) {
		if (!client) {
			throw new Error("A client is required.");
		}

		this._testServers = testServers;
		this._botOwners = botOwners;
		this._cooldowns = new Cooldowns((this as unknown) as SWAGCommands, {
			errorMessage: "Please wait {TIME} before doing that again.",
			botOwnersBypass: false,
			dbRequired: 300, // 5 minutes
			...cooldownConfig,
		});

		if (mongoUri) {
			this.connectToMongo(mongoUri);
		}

		if (commandsDir) {
			this._commandHandler = new CommandHandler(
				this,
				commandsDir,
				client,
				prefix
			);
		}
	}

	get testServers() {
		return this._testServers;
	}

	get logger() {
		return this._logger;
	}

	get botOwners() {
		return this._botOwners;
	}

	get cooldowns() {
		return this._cooldowns;
	}

	get commandHandler() {
		return this._commandHandler;
	}

	connectToMongo(mongoUri: string) {
		mongoose.connect(mongoUri, { keepAlive: true });
	}
}

export default SWAGCommands;
