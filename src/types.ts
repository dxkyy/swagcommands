import type {
  ApplicationCommandOptionData,
  ApplicationCommandType,
  Client,
  CommandInteraction,
  Guild,
  GuildMember,
  Message,
  MessageContextMenuCommandInteraction,
  TextChannel,
  User,
  UserContextMenuCommandInteraction,
} from "discord.js";

import type SWAGCommands from "./SWAG";
import type CommandType from "./util/CommandType";
import type { SwagError, ErrorContext } from "./errors/SwagError";
import type { PrefixStore } from "./prefixes/PrefixStore";
import type { CooldownStore } from "./cooldowns/CooldownStore";
import type { CommandResponse, DeferSetting, InteractionResponse } from "./execution/ResponseHandler";
import type { PreconditionContext, PreconditionCommand } from "./preconditions/Precondition";
import type { PreconditionResult, PreconditionFailure } from "./preconditions/PreconditionResult";
import type { Preconditions } from "./index";

export type { CommandResponse, DeferSetting } from "./execution/ResponseHandler";

export type Awaitable<T> = T | Promise<T>;

export interface PreconditionFailureEvent {
  command: PreconditionCommand;
  failure: Readonly<PreconditionFailure>;
  usage:
    | MessageCommandUsage
    | ChatInputCommandUsage
    | ContextMenuCommandUsage;
}

export interface Options {
  client: Client;
  commandsDir?: string;
  contextMenusDir?: string;
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
  instance: SWAGCommands;
  message?: Message | null;
  interaction?: CommandInteraction | null;
  args: string[];
  text: string;
  guild?: Guild | null;
  member?: GuildMember;
  user: User;
  channel?: TextChannel;
}

export interface SubcommandUsageBase {
  client: Client;
  instance: SWAGCommands;
  args: string[];
  text: string;
  guild?: Guild | null;
  member?: GuildMember;
  user: User;
  channel?: TextChannel;
  commandName: string;
  subcommandGroup?: string;
  subcommandName: string;
}

export type MessageSubcommandUsage = SubcommandUsageBase & {
  interaction?: null;
  message: Message;
};

export type ChatInputSubcommandUsage = SubcommandUsageBase & {
  interaction: CommandInteraction;
  message?: null;
};

export type SubcommandUsage =
  | MessageSubcommandUsage
  | ChatInputSubcommandUsage;

export type MessageCommandUsage =
  | (CommandUsage & {
      interaction?: null;
      message: Message;
    })
  | MessageSubcommandUsage;

export type ChatInputCommandUsage =
  | (CommandUsage & {
      interaction: CommandInteraction;
      message?: null;
    })
  | ChatInputSubcommandUsage;

export interface ContextMenuCommandUsageBase {
  args: string[];
  channel?: TextChannel;
  client: Client;
  guild?: Guild | null;
  instance: SWAGCommands;
  member?: GuildMember;
  message?: null;
  text: string;
  user: User;
}

export interface UserContextMenuCommandUsage
  extends ContextMenuCommandUsageBase {
  interaction: UserContextMenuCommandInteraction;
  targetMember: UserContextMenuCommandInteraction["targetMember"];
  targetUser: User;
}

export interface MessageContextMenuCommandUsage
  extends ContextMenuCommandUsageBase {
  interaction: MessageContextMenuCommandInteraction;
  targetMessage: Message;
}

export type ContextMenuCommandUsage =
  | UserContextMenuCommandUsage
  | MessageContextMenuCommandUsage;


declare const preconditionFactoryEntry: unique symbol;
export interface PreconditionFactoryEntry<Context extends PreconditionContext> {
  readonly name: string;
  readonly context: Context;
  readonly [preconditionFactoryEntry]: Context;
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
  usage:
    | MessageCommandUsage
    | ChatInputCommandUsage
    | ContextMenuCommandUsage,
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

export interface CommandDefinitionBase {
  preconditions?: PreconditionArrayResolvable;
  init?: (client: Client, instance: SWAGCommands) => Awaitable<void>;
  testOnly?: boolean;
  guildOnly?: boolean;
  ownerOnly?: boolean;
  permissions?: readonly bigint[];
  deferReply?: DeferSetting;
  minArgs?: number;
  maxArgs?: number;
  correctSyntax?: string;
  expectedArgs?: string;
}

export interface MessageCommandCapabilities {
  aliases?: readonly string[];
  reply?: boolean;
}

export interface InteractionCommandCapabilities {
  description?: string;
  deferReply?: DeferSetting;
}

export interface ContextMenuCommandDefinitionBase {
  deferReply?: DeferSetting;
  guildOnly?: boolean;
  init?: (client: Client, instance: SWAGCommands) => Awaitable<void>;
  ownerOnly?: boolean;
  permissions?: readonly bigint[];
  preconditions?: PreconditionArrayResolvable;
  testOnly?: boolean;
}

export interface UserContextMenuCommandObject
  extends ContextMenuCommandDefinitionBase {
  callback: (
    commandUsage: UserContextMenuCommandUsage,
  ) => Awaitable<InteractionResponse | void>;
  type: ApplicationCommandType.User;
}

export interface MessageContextMenuCommandObject
  extends ContextMenuCommandDefinitionBase {
  callback: (
    commandUsage: MessageContextMenuCommandUsage,
  ) => Awaitable<InteractionResponse | void>;
  type: ApplicationCommandType.Message;
}

export type ContextMenuCommandObject =
  | UserContextMenuCommandObject
  | MessageContextMenuCommandObject;

export interface CommandObject
  extends CommandDefinitionBase,
    MessageCommandCapabilities,
    InteractionCommandCapabilities {
  callback: (commandUsage: CommandUsage) => Awaitable<CommandResponse | void>;
  type: CommandType;
  options?: ApplicationCommandOptionData[];
  autocomplete?: Function;
}

export type FileData = {
  filePath: string;
  fileContents: any;
};

export interface SubcommandObject
  extends CommandDefinitionBase,
    MessageCommandCapabilities,
    InteractionCommandCapabilities {
  type: CommandType;
}

export interface SubcommandOptionObject
  extends CommandDefinitionBase,
    MessageCommandCapabilities,
    InteractionCommandCapabilities {
  callback: (commandUsage: SubcommandUsage) => Awaitable<CommandResponse | void>;
  options?: ApplicationCommandOptionData[];
  autocomplete?: Function;
}
