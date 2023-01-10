import { Client } from "discord.js";

export interface ISWAGCommands {
	client: Client;
	commandsDir?: string;
	prefix?: string;
	mongoUri?: string;
	testServers?: string[];
	botOwners?: string[];
}
