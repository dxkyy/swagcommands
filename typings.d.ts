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
  preconditionName?: string;
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

export class AutocompleteError extends SwagError {
  public constructor(cause: unknown, context?: ErrorContext);
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

export class PreconditionExecutionError extends SwagError {
  public constructor(
    cause: unknown,
    preconditionName: string,
    context?: ErrorContext,
  );
}

export class EventExecutionError extends SwagError {
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

export type PreconditionContext = Readonly<Record<PropertyKey, unknown>>;

export interface PreconditionFailureOptions {
  identifier: string;
  message?: string;
  context?: Readonly<Record<PropertyKey, unknown>>;
}

export interface PreconditionFailure extends PreconditionFailureOptions {
  preconditionName: string;
}

export interface PreconditionSuccessResult {
  readonly success: true;
}

export interface PreconditionFailureResult {
  readonly success: false;
  readonly failure: Readonly<PreconditionFailure>;
}

export type PreconditionResult =
  | PreconditionSuccessResult
  | PreconditionFailureResult;

export interface PreconditionFailureEvent {
  command: PreconditionCommand;
  failure: Readonly<PreconditionFailure>;
  usage: MessageCommandUsage | ChatInputCommandUsage;
}

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
  private _preconditions: PreconditionStore;

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
  public get preconditions(): PreconditionStore;
  public get state(): LifecycleState;
  public get responseHandler(): ResponseHandler;
  public isReady(): boolean;
  public reportError(error: SwagError): Promise<void>;
  public handlePreconditionFailure(
    event: PreconditionFailureEvent,
  ): Promise<CommandResponse | void>;
}

export interface Options {
  client: Client;
  commandsDir?: string;
  preconditionsDir?: string;
  subcommandsDir?: string;
  featuresDir?: string;
  defaultPrefix?: string;
  testServers?: string[];
  botOwners?: string[];
  events?: Events;
  validations?: Validations;
  prefixStore?: PrefixStore;
  onError?: (error: SwagError, context: ErrorContext) => Awaitable<void>;
  onPreconditionFailure?: (
    event: PreconditionFailureEvent,
  ) => Awaitable<CommandResponse | void>;
}

export interface Events {
  dir: string;
  [key: string]: any;
}

export interface Validations {
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

export type MessageCommandUsage = CommandUsage & {
  interaction?: null;
  message: Message;
};

export type ChatInputCommandUsage =
  | (CommandUsage & {
      interaction: CommandInteraction;
      message?: null;
    })
  | (SubCommandUsage & {
      interaction: CommandInteraction;
    });

export type PreconditionCommand = Command | Subcommand | SubcommandOption;

export class Precondition {
  public readonly instance: SWAG;
  public readonly name: string;
  public constructor(instance: SWAG, name: string);
  public messageRun?(
    usage: MessageCommandUsage,
    command: Command,
    context: PreconditionContext,
  ): Awaitable<PreconditionResult>;
  public chatInputRun?(
    usage: ChatInputCommandUsage,
    command: PreconditionCommand,
    context: PreconditionContext,
  ): Awaitable<PreconditionResult>;
  public ok(): PreconditionResult;
  public error(options: PreconditionFailureOptions): PreconditionResult;
}

export abstract class AllFlowsPrecondition extends Precondition {
  public abstract messageRun(
    usage: MessageCommandUsage,
    command: Command,
    context: PreconditionContext,
  ): Awaitable<PreconditionResult>;
  public abstract chatInputRun(
    usage: ChatInputCommandUsage,
    command: PreconditionCommand,
    context: PreconditionContext,
  ): Awaitable<PreconditionResult>;
}

export class ArgumentCountPrecondition extends AllFlowsPrecondition {}
export class GuildOnlyPrecondition extends AllFlowsPrecondition {}
export class HasPermissionsPrecondition extends AllFlowsPrecondition {}
export class OwnerOnlyPrecondition extends AllFlowsPrecondition {}
export class TestOnlyPrecondition extends AllFlowsPrecondition {}

export interface PreconditionLookup {
  get(name: string): Precondition | undefined;
}

export class PreconditionStore
  implements PreconditionLookup, Iterable<[string, Precondition]>
{
  public get size(): number;
  public register(precondition: Precondition): this;
  public get(name: string): Precondition | undefined;
  public has(name: string): boolean;
  public delete(name: string): boolean;
  public clear(): void;
  public values(): IterableIterator<Precondition>;
  public [Symbol.iterator](): IterableIterator<[string, Precondition]>;
}

export class PreconditionHandler {
  public constructor(
    instance: SWAG,
    preconditionsDir: string,
    store: PreconditionStore,
  );
  public load(): Promise<void>;
}

export interface Preconditions {
  ArgumentCount: {
    expectedArgs?: string;
    maxArgs?: number;
    minArgs?: number;
  };
  GuildOnly: never;
  HasPermissions: {
    permissions: readonly bigint[];
  };
  OwnerOnly: never;
  TestOnly: never;
}

export type PreconditionKeys = keyof Preconditions & string;

export type SimplePreconditionKeys = {
  [Key in PreconditionKeys]: Preconditions[Key] extends never ? Key : never;
}[PreconditionKeys];

export type PreconditionSingleResolvableDetails = {
  [Key in PreconditionKeys]: Preconditions[Key] extends never
    ? { name: Key; context?: never }
    : { name: Key; context: Readonly<Preconditions[Key]> };
}[PreconditionKeys];

export type PreconditionSingleResolvable =
  | SimplePreconditionKeys
  | PreconditionSingleResolvableDetails;

export type PreconditionEntryResolvable =
  | PreconditionSingleResolvable
  | readonly PreconditionEntryResolvable[];

export type PreconditionArrayResolvable = readonly PreconditionEntryResolvable[];

export interface PreconditionContainer {
  messageRun(
    usage: MessageCommandUsage,
    command: Command,
    context?: PreconditionContext,
  ): Promise<PreconditionResult>;
  chatInputRun(
    usage: ChatInputCommandUsage,
    command: PreconditionCommand,
    context?: PreconditionContext,
  ): Promise<PreconditionResult>;
}

export enum PreconditionRunCondition {
  And = "and",
  Or = "or",
}

export class PreconditionContainerSingle implements PreconditionContainer {
  public readonly context: PreconditionContext;
  public readonly name: string;
  public constructor(
    store: PreconditionLookup,
    data: PreconditionSingleResolvable,
  );
  public messageRun(
    usage: MessageCommandUsage,
    command: Command,
    context?: PreconditionContext,
  ): Promise<PreconditionResult>;
  public chatInputRun(
    usage: ChatInputCommandUsage,
    command: PreconditionCommand,
    context?: PreconditionContext,
  ): Promise<PreconditionResult>;
}

export class PreconditionContainerArray implements PreconditionContainer {
  public readonly entries: readonly PreconditionContainer[];
  public readonly runCondition: PreconditionRunCondition;
  public constructor(
    store: PreconditionLookup,
    data?: PreconditionArrayResolvable,
    parent?: PreconditionContainerArray | null,
  );
  public messageRun(
    usage: MessageCommandUsage,
    command: Command,
    context?: PreconditionContext,
  ): Promise<PreconditionResult>;
  public chatInputRun(
    usage: ChatInputCommandUsage,
    command: PreconditionCommand,
    context?: PreconditionContext,
  ): Promise<PreconditionResult>;
}

export interface CommandObject {
  callback: (commandUsage: CommandUsage) => Awaitable<CommandResponse | void>;
  type: CommandType;
  preconditions?: PreconditionArrayResolvable;
  init?: function;
  description?: string;
  aliases?: string[];
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
    preconditions: PreconditionContainerArray,
  );

  public get instance(): SWAG;
  public get commandName(): string;
  public get commandObject(): CommandObject;
  public get preconditions(): PreconditionContainerArray;
}

export interface SubcommandObject {
  description: string;
  preconditions?: PreconditionArrayResolvable;
  delete?: boolean;
}

export interface SubcommandOptionObject {
  callback: (commandUsage: SubCommandUsage) => Awaitable<CommandResponse | void>;
  preconditions?: PreconditionArrayResolvable;
  init?: function;
  name: string;
  description?: string;
  deferReply?: DeferSetting;
  options?: ApplicationCommandOption[];
  autocomplete?: function;
  reply?: boolean;
}

export class SubcommandOption {
  public get instance(): SWAG;
  public get commandName(): string;
  public get optionObject(): SubcommandOptionObject;
  public get parent(): Subcommand;
  public get preconditions(): PreconditionContainerArray;
}

export class Subcommand {
  public get instance(): SWAG;
  public get commandName(): string;
  public get commandObject(): SubcommandObject;
  public get options(): SubcommandOption[];
  public get preconditions(): PreconditionContainerArray;
}

export { CommandObject, Command, CommandType };
