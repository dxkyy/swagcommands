import {
  ApplicationCommandOption,
  Client,
  CommandInteraction,
  Guild,
  Message,
  GuildMember,
  InteractionEditReplyOptions,
  InteractionReplyOptions,
  TextChannel,
  MessageCreateOptions,
  MessagePayload,
  MessageReplyOptions,
  User,
} from "discord.js";

import CommandType from "./src/util/CommandType";

type Awaitable<T> = T | Promise<T>;

export type LifecycleState =
  | "idle"
  | "initializing"
  | "ready"
  | "failed"
  | "destroyed";

export type ErrorPhase =
  | "initialization"
  | "validation"
  | "execution"
  | "response"
  | "autocomplete"
  | "event";

export type InvocationKind = "message" | "interaction" | "autocomplete";

export interface ErrorContext {
  commandName?: string;
  eventName?: string;
  filePath?: string;
  invocationKind?: InvocationKind;
  subcommandName?: string;
}

export interface SwagErrorOptions {
  cause?: unknown;
  code: string;
  context?: ErrorContext;
  phase: ErrorPhase;
}

export class SwagError extends Error {
  public readonly code: string;
  public readonly context: Readonly<ErrorContext>;
  public readonly phase: ErrorPhase;
  public constructor(message: string, options: SwagErrorOptions);
}

export class InitializationError extends SwagError {
  public constructor(cause: unknown, options?: { context?: ErrorContext });
}

export class ModuleLoadError extends SwagError {
  public constructor(cause: unknown, context?: ErrorContext);
}

export class CommandDefinitionError extends SwagError {
  public constructor(message: string, context?: ErrorContext);
}

export class CommandExecutionError extends SwagError {
  public constructor(cause: unknown, context?: ErrorContext);
}

export class InteractionResponseError extends SwagError {
  public constructor(cause: unknown, context?: ErrorContext);
}

export class InteractionAlreadyAcknowledgedError extends SwagError {
  public constructor(context?: ErrorContext);
}

export class MessageResponseError extends SwagError {
  public constructor(cause: unknown, context?: ErrorContext);
}

export interface DeferOptions {
  ephemeral?: boolean;
}

export type DeferSetting = boolean | DeferOptions;

export type InteractionResponse =
  | string
  | MessagePayload
  | InteractionReplyOptions
  | InteractionEditReplyOptions;

export type MessageResponse =
  | string
  | MessagePayload
  | MessageCreateOptions
  | MessageReplyOptions;

export type CommandResponse = InteractionResponse | MessageResponse;

export interface ErrorReporter {
  reportError(error: SwagError): Promise<void>;
}

export class ResponseHandler {
  public constructor(reporter: ErrorReporter);
  public defer(
    interaction: CommandInteraction,
    setting: DeferSetting,
    context?: ErrorContext,
  ): Promise<boolean>;
  public respondToInteraction(
    interaction: CommandInteraction,
    response: InteractionResponse,
    context?: ErrorContext,
  ): Promise<boolean>;
  public respondToMessage(
    message: Message,
    response: MessageResponse,
    reply: boolean,
    context?: ErrorContext,
  ): Promise<boolean>;
  public indicateTyping(
    message: Message,
    context?: ErrorContext,
  ): Promise<boolean>;
}

export interface PrefixStore {
  getPrefix(guildId: string): Awaitable<string | undefined>;
  setPrefix(guildId: string, prefix: string): Awaitable<void>;
}

export class MemoryPrefixStore implements PrefixStore {
  getPrefix(guildId: string): string | undefined;
  setPrefix(guildId: string, prefix: string): void;
}

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
  private _state: LifecycleState;

  private constructor(options: Options);

  public static create(options: Options): Promise<SWAG>;

  public get client(): Client;
  public get defaultPrefix(): string;
  public get testServers(): string[];
  public get botOwners(): string[];
  public get validations(): Validations;
  public get commandHandler(): CommandHandler;
  public get subcommandHandler(): SubcommandHandler;
  public get eventHandler(): EventHandler;
  public get isConnectedToDB(): boolean;
  public get prefixStore(): PrefixStore;
  public get state(): LifecycleState;
  public get responseHandler(): ResponseHandler;
  public isReady(): boolean;
  public reportError(error: SwagError): Promise<void>;
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
  prefixStore?: PrefixStore;
  onError?: (error: SwagError, context: ErrorContext) => Awaitable<void>;
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
  callback: (commandUsage: CommandUsage) => Awaitable<CommandResponse | void>;
  type: CommandType;
  init?: function;
  description?: string;
  aliases?: string[];
  testOnly?: boolean; // can be precondition
  guildOnly?: boolean; // can be precondition
  ownerOnly?: boolean; // can be precondition
  permissions?: bigint[]; // can be precondition
  deferReply?: DeferSetting;
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
  callback: (commandUsage: SubCommandUsage) => Awaitable<CommandResponse | void>;
  init?: function;
  name: string;
  description?: string;
  ownerOnly?: boolean;
  permissions?: bigint[];
  deferReply?: DeferSetting;
  options?: ApplicationCommandOption[];
  autocomplete?: function;
  reply?: boolean;
}

export { CommandObject, Command, CommandType };
