import {
	ApplicationCommand,
	Client,
	Guild,
	GuildMember,
	Message,
	User,
} from "discord.js";
import SWAGCommands from ".";

export interface ISWAGCommands {
	client: Client;
	commandsDir?: string;
	prefix?: string;
	mongoUri?: string;
	testServers?: string[];
	botOwners?: string[];
	cooldownConfig?: CooldownConfig;
	disabledDefaultCommands?: string[];
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

export interface ICallback {
	instance: SWAGCommands;
	message: Message;
	args: string[];
	text: string;
	guild: Guild;
	member: GuildMember;
	user: User;
	interaction: ApplicationCommand;
}
