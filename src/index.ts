import type { CooldownPreconditionContext } from "./cooldowns/CooldownPrecondition";

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

export { default, default as SWAGCommands } from "./SWAG";
export type { LifecycleState } from "./SWAG";
export { default as CommandType } from "./util/CommandType";

export { MemoryPrefixStore } from "./prefixes/MemoryPrefixStore";
export type { PrefixStore } from "./prefixes/PrefixStore";
export { MemoryCooldownStore } from "./cooldowns/MemoryCooldownStore";
export type { CooldownClaim, CooldownStore } from "./cooldowns/CooldownStore";
export {
  Cooldown,
  CooldownPrecondition,
  CooldownScope,
  createCooldownId,
} from "./cooldowns/CooldownPrecondition";
export type { CooldownPreconditionContext } from "./cooldowns/CooldownPrecondition";

export { AutocompleteError } from "./errors/AutocompleteError";
export { CommandDefinitionError } from "./errors/CommandDefinitionError";
export { CommandDeploymentError } from "./errors/CommandDeploymentError";
export { CommandExecutionError } from "./errors/CommandExecutionError";
export { EventExecutionError } from "./errors/EventExecutionError";
export { InitializationError } from "./errors/InitializationError";
export { InteractionAlreadyAcknowledgedError } from "./errors/InteractionAlreadyAcknowledgedError";
export { InteractionResponseError } from "./errors/InteractionResponseError";
export { MessageResponseError } from "./errors/MessageResponseError";
export { ModuleLoadError } from "./errors/ModuleLoadError";
export { PreconditionExecutionError } from "./errors/PreconditionExecutionError";
export { SwagError } from "./errors/SwagError";
export type {
  ErrorContext,
  ErrorPhase,
  InvocationKind,
  SwagErrorOptions,
} from "./errors/SwagError";

export { default as ResponseHandler } from "./execution/ResponseHandler";
export type {
  CommandResponse,
  DeferOptions,
  DeferSetting,
  ErrorReporter,
  InteractionResponse,
  MessageResponse,
} from "./execution/ResponseHandler";
export type {
  ClearCommandsTarget,
  CommandDeploymentResult,
  CommandDeploymentScope,
  CommandDeploymentTarget,
  CommandDeploymentTargetResult,
  DeployedApplicationCommand,
  DeployCommandsOptions,
} from "./deployment/CommandDeployer";

export {
  AllFlowsPrecondition,
  createPreconditionFactory,
  Precondition,
  preconditionError,
  preconditionOk,
} from "./preconditions/Precondition";
export type {
  Awaitable,
  NamedPreconditionClass,
  PreconditionCommand,
  PreconditionContext,
} from "./preconditions/Precondition";
export type {
  PreconditionFailure,
  PreconditionFailureOptions,
  PreconditionFailureResult,
  PreconditionResult,
  PreconditionSuccessResult,
} from "./preconditions/PreconditionResult";
export { PreconditionContainerArray, PreconditionRunCondition } from "./preconditions/containers/PreconditionContainerArray";
export { PreconditionContainerSingle } from "./preconditions/containers/PreconditionContainerSingle";
export type {
  PreconditionCheckResult,
  PreconditionCommit,
  PreconditionContainer,
} from "./preconditions/containers/PreconditionContainer";
export { PreconditionHandler } from "./preconditions/PreconditionHandler";
export { PreconditionStore } from "./preconditions/PreconditionStore";
export type { PreconditionLookup } from "./preconditions/PreconditionStore";
export {
  ArgumentCount,
  ArgumentCountPrecondition,
  GuildOnlyPrecondition,
  HasPermissions,
  HasPermissionsPrecondition,
  OwnerOnlyPrecondition,
  TestOnlyPrecondition,
} from "./preconditions/built-ins/BuiltInPreconditions";
export type {
  ArgumentCountContext,
  PermissionsContext,
} from "./preconditions/built-ins/BuiltInPreconditions";

export type {
  ChatInputCommandUsage,
  ChatInputSubcommandUsage,
  CommandDefinitionBase,
  CommandObject,
  CommandUsage,
  ContextMenuCommandDefinitionBase,
  ContextMenuCommandObject,
  ContextMenuCommandUsage,
  ContextMenuCommandUsageBase,
  Events,
  FileData,
  InlinePrecondition,
  InteractionCommandCapabilities,
  MessageCommandCapabilities,
  MessageCommandUsage,
  MessageContextMenuCommandObject,
  MessageContextMenuCommandUsage,
  MessageSubcommandUsage,
  Options,
  PreconditionAllResolvable,
  PreconditionAnyResolvable,
  PreconditionArrayResolvable,
  PreconditionEntryResolvable,
  PreconditionFactoryEntry,
  PreconditionFailureEvent,
  PreconditionKeys,
  PreconditionSingleResolvable,
  PreconditionSingleResolvableDetails,
  SimplePreconditionKeys,
  SubcommandObject,
  SubcommandOptionObject,
  SubcommandUsage,
  SubcommandUsageBase,
  UserContextMenuCommandObject,
  UserContextMenuCommandUsage,
  Validations,
} from "./types";
export type { default as Command } from "./command-handler/Command";
export type { default as ContextMenuCommand } from "./context-menu-handler/ContextMenuCommand";
export type { default as ContextMenuCommandHandler } from "./context-menu-handler/ContextMenuCommandHandler";
export type { default as MessageCommandRouter } from "./command-handler/MessageCommandRouter";
export type { default as Subcommand } from "./subcommand-handler/Subcommand";
export type { default as SubcommandOption } from "./subcommand-handler/SubcommandOption";
