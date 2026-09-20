import { PermissionFlagsBits } from "discord.js";

import type {
  ChatInputCommandUsage,
  MessageCommandUsage,
  PreconditionCommand,
  PreconditionContext,
} from "../Precondition";
import { AllFlowsPrecondition } from "../Precondition";
import type { PreconditionStore } from "../PreconditionStore";
import type Command from "../../command-handler/Command";
import type SWAG from "../../../typings";

type Usage = MessageCommandUsage | ChatInputCommandUsage;

interface ArgumentCountContext extends PreconditionContext {
  expectedArgs?: string;
  maxArgs?: number;
  minArgs?: number;
}

interface PermissionsContext extends PreconditionContext {
  permissions: readonly bigint[];
}

abstract class SharedFlowPrecondition extends AllFlowsPrecondition {
  public messageRun(
    usage: MessageCommandUsage,
    command: Command,
    context: PreconditionContext,
  ) {
    return this.run(usage, command, context);
  }

  public chatInputRun(
    usage: ChatInputCommandUsage,
    command: PreconditionCommand,
    context: PreconditionContext,
  ) {
    return this.run(usage, command, context);
  }

  protected abstract run(
    usage: Usage,
    command: PreconditionCommand,
    context: PreconditionContext,
  ): ReturnType<AllFlowsPrecondition["chatInputRun"]>;
}

export class ArgumentCountPrecondition extends SharedFlowPrecondition {
  protected async run(
    usage: Usage,
    command: PreconditionCommand,
    context: ArgumentCountContext,
  ) {
    const { expectedArgs = "", maxArgs = -1, minArgs = 0 } = context;
    const count = usage.args.length;
    if (count >= minArgs && (maxArgs === -1 || count <= maxArgs)) {
      return this.ok();
    }

    const rootName = "parent" in command
      ? command.parent.commandName
      : command.commandName;
    const invocation = "message" in usage && usage.message
      ? `${await this.instance.commandHandler?.prefixHandler.get(usage.guild?.id)}${rootName}`
      : `/${rootName}`;
    const subcommand = "parent" in command ? ` ${command.commandName}` : "";
    const suffix = expectedArgs ? ` ${expectedArgs}` : "";

    return this.error({
      context: { actual: count, maxArgs, minArgs },
      identifier: "ARGUMENT_COUNT",
      message: `Incorrect syntax. Please use \`${invocation}${subcommand}${suffix}\`.`,
    });
  }
}

export class GuildOnlyPrecondition extends SharedFlowPrecondition {
  protected run(usage: Usage) {
    return usage.guild
      ? this.ok()
      : this.error({
          identifier: "GUILD_ONLY",
          message: "This command can only be used in a server.",
        });
  }
}

export class HasPermissionsPrecondition extends SharedFlowPrecondition {
  protected run(
    usage: Usage,
    _command: PreconditionCommand,
    context: PermissionsContext,
  ) {
    const missingPermissions = context.permissions.filter(
      (permission) => !usage.member?.permissions.has(permission),
    );
    if (missingPermissions.length === 0) {
      return this.ok();
    }

    const names = missingPermissions.map(
      (permission) =>
        Object.entries(PermissionFlagsBits).find(
          ([, value]) => value === permission,
        )?.[0] ?? permission.toString(),
    );
    return this.error({
      context: { missingPermissions: Object.freeze([...missingPermissions]) },
      identifier: "MISSING_PERMISSIONS",
      message: `You are missing the following permissions: \`${names.join(
        ", ",
      )}\`.`,
    });
  }
}

export class OwnerOnlyPrecondition extends SharedFlowPrecondition {
  protected run(usage: Usage) {
    return this.instance.botOwners.includes(usage.user.id)
      ? this.ok()
      : this.error({
          identifier: "OWNER_ONLY",
          message: "This command can only be used by a bot owner.",
        });
  }
}

export class TestOnlyPrecondition extends SharedFlowPrecondition {
  protected run(usage: Usage) {
    return usage.guild && this.instance.testServers.includes(usage.guild.id)
      ? this.ok()
      : this.error({
          identifier: "TEST_ONLY",
          message: "This command can only be used in a test server.",
        });
  }
}

const builtIns = [
  ArgumentCountPrecondition,
  GuildOnlyPrecondition,
  HasPermissionsPrecondition,
  OwnerOnlyPrecondition,
  TestOnlyPrecondition,
] as const;

export function registerBuiltInPreconditions(
  instance: SWAG,
  store: PreconditionStore,
): void {
  for (const BuiltIn of builtIns) {
    const name = BuiltIn.name.replace(/Precondition$/, "");
    store.register(new BuiltIn(instance, name));
  }
}
