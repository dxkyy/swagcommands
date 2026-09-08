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

export default class SWAG {
  private _client!: Client;
  private _defaultPrefix: string;
  private _testServers!: string[];
  private _botOwners!: string[];
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
  public get validations(): Validations;
  public get commandHandler(): CommandHandler;
  public get subcommandHandler(): SubcommandHandler;
  public get eventHandler(): EventHandler;
  public get isConnectedToDB(): boolean;
}

export interface Options {
  client: Client;
  commandsDir?: string;
  subcommandsDir?: string;
  featuresDir?: string;
  defaultPrefix?: string;
  testServers?: string[];
  botOwners?: string[];
  events?: Events;
  validations?: Validations;
}

export interface Events {
  dir: string;
  [key: string]: any;
}

export interface Validations {
  runtime?: string;
  syntax?: string;
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
}

export interface CommandObject {
  callback: (commandUsage: CommandUsage) => unknown;
  type: CommandType;
  init?: function;
  description?: string;
  aliases?: string[];
  testOnly?: boolean; // can be precondition
  guildOnly?: boolean; // can be precondition
  ownerOnly?: boolean; // can be precondition
  permissions?: bigint[]; // can be precondition
  deferReply?: "ephemeral" | boolean;
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
    commandObject: CommandObject,
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
  deferReply?: "ephemeral" | boolean;
  options?: ApplicationCommandOption[];
  autocomplete?: function;
  reply?: boolean;
}

export { CommandObject, Command, CommandType };
