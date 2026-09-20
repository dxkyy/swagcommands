# V2 preconditions and cooldowns

V2 replaces runtime validation functions and command guard flags with composable preconditions. Preconditions are loaded before command definitions, resolved while commands load, and executed before Discord deferral, message typing indicators, or command callbacks.

## Configure precondition loading

Pass the directory containing your custom precondition classes to `SWAG.create()`:

```ts
const swag = await SWAG.create({
  client,
  commandsDir: "./commands",
  preconditionsDir: "./preconditions",
  subcommandsDir: "./subcommands",
});
```

Each file must default-export a class extending `Precondition` or `AllFlowsPrecondition`. The filename, without its extension, becomes the registered name.

```ts
// preconditions/MinimumLevel.ts
import {
  AllFlowsPrecondition,
  type ChatInputCommandUsage,
  type Command,
  type MessageCommandUsage,
  type PreconditionCommand,
  type PreconditionContext,
} from "swagcommands";

interface MinimumLevelContext extends PreconditionContext {
  level: number;
}

export default class MinimumLevel extends AllFlowsPrecondition {
  public messageRun(
    usage: MessageCommandUsage,
    _command: Command,
    context: MinimumLevelContext,
  ) {
    return this.run(usage.user.id, context);
  }

  public chatInputRun(
    usage: ChatInputCommandUsage,
    _command: PreconditionCommand,
    context: MinimumLevelContext,
  ) {
    return this.run(usage.user.id, context);
  }

  private run(userId: string, context: MinimumLevelContext) {
    const actualLevel = getLevel(userId);

    return actualLevel >= context.level
      ? this.ok()
      : this.error({
          identifier: "MINIMUM_LEVEL",
          message: `Level ${context.level} is required.`,
          context: { actualLevel, requiredLevel: context.level },
        });
  }
}
```

Use declaration merging to make custom names and contexts type-safe in command definitions:

```ts
declare module "swagcommands" {
  interface Preconditions {
    MinimumLevel: {
      level: number;
    };
  }
}
```

## Add preconditions to commands

Add the `preconditions` array to a command definition. Preconditions without context use their string name. Preconditions requiring configuration use an object with `name` and `context`.

```ts
export default {
  type: CommandType.BOTH,
  description: "Delete a project",
  preconditions: ["GuildOnly", { name: "MinimumLevel", context: { level: 5 } }],
  callback: async ({ args }) => {
    await deleteProject(args[0]);
    return "Project deleted.";
  },
};
```

The outer array is an AND group and short-circuits on the first failure. Each nested array alternates its condition: the first nested level is OR, the next is AND, and so on.

```ts
preconditions: [
  "GuildOnly",
  ["OwnerOnly", { name: "MinimumLevel", context: { level: 10 } }],
];
```

This example means `GuildOnly AND (OwnerOnly OR MinimumLevel)`.

For subcommands, put shared preconditions in the root `index.ts` definition and leaf-specific preconditions in the subcommand file. Root preconditions run first. A root failure prevents leaf preconditions and the callback from running.

## Built-in preconditions

V2 registers these preconditions automatically:

| Name             | Context                                 | Behavior                                                               |
| ---------------- | --------------------------------------- | ---------------------------------------------------------------------- |
| `GuildOnly`      | None                                    | Requires a guild invocation.                                           |
| `OwnerOnly`      | None                                    | Requires the invoking user ID to appear in `botOwners`.                |
| `TestOnly`       | None                                    | Requires the guild ID to appear in `testServers`.                      |
| `HasPermissions` | `{ permissions: readonly bigint[] }`    | Requires every listed Discord permission. Combine it with `GuildOnly`. |
| `ArgumentCount`  | `{ minArgs?, maxArgs?, expectedArgs? }` | Checks parsed argument count. `maxArgs: -1` means unlimited.           |
| `Cooldown`       | `{ duration, scope?, id? }`             | Claims a cooldown bucket. Duration is in milliseconds.                 |

Example:

```ts
import { PermissionFlagsBits } from "discord.js";

preconditions: [
  "GuildOnly",
  {
    name: "HasPermissions",
    context: {
      permissions: [PermissionFlagsBits.ManageGuild],
    },
  },
  {
    name: "ArgumentCount",
    context: {
      minArgs: 1,
      maxArgs: 1,
      expectedArgs: "<project>",
    },
  },
];
```

## Handle failures

A failed precondition stops execution before deferral, typing indicators, and the callback. By default the failure is silent. Use `onPreconditionFailure` to log it or return a normal command response:

```ts
const swag = await SWAG.create({
  client,
  commandsDir: "./commands",
  onPreconditionFailure: async ({ command, failure, usage }) => {
    console.info(
      command.commandName,
      failure.preconditionName,
      failure.identifier,
      failure.context,
    );

    return failure.message;
  },
});
```

The hook receives:

- `command`: the command, subcommand root, or subcommand option that failed;
- `failure`: an immutable object containing `preconditionName`, `identifier`, optional `message`, and optional structured `context`;
- `usage`: the same message or chat-input usage passed to the precondition.

If the hook returns `undefined`, SWAGCommands sends no response. If it returns a string or Discord.js response object, the normal response handler sends it. Errors thrown by preconditions are reported through `onError` as `PreconditionExecutionError` with command, subcommand, invocation, and precondition context.

## Cooldowns

The built-in cooldown defaults to one bucket per command and user:

```ts
preconditions: [
  {
    name: "Cooldown",
    context: { duration: 5_000 },
  },
];
```

Choose a scope with `CooldownScope`:

```ts
import { CooldownScope } from "swagcommands";

preconditions: [
  {
    name: "Cooldown",
    context: {
      duration: 60_000,
      scope: CooldownScope.Guild,
    },
  },
];
```

Available scopes are:

- `CooldownScope.User`: one bucket for each user; this is the default.
- `CooldownScope.Channel`: one bucket for each channel.
- `CooldownScope.Guild`: one bucket for each guild and fails when no guild is available.
- `CooldownScope.Global`: one bucket shared by every invocation of the command.

Generated IDs include the full command identity, so `admin/ban` and `admin/kick` do not collide. Set `id` to share a bucket across commands:

```ts
{
  name: "Cooldown",
  context: {
    duration: 10_000,
    scope: CooldownScope.User,
    id: "moderation-actions",
  },
}
```

An active cooldown fails with identifier `COOLDOWN_ACTIVE`. Its failure context includes `cooldownId`, `scope`, `expiresAt`, and `remaining` milliseconds.

### Persistent and distributed cooldown stores

SWAGCommands uses `MemoryCooldownStore` by default. Its values are local to one process and disappear on restart. Inject a store for persistence or multiple bot processes:

```ts
import type { CooldownClaim, CooldownStore } from "swagcommands";

class RedisCooldownStore implements CooldownStore {
  async claimCooldown(
    cooldownId: string,
    expiresAt: number,
    now: number,
  ): Promise<CooldownClaim> {
    // This operation must atomically check the current expiry and claim the
    // bucket. Use a transaction, script, or compare-and-set operation.
  }

  async getCooldown(cooldownId: string) {
    // Return the expiration timestamp in milliseconds, or undefined.
  }

  async setCooldown(cooldownId: string, expiresAt: number) {
    // Store the expiration timestamp in milliseconds.
  }

  async deleteCooldown(cooldownId: string) {
    // Remove the bucket.
  }
}

const swag = await SWAG.create({
  client,
  cooldownStore: new RedisCooldownStore(),
});
```

`claimCooldown` is the operation used during command execution. It must be atomic: return `{ acquired: true, expiresAt }` after claiming an expired or missing bucket, or `{ acquired: false, expiresAt: activeExpiration }` when a live claim already exists. This prevents concurrent invocations from both passing the same cooldown.

## Migrate from v1 runtime validation

The `validations.runtime` option and command guard flags are removed in v2. Replace them as follows:

| V1 definition                                         | V2 precondition                                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `guildOnly: true`                                     | `"GuildOnly"`                                                                               |
| `ownerOnly: true`                                     | `"OwnerOnly"`                                                                               |
| `testOnly: true`                                      | `"TestOnly"`                                                                                |
| `permissions: [PermissionFlagsBits.ManageGuild]`      | `{ name: "HasPermissions", context: { permissions: [...] } }`, normally after `"GuildOnly"` |
| `minArgs`, `maxArgs`, and runtime argument validation | `{ name: "ArgumentCount", context: { minArgs, maxArgs, expectedArgs } }`                    |
| A function in `validations.runtime`                   | A class in `preconditionsDir`                                                               |

For example:

```ts
// V1
export default {
  guildOnly: true,
  ownerOnly: true,
  permissions: [PermissionFlagsBits.ManageGuild],
  minArgs: 1,
  maxArgs: 1,
  expectedArgs: "<project>",
  callback,
};

// V2
export default {
  preconditions: [
    "GuildOnly",
    "OwnerOnly",
    {
      name: "HasPermissions",
      context: { permissions: [PermissionFlagsBits.ManageGuild] },
    },
    {
      name: "ArgumentCount",
      context: { minArgs: 1, maxArgs: 1, expectedArgs: "<project>" },
    },
  ],
  callback,
};
```

Also account for these behavioral changes:

- Built-in failures no longer send responses themselves. Return a response from `onPreconditionFailure` when users should see one.
- Preconditions are validated at load time. Missing names, malformed entries, or handlers incompatible with a command flow fail initialization with `CommandDefinitionError`.
- Custom preconditions load before commands, so command definitions may safely reference them.
- Root subcommand preconditions and leaf preconditions are distinct and execute in that order.
- `validations.syntax` remains available for custom definition-time validation; it is not an execution guard.
