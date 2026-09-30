import type { CooldownScope } from "../cooldowns/CooldownPrecondition";

export enum FailureType {
  ArgumentCount = "argumentCount",
  GuildOnly = "guildOnly",
  GuildRequired = "guildRequired",
  MissingPermissions = "missingPermissions",
  OwnerOnly = "ownerOnly",
  TestOnly = "testOnly",
  CooldownInvalidDuration = "cooldownInvalidDuration",
  CooldownScopeUnavailable = "cooldownScopeUnavailable",
  CooldownActive = "cooldownActive",
  CooldownCommitInvalid = "cooldownCommitInvalid",
  PreconditionEmptyOrGroup = "preconditionEmptyOrGroup",
  PreconditionMissingMessageHandler = "preconditionMissingMessageHandler",
  PreconditionMissingChatInputHandler = "preconditionMissingChatInputHandler",
  PreconditionMissingContextMenuHandler = "preconditionMissingContextMenuHandler",
  PreconditionUnavailable = "preconditionUnavailable",
  InlinePreconditionFailed = "inlinePreconditionFailed",
  Custom = "custom",
}

export interface PreconditionFailureOptions {
  identifier: string;
  message?: string;
  context?: Readonly<Record<PropertyKey, unknown>>;
}

interface BasePreconditionFailure extends PreconditionFailureOptions {
  preconditionName: string;
}

type TypedFailure<
  Type extends FailureType,
  Identifier extends string,
  Context = undefined,
> = Omit<BasePreconditionFailure, "identifier" | "context"> & {
  readonly type: Type;
  readonly identifier: Identifier;
} & (Context extends undefined
  ? { readonly context?: undefined }
  : { readonly context: Readonly<Context> });

export type CooldownActiveFailure = TypedFailure<
  FailureType.CooldownActive,
  "COOLDOWN_ACTIVE",
  { cooldownId: string; scope: CooldownScope; expiresAt: number; remaining: number }
>;

export interface CustomPreconditionFailure extends BasePreconditionFailure {
  // Optional so existing callers constructing a failure remain source-compatible.
  readonly type?: FailureType.Custom;
}

export type PreconditionFailure =
  | TypedFailure<FailureType.ArgumentCount, "ARGUMENT_COUNT", { actual: number; maxArgs: number; minArgs: number }>
  | TypedFailure<FailureType.GuildOnly, "GUILD_ONLY">
  | TypedFailure<FailureType.GuildRequired, "GUILD_REQUIRED">
  | TypedFailure<FailureType.MissingPermissions, "MISSING_PERMISSIONS", { missingPermissions: readonly bigint[] }>
  | TypedFailure<FailureType.OwnerOnly, "OWNER_ONLY">
  | TypedFailure<FailureType.TestOnly, "TEST_ONLY">
  | TypedFailure<FailureType.CooldownInvalidDuration, "COOLDOWN_INVALID_DURATION", { duration: number }>
  | TypedFailure<FailureType.CooldownScopeUnavailable, "COOLDOWN_SCOPE_UNAVAILABLE", { scope: CooldownScope }>
  | CooldownActiveFailure
  | TypedFailure<FailureType.CooldownCommitInvalid, "COOLDOWN_COMMIT_INVALID">
  | TypedFailure<FailureType.PreconditionEmptyOrGroup, "PRECONDITION_EMPTY_OR_GROUP">
  | TypedFailure<FailureType.PreconditionMissingMessageHandler, "PRECONDITION_MISSING_MESSAGE_HANDLER">
  | TypedFailure<FailureType.PreconditionMissingChatInputHandler, "PRECONDITION_MISSING_CHAT_INPUT_HANDLER">
  | TypedFailure<FailureType.PreconditionMissingContextMenuHandler, "PRECONDITION_MISSING_CONTEXT_MENU_HANDLER">
  | TypedFailure<FailureType.PreconditionUnavailable, "PRECONDITION_UNAVAILABLE">
  | TypedFailure<FailureType.InlinePreconditionFailed, "INLINE_PRECONDITION_FAILED">
  | CustomPreconditionFailure;

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

const successResult: PreconditionSuccessResult = Object.freeze({
  success: true,
});

export function createPreconditionSuccess(): PreconditionSuccessResult {
  return successResult;
}

export function createPreconditionFailure(
  preconditionName: string,
  options: PreconditionFailureOptions,
): PreconditionFailureResult {
  const context = options.context
    ? Object.freeze({ ...options.context })
    : undefined;
  const failure = Object.freeze({
    context,
    identifier: options.identifier,
    message: options.message,
    preconditionName,
    type: classifyFailure(preconditionName, options.identifier, context),
  });

  return Object.freeze({
    failure: failure as PreconditionFailure,
    success: false,
  });
}

function isCooldownScope(value: unknown): value is CooldownScope {
  return value === "user" || value === "channel" || value === "guild" || value === "global";
}

function classifyFailure(
  name: string,
  identifier: string,
  context: Readonly<Record<PropertyKey, unknown>> | undefined,
): FailureType {
  switch (identifier) {
    case "ARGUMENT_COUNT":
      return name === "ArgumentCount" && typeof context?.actual === "number"
        && typeof context.maxArgs === "number" && typeof context.minArgs === "number"
        ? FailureType.ArgumentCount : FailureType.Custom;
    case "GUILD_ONLY":
      return name === "GuildOnly" && context === undefined ? FailureType.GuildOnly : FailureType.Custom;
    case "GUILD_REQUIRED":
      return name === "HasPermissions" && context === undefined ? FailureType.GuildRequired : FailureType.Custom;
    case "MISSING_PERMISSIONS":
      return name === "HasPermissions" && Array.isArray(context?.missingPermissions)
        && context.missingPermissions.every((permission: unknown) => typeof permission === "bigint")
        ? FailureType.MissingPermissions : FailureType.Custom;
    case "OWNER_ONLY":
      return name === "OwnerOnly" && context === undefined ? FailureType.OwnerOnly : FailureType.Custom;
    case "TEST_ONLY":
      return name === "TestOnly" && context === undefined ? FailureType.TestOnly : FailureType.Custom;
    case "COOLDOWN_INVALID_DURATION":
      return name === "Cooldown" && typeof context?.duration === "number"
        ? FailureType.CooldownInvalidDuration : FailureType.Custom;
    case "COOLDOWN_SCOPE_UNAVAILABLE":
      return name === "Cooldown" && isCooldownScope(context?.scope)
        ? FailureType.CooldownScopeUnavailable : FailureType.Custom;
    case "COOLDOWN_ACTIVE":
      return name === "Cooldown" && typeof context?.cooldownId === "string"
        && typeof context.expiresAt === "number" && typeof context.remaining === "number"
        && isCooldownScope(context.scope)
        ? FailureType.CooldownActive : FailureType.Custom;
    case "COOLDOWN_COMMIT_INVALID":
      return name === "Cooldown" && context === undefined ? FailureType.CooldownCommitInvalid : FailureType.Custom;
    case "PRECONDITION_EMPTY_OR_GROUP":
      return name === "PreconditionContainer" && context === undefined ? FailureType.PreconditionEmptyOrGroup : FailureType.Custom;
    case "PRECONDITION_MISSING_MESSAGE_HANDLER":
      return context === undefined ? FailureType.PreconditionMissingMessageHandler : FailureType.Custom;
    case "PRECONDITION_MISSING_CHAT_INPUT_HANDLER":
      return context === undefined ? FailureType.PreconditionMissingChatInputHandler : FailureType.Custom;
    case "PRECONDITION_MISSING_CONTEXT_MENU_HANDLER":
      return context === undefined ? FailureType.PreconditionMissingContextMenuHandler : FailureType.Custom;
    case "PRECONDITION_UNAVAILABLE":
      return context === undefined ? FailureType.PreconditionUnavailable : FailureType.Custom;
    case "INLINE_PRECONDITION_FAILED":
      return context === undefined ? FailureType.InlinePreconditionFailed : FailureType.Custom;
    default:
      return FailureType.Custom;
  }
}
