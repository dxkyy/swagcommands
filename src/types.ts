import { Client } from "discord.js";

export interface ISWAGCommands {
	client: Client;
	commandsDir?: string;
	prefix?: string;
	mongoUri?: string;
	testServers?: string[];
	botOwners?: string[];
	cooldownConfig?: CooldownConfig;
}

export interface CooldownConfig {
	errorMessage?: string;
	botOwnersBypass: boolean;
	dbRequired: number;
}

export interface InternalCooldownConfig {
	cooldownType: "perUser" | "perUserPerGuild" | "perGuild" | "global";
	userId: string;
	actionId: string;
	guildId?: string;
	duration?: string;
	errorMessage?: string;
}
