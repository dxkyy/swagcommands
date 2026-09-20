import type Command from "../command-handler/Command";
import type {
  ChatInputCommandUsage,
  MessageCommandUsage,
  PreconditionCommand,
  PreconditionContext,
} from "../preconditions/Precondition";
import {
  AllFlowsPrecondition,
  createPreconditionFactory,
} from "../preconditions/Precondition";

type CooldownUsage = MessageCommandUsage | ChatInputCommandUsage;

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

export const Cooldown = createPreconditionFactory<CooldownPreconditionContext>(
  "Cooldown",
);

export function createCooldownId(
  command: PreconditionCommand,
  usage: CooldownUsage,
  scope: CooldownScope = CooldownScope.User,
  id?: string,
): string | undefined {
  const commandId = id ?? getCommandId(command);
  const scopeId = getScopeId(usage, scope);
  if (scopeId === undefined) {
    return undefined;
  }

  return ["cooldown", commandId, scope, scopeId]
    .map((part) => encodeURIComponent(part))
    .join(":");
}

export class CooldownPrecondition extends AllFlowsPrecondition {
  public messageRun(
    usage: MessageCommandUsage,
    command: Command,
    context: CooldownPreconditionContext,
  ) {
    return this.run(usage, command, context);
  }

  public chatInputRun(
    usage: ChatInputCommandUsage,
    command: PreconditionCommand,
    context: CooldownPreconditionContext,
  ) {
    return this.run(usage, command, context);
  }

  public messageCommit(
    usage: MessageCommandUsage,
    command: Command,
    context: CooldownPreconditionContext,
  ) {
    return this.commit(usage, command, context);
  }

  public chatInputCommit(
    usage: ChatInputCommandUsage,
    command: PreconditionCommand,
    context: CooldownPreconditionContext,
  ) {
    return this.commit(usage, command, context);
  }

  private async run(
    usage: CooldownUsage,
    command: PreconditionCommand,
    context: CooldownPreconditionContext,
  ) {
    const { duration, id, scope = CooldownScope.User } = context;
    if (!Number.isFinite(duration) || duration <= 0) {
      return this.error({
        context: { duration },
        identifier: "COOLDOWN_INVALID_DURATION",
        message: "Cooldown duration must be a positive number of milliseconds.",
      });
    }

    const cooldownId = createCooldownId(command, usage, scope, id);
    if (!cooldownId) {
      return this.error({
        context: { scope },
        identifier: "COOLDOWN_SCOPE_UNAVAILABLE",
        message: `The ${scope} cooldown scope is unavailable for this command.`,
      });
    }

    const now = Date.now();
    const expiresAt = await this.instance.cooldownStore.getCooldown(cooldownId);
    if (expiresAt !== undefined && expiresAt > now) {
      return this.error({
        context: {
          cooldownId,
          expiresAt,
          remaining: expiresAt - now,
          scope,
        },
        identifier: "COOLDOWN_ACTIVE",
        message: `This command is on cooldown for another ${expiresAt - now}ms.`,
      });
    }

    return this.ok();
  }

  private async commit(
    usage: CooldownUsage,
    command: PreconditionCommand,
    context: CooldownPreconditionContext,
  ) {
    const { duration, id, scope = CooldownScope.User } = context;
    const cooldownId = createCooldownId(command, usage, scope, id);
    if (!cooldownId || !Number.isFinite(duration) || duration <= 0) {
      return this.error({
        identifier: "COOLDOWN_COMMIT_INVALID",
        message: "The cooldown could not be committed.",
      });
    }

    const now = Date.now();
    const claim = await this.instance.cooldownStore.claimCooldown(
      cooldownId,
      now + duration,
      now,
    );
    return claim.acquired
      ? this.ok()
      : this.error({
          context: {
            cooldownId,
            expiresAt: claim.expiresAt,
            remaining: claim.expiresAt - now,
            scope,
          },
          identifier: "COOLDOWN_ACTIVE",
          message: `This command is on cooldown for another ${claim.expiresAt - now}ms.`,
        });
  }
}

function getCommandId(command: PreconditionCommand): string {
  return "parent" in command
    ? `${command.parent.commandName}/${command.commandName}`
    : command.commandName;
}

function getScopeId(
  usage: CooldownUsage,
  scope: CooldownScope,
): string | undefined {
  switch (scope) {
    case CooldownScope.User:
      return usage.user.id;
    case CooldownScope.Channel:
      return usage.channel?.id;
    case CooldownScope.Guild:
      return usage.guild?.id;
    case CooldownScope.Global:
      return "global";
  }
}
