# V2 preconditions and cooldowns

V2 uses preconditions as its single command-guard engine while keeping common command metadata terse. Flags such as `guildOnly`, `permissions`, and `minArgs` are compiled into the same normalized precondition list as custom checks.

Preconditions are resolved when commands load and checked before Discord deferral, typing indicators, or callbacks. Flag-derived checks run first in the order documented below, followed by entries in the explicit `preconditions` array.

## Common command guards

Use top-level properties for the common cases:

```ts
import { PermissionFlagsBits } from "discord.js";
import { CommandType } from "swagcommands";

export default {
  type: CommandType.BOTH,
  description: "Delete a project",
  guildOnly: true,
  permissions: [PermissionFlagsBits.ManageGuild],
  minArgs: 1,
  maxArgs: 1,
  expectedArgs: "<project>",
  callback: async ({ args }) => {
    await deleteProject(args[0]);
    return "Project deleted.";
  },
};
```

The framework compiles properties in this order:

1. `guildOnly` → `GuildOnly`
2. `ownerOnly` → `OwnerOnly`
3. `testOnly` → `TestOnly`
4. `permissions` → `HasPermissions`
5. `minArgs`, `maxArgs`, and `expectedArgs` → `ArgumentCount`
6. Explicit `preconditions`, in their declared order

`expectedArgs` remains command metadata. It is available to help and slash-option generation and is also passed to the compiled `ArgumentCount` check for its usage message. An `ArgumentCount` check is added when `minArgs` or `maxArgs` is present.

The same guard properties are available on subcommand root and leaf definitions. Root checks run before leaf checks.

## Explicit composition

The top-level `preconditions` array is an implicit `all`. Use explicit `any` and `all` combinators for nested expressions:

```ts
preconditions: [
  "GuildOnly",
  {
    any: [
      "OwnerOnly",
      MinimumLevel({ level: 10 }),
    ],
  },
]
```

This reads as `GuildOnly AND (OwnerOnly OR MinimumLevel)`. Combinators may be nested without changing their meaning:

```ts
preconditions: [
  {
    any: [
      "OwnerOnly",
      {
        all: [
          "GuildOnly",
          MinimumLevel({ level: 10 }),
        ],
      },
    ],
  },
]
```

Nested arrays are rejected at load time. There is no alternating AND/OR rule and no bracket depth to count.

Checks short-circuit. `all` stops on its first failure; `any` stops on its first success and reports the last failure when every branch fails.

## One-off inline checks

Use an inline function when extracting a reusable class would add more ceremony than value:

```ts
import {
  preconditionError,
  preconditionOk,
} from "swagcommands";

preconditions: [
  (usage) =>
    usage.user.id === specialUserId
      ? preconditionOk()
      : preconditionError(
          "NOT_SPECIAL_USER",
          "This command is not available to you.",
        ),
]
```

Returning `true` or `false` is also supported. A bare `false` uses the identifier `INLINE_PRECONDITION_FAILED` and has no default message, so use `preconditionError` when the user should receive a useful response.

Inline checks support normal message and chat-input command execution. Use a class when the check is reusable, needs separate flow implementations, or has a commit phase.

## Reusable typed preconditions

Pass `preconditionsDir` to load reusable classes before command definitions:

```ts
const swag = await SWAG.create({
  client,
  commandsDir: "./commands",
  preconditionsDir: "./preconditions",
});
```

A class may declare an explicit stable name. The loader falls back to the filename only when `preconditionName` is absent.

```ts
// preconditions/MinimumLevel.ts
import {
  AllFlowsPrecondition,
  createPreconditionFactory,
  type ChatInputCommandUsage,
  type Command,
  type MessageCommandUsage,
  type PreconditionCommand,
  type PreconditionContext,
} from "swagcommands";

interface MinimumLevelContext extends PreconditionContext {
  level: number;
}

class MinimumLevelPrecondition extends AllFlowsPrecondition {
  public static readonly preconditionName = "MinimumLevel";

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

export const MinimumLevel =
  createPreconditionFactory<MinimumLevelContext>(MinimumLevelPrecondition);

export default MinimumLevelPrecondition;
```

Importing `MinimumLevel({ level: 10 })` gives autocomplete and context type checking without declaration merging or a magic string at each call site. The class name and helper both derive from the same explicit `preconditionName`, so renaming the file does not change runtime identity.

String names remain supported for built-ins, context-free checks, and compatibility. Projects that prefer typed string entries can still augment the exported `Preconditions` interface.

## Built-ins

V2 registers these preconditions automatically:

| Name | Context | Behavior |
| --- | --- | --- |
| `GuildOnly` | None | Requires a guild invocation. |
| `OwnerOnly` | None | Requires the user ID to appear in `botOwners`. |
| `TestOnly` | None | Requires the guild ID to appear in `testServers`. |
| `HasPermissions` | `{ permissions: readonly bigint[] }` | Requires a guild member and every listed Discord permission. A DM fails with `GUILD_REQUIRED`. |
| `ArgumentCount` | `{ minArgs?, maxArgs?, expectedArgs? }` | Checks parsed arguments. `maxArgs: -1` means unlimited. |
| `Cooldown` | `{ duration, scope?, id? }` | Checks and later claims a cooldown bucket. Duration is milliseconds. |

`ArgumentCount`, `HasPermissions`, and `Cooldown` also have typed factories for explicit composition:

```ts
import {
  ArgumentCount,
  Cooldown,
  HasPermissions,
} from "swagcommands";

preconditions: [
  HasPermissions({ permissions: [PermissionFlagsBits.ManageGuild] }),
  ArgumentCount({ minArgs: 1, maxArgs: 1, expectedArgs: "<project>" }),
  Cooldown({ duration: 5_000 }),
]
```

For ordinary definitions, prefer the equivalent top-level properties.

## Failure responses

Built-in failures with a message respond to users by default. Message commands receive the text through their configured response path. Fresh chat-input interactions receive an ephemeral response.

Override `onPreconditionFailure` to customize messages, log failures, or map identifiers:

```ts
const swag = await SWAG.create({
  client,
  onPreconditionFailure: async ({ command, failure, usage }) => {
    audit(command.commandName, failure.identifier, usage.user.id);

    return messages[failure.identifier] ?? failure.message;
  },
});
```

Returning `undefined` from an explicitly configured hook opts into silence:

```ts
onPreconditionFailure: () => undefined,
```

The hook receives the command, the usage, and an immutable failure containing `preconditionName`, `identifier`, optional `message`, and optional structured `context`. Thrown errors are reported through `onError` as `PreconditionExecutionError`.

## Stateful checks and cooldown commits

Execution has two precondition phases:

1. Check every selected precondition branch without mutation.
2. If all checks pass, run the selected commits immediately before command execution.
3. Run the callback.

A reusable precondition may implement `messageCommit` and/or `chatInputCommit` in addition to its check methods. Commits are collected only from the successful branch of an `any` group and are discarded if a later check fails.

`Cooldown` uses this mechanism. Its check reads the current expiry but does not claim a bucket. Its commit calls the store's atomic `claimCooldown`. Therefore a later `ArgumentCount` failure does not burn a cooldown, and a cooldown may appear anywhere in an `all` or `any` expression without relying on array order.

Concurrent invocations can both pass the read-only check. The atomic commit allows only one to proceed; the loser receives `COOLDOWN_ACTIVE` before the callback runs.

## Cooldown scopes and stores

The default scope is one bucket per command and user:

```ts
Cooldown({ duration: 5_000 })
```

Other scopes are `CooldownScope.Channel`, `CooldownScope.Guild`, and `CooldownScope.Global`. Generated IDs include the full command identity, so `admin/ban` and `admin/kick` do not collide. Set `id` to intentionally share a bucket:

```ts
Cooldown({
  duration: 10_000,
  scope: CooldownScope.User,
  id: "moderation-actions",
})
```

An active failure includes `cooldownId`, `scope`, `expiresAt`, and `remaining` milliseconds.

`MemoryCooldownStore` is the default. Inject a persistent store through `cooldownStore` for restarts or multiple processes. Its `claimCooldown(cooldownId, expiresAt, now)` implementation must atomically return `{ acquired: true, expiresAt }` after claiming a missing or expired bucket, or `{ acquired: false, expiresAt: activeExpiration }` when a live claim exists. Use a transaction, script, or compare-and-set operation in a distributed backend.

## Invocation coverage

Preconditions currently run for:

- legacy/message commands;
- slash/chat-input commands;
- subcommand roots and selected subcommand leaves.

They do not currently run for:

- autocomplete callbacks;
- buttons or select menus;
- modals;
- context-menu commands.

Autocomplete retains its dedicated callback and error path. Buttons, selects, and modals are handled through events, where applications should call their own shared authorization functions. Context-menu command handling is not implemented yet. Extract the underlying rule into a normal function when command preconditions and component/event handlers must share it.

## V1 migration

The v1 surface remains available as sugar, but every guard now executes through the precondition engine:

| V1 property | V2 behavior |
| --- | --- |
| `guildOnly: true` | Compiles to `GuildOnly`. |
| `ownerOnly: true` | Compiles to `OwnerOnly`. |
| `testOnly: true` | Compiles to `TestOnly`. |
| `permissions: [...]` | Compiles to guild-aware `HasPermissions`. |
| `minArgs`, `maxArgs`, `expectedArgs` | Remain command metadata and compile to `ArgumentCount` when a limit is set. |
| A function in `validations.runtime` | Move it inline into `preconditions`, or create a reusable class and typed factory. |

`validations.runtime` itself is removed. `validations.syntax` remains because definition-time linting is separate from execution guards.

Migration also changes failure behavior:

- Built-in failures now show their default message instead of silently stopping.
- Configure `onPreconditionFailure` to customize messages.
- Configure `onPreconditionFailure: () => undefined` only when silence is intentional.
- Invalid names, malformed combinators, nested arrays, and flow-incompatible classes fail command loading with `CommandDefinitionError`.
