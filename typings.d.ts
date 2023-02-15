import {
	ApplicationCommandOption,
	Client,
	CommandInteraction,
	Guild,
	Message,
	GuildMember,
	TextChannel,
	User,
} from "discord.js";

import CommandType from "./src/util/CommandType";
import CooldownTypes from "./src/util/CooldownTypes";
import Cooldowns from "./src/util/Cooldowns";
import DefaultCommands from "./src/util/DefaultCommands";

export default class SWAG {
	private _client!: Client;
	private _defaultPrefix: string;
	private _testServers!: string[];
	private _botOwners!: string[];
	private _cooldowns: Cooldowns | undefined;
	private _disabledDefaultCommands!: DefaultCommands[];
	private _validations!: Validations;
	private _commandHandler: CommandHandler | undefined;
	private _subcommandHandler: SubcommandHandler | undefined;
	private _eventHandler!: EventHandler;
	private _isConnectedToDB = false;

	constructor(options: Options);

	public get client(): Client;
	public get defaultPrefix(): string;
	public get testServers(): string[];
	public get botOwners(): string[];
	public get cooldowns(): Cooldowns;
	public get disabledDefaultCommands(): DefaultCommands[];
	public get validations(): Validations;
	public get commandHandler(): CommandHandler;
	public get subcommandHandler(): SubcommandHandler;
	public get eventHandler(): EventHandler;
	public get isConnectedToDB(): boolean;
}

export interface Options {
	client: Client;
	mongoUri?: string;
	commandsDir?: string;
	subcommandsDir?: string;
	featuresDir?: string;
	defaultPrefix?: string;
	testServers?: string[];
	botOwners?: string[];
	cooldownConfig?: CooldownConfig;
	disabledDefaultCommands?: DefaultCommands[];
	events?: Events;
	validations?: Validations;
}

export interface CooldownConfig {
	errorMessage: string;
	botOwnersBypass: boolean;
	dbRequired: number;
}

export interface Events {
	dir: string;
	[key: string]: any;
}

export interface Validations {
	runtime?: string;
	syntax?: string;
}

export class Cooldowns {
	constructor(instance: SWAG, oldownConfig: CooldownConfig) {}
}

export interface CooldownUsage {
	errorMessage?: string;
	type: CooldownTypes;
	duration: string;
}

export interface InternalCooldownConfig {
	cooldownType: CooldownTypes;
	userId: string;
	actionId: string;
	guildId?: string;
	duration?: string;
	errorMessage?: string;
}

export interface CommandUsage {
	client: Client;
	instance: SWAG;
	message?: Message | null;
	interaction?: CommandInteraction | null;
	args: string[];
	text: string;
	guild?: Guild | null;
	member?: GuildMember;
	user: User;
	channel?: TextChannel;
	cancelCooldown?: function;
	updateCooldown?: function;
}

export interface SubCommandUsage {
	client: Client;
	instance: SWAG;
	interaction?: CommandInteraction;
	args: string[];
	text: string;
	guild?: Guild | null;
	member?: GuildMember;
	user: User;
	channel?: TextChannel;
	cancelCooldown?: function;
	updateCooldown?: function;
}

export interface CommandObject {
	callback: (commandUsage: CommandUsage) => unknown;
	type: CommandType;
	init?: function;
	description?: string;
	aliases?: string[];
	testOnly?: boolean;
	guildOnly?: boolean;
	ownerOnly?: boolean;
	permissions?: bigint[];
	deferReply?: "ephemeral" | boolean;
	cooldowns?: CooldownUsage;
	minArgs?: number;
	maxArgs?: number;
	correctSyntax?: string;
	expectedArgs?: string;
	options?: ApplicationCommandOption[];
	autocomplete?: function;
	reply?: boolean;
	delete?: boolean;
}

export type FileData = {
	filePath: string;
	fileContents: any;
};

export class Command {
	constructor(
		instance: SWAG,
		commandName: string,
		commandObject: CommandObject
	);

	public get instance(): SWAG;
	public get commandName(): string;
	public get commandObject(): CommandObject;
}

export interface SubcommandObject {
	description: string;
	testOnly?: boolean;
	guildOnly?: boolean;
	ownerOnly?: boolean;
	delete?: boolean;
}

export interface SubcommandOptionObject {
	callback: (commandUsage: SubCommandUsage) => unknown;
	init?: function;
	name: string;
	description?: string;
	ownerOnly?: boolean;
	permissions?: bigint[];
	cooldowns?: CooldownUsage;
	deferReply?: "ephemeral" | boolean;
	options?: ApplicationCommandOption[];
	autocomplete?: function;
	reply?: boolean;
}

export { CommandObject, Command, CommandType, CooldownTypes, DefaultCommands };
