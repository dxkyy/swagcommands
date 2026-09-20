import {
  ApplicationCommandOptionData,
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

export interface CooldownClaim {
  acquired: boolean;
  expiresAt: number;
}

export interface CooldownStore {
  claimCooldown(
    cooldownId: string,
    expiresAt: number,
    now: number,
  ): Awaitable<CooldownClaim>;
  deleteCooldown(cooldownId: string): Awaitable<void>;
  getCooldown(cooldownId: string): Awaitable<number | undefined>;
  setCooldown(cooldownId: string, expiresAt: number): Awaitable<void>;
}

export class MemoryCooldownStore implements CooldownStore {
  claimCooldown(
    cooldownId: string,
    expiresAt: number,
    now: number,
  ): CooldownClaim;
  deleteCooldown(cooldownId: string): void;
  getCooldown(cooldownId: string): number | undefined;
  setCooldown(cooldownId: string, expiresAt: number): void;
}

export enum CooldownScope {
  User = "user",
  Channel = "channel",
  Guild = "guild",
  Global = "global",
}

export interface CooldownPreconditionContext extends PreconditionContext {
  duration: number;
  id?: string;
  scope?: CooldownScope;
}

export function createCooldownId(
  command: PreconditionCommand,
  usage: MessageCommandUsage | ChatInputCommandUsage,
  scope?: CooldownScope,
  id?: string,
): string | undefined;

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
  private _cooldownStore: CooldownStore;

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
  public get cooldownStore(): CooldownStore;
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
  cooldownStore?: CooldownStore;
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
  public messageCommit?(
    usage: MessageCommandUsage,
    command: Command,
    context: PreconditionContext,
  ): Awaitable<PreconditionResult>;
  public chatInputCommit?(
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

export interface NamedPreconditionClass {
  readonly preconditionName: string;
}

declare const preconditionFactoryEntry: unique symbol;
export interface PreconditionFactoryEntry<Context extends PreconditionContext> {
  readonly name: string;
  readonly context: Context;
  readonly [preconditionFactoryEntry]: Context;
}

export function createPreconditionFactory<Context extends PreconditionContext>(
  precondition: string | NamedPreconditionClass,
): (context: Context) => PreconditionFactoryEntry<Context>;

export function preconditionOk(): PreconditionResult;
export function preconditionError(
  identifier: string,
  message?: string,
  context?: Readonly<Record<PropertyKey, unknown>>,
): PreconditionResult;

export class ArgumentCountPrecondition extends AllFlowsPrecondition {}
export class GuildOnlyPrecondition extends AllFlowsPrecondition {}
export class HasPermissionsPrecondition extends AllFlowsPrecondition {}
export class OwnerOnlyPrecondition extends AllFlowsPrecondition {}
export class TestOnlyPrecondition extends AllFlowsPrecondition {}
export class CooldownPrecondition extends AllFlowsPrecondition {}

export interface ArgumentCountContext extends PreconditionContext {
  expectedArgs?: string;
  maxArgs?: number;
  minArgs?: number;
}

export interface PermissionsContext extends PreconditionContext {
  permissions: readonly bigint[];
}

export const ArgumentCount: (
  context: ArgumentCountContext,
) => PreconditionFactoryEntry<ArgumentCountContext>;
export const HasPermissions: (
  context: PermissionsContext,
) => PreconditionFactoryEntry<PermissionsContext>;
export const Cooldown: (
  context: CooldownPreconditionContext,
) => PreconditionFactoryEntry<CooldownPreconditionContext>;

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
  Cooldown: CooldownPreconditionContext;
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
  | PreconditionSingleResolvableDetails
  | PreconditionFactoryEntry<PreconditionContext>
  | InlinePrecondition;

export type InlinePrecondition = (
  usage: MessageCommandUsage | ChatInputCommandUsage,
  command: PreconditionCommand,
) => Awaitable<boolean | PreconditionResult>;

export interface PreconditionAnyResolvable {
  any: PreconditionArrayResolvable;
}

export interface PreconditionAllResolvable {
  all: PreconditionArrayResolvable;
}

export type PreconditionEntryResolvable =
  | PreconditionSingleResolvable
  | PreconditionAnyResolvable
  | PreconditionAllResolvable;

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
  messageCheck(
    usage: MessageCommandUsage,
    command: Command,
    context?: PreconditionContext,
  ): Promise<PreconditionCheckResult>;
  chatInputCheck(
    usage: ChatInputCommandUsage,
    command: PreconditionCommand,
    context?: PreconditionContext,
  ): Promise<PreconditionCheckResult>;
}

export type PreconditionCommit = () => Promise<PreconditionResult>;
export type PreconditionCheckResult =
  | {
      readonly success: true;
      readonly commits: readonly PreconditionCommit[];
    }
  | PreconditionFailureResult;

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
  public messageCheck(
    usage: MessageCommandUsage,
    command: Command,
    context?: PreconditionContext,
  ): Promise<PreconditionCheckResult>;
  public chatInputCheck(
    usage: ChatInputCommandUsage,
    command: PreconditionCommand,
    context?: PreconditionContext,
  ): Promise<PreconditionCheckResult>;
}

export class PreconditionContainerArray implements PreconditionContainer {
  public readonly entries: readonly PreconditionContainer[];
  public readonly runCondition: PreconditionRunCondition;
  public constructor(
    store: PreconditionLookup,
    data?: PreconditionArrayResolvable,
    runCondition?: PreconditionRunCondition,
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
  public messageCheck(
    usage: MessageCommandUsage,
    command: Command,
    context?: PreconditionContext,
  ): Promise<PreconditionCheckResult>;
  public chatInputCheck(
    usage: ChatInputCommandUsage,
    command: PreconditionCommand,
    context?: PreconditionContext,
  ): Promise<PreconditionCheckResult>;
}

export interface CommandObject {
  callback: (commandUsage: CommandUsage) => Awaitable<CommandResponse | void>;
  type: CommandType;
  preconditions?: PreconditionArrayResolvable;
  init?: function;
  description?: string;
  aliases?: string[];
  testOnly?: boolean;
  guildOnly?: boolean;
  ownerOnly?: boolean;
  permissions?: readonly bigint[];
  deferReply?: DeferSetting;
  minArgs?: number;
  maxArgs?: number;
  correctSyntax?: string;
  expectedArgs?: string;
  options?: ApplicationCommandOptionData[];
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
  testOnly?: boolean;
  guildOnly?: boolean;
  ownerOnly?: boolean;
  permissions?: readonly bigint[];
  minArgs?: number;
  maxArgs?: number;
  expectedArgs?: string;
  delete?: boolean;
}

export interface SubcommandOptionObject {
  callback: (commandUsage: SubCommandUsage) => Awaitable<CommandResponse | void>;
  preconditions?: PreconditionArrayResolvable;
  init?: function;
  name: string;
  description?: string;
  testOnly?: boolean;
  guildOnly?: boolean;
  ownerOnly?: boolean;
  permissions?: readonly bigint[];
  minArgs?: number;
  maxArgs?: number;
  expectedArgs?: string;
  deferReply?: DeferSetting;
  options?: ApplicationCommandOptionData[];
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
