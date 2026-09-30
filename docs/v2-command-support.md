# V2 command definitions and routing

V2 supports three application-facing command shapes and keeps their capabilities explicit:

- normal commands can be legacy/message commands, slash/chat-input commands, or both;
- subcommand trees have a first-class root definition and first-class leaf definitions;
- context-menu commands are typed as either user commands or message commands.

Configure only the directories your application uses:

```ts
const swag = await SWAG.create({
  client,
  commandsDir: "./commands",
  subcommandsDir: "./subcommands",
  contextMenusDir: "./context-menus",
});
```

Loading is local. After the Discord client is ready, call `deployCommands()` to synchronize slash commands, slash subcommand roots, and context-menu commands.

## List loaded commands

After `SWAG.create()` resolves, `swag.listCommands()` returns metadata for every loaded normal command, subcommand root, and context-menu command. Subcommand leaves appear in their root's `subcommands` array. Normal command aliases do not create duplicate entries, while user and message context menus with the same name remain distinct by `type`.

```ts
for (const command of swag.listCommands()) {
  console.log(command.name, command.kind, command.type);
  if (command.kind === "subcommand") {
    console.log(command.subcommands.map((leaf) => leaf.name));
  }
}
```

Entries are sorted by name. The returned objects and alias arrays are copies, so changing them does not change registered commands. `description` is available for normal commands, subcommand roots, and leaves when defined; context menus have no description.

## Normal commands

A file in `commandsDir` exports one command object. The filename is its command name.

```ts
// commands/ping.ts
import { CommandType } from "swagcommands";
import type { CommandObject } from "swagcommands";

const command = {
  type: CommandType.BOTH,
  description: "Check whether the bot is responsive",
  aliases: ["p"],
  reply: true,
  callback: async ({ interaction, message }) => {
    return interaction ? "Slash pong" : `Pong for ${message.author}`;
  },
} satisfies CommandObject;

export default command;
```

`CommandType` controls the available invocation paths:

| Type | Message invocation | Chat-input deployment and invocation |
| --- | --- | --- |
| `CommandType.LEGACY` | Yes | No |
| `CommandType.SLASH` | No | Yes |
| `CommandType.BOTH` | Yes | Yes |

Message-only capabilities such as `aliases` and `reply` do not create extra application commands. Interaction-only metadata such as `description` and `options` is used for slash deployment.

## Subcommand roots and leaves

Each immediate folder in `subcommandsDir` is one root command. It must contain exactly one `index` file plus one file for every direct leaf or group.

```text
subcommands/
└── admin/
    ├── index.ts
    ├── ban.ts
    └── status.ts
```

The root looks like a normal command definition but does not have a callback:

```ts
// subcommands/admin/index.ts
import { CommandType } from "swagcommands";
import type { SubcommandObject } from "swagcommands";

const command = {
  type: CommandType.BOTH,
  description: "Administration commands",
  aliases: ["mod"],
  guildOnly: true,
  deferReply: false,
} satisfies SubcommandObject;

export default command;
```

Every leaf is its own command object. This means `/admin ban` can have preconditions, initialization, argument metadata, `deferReply`, `reply`, aliases, and a callback that are independent from `/admin status`:

```ts
// subcommands/admin/ban.ts
import {
  ApplicationCommandOptionType,
  PermissionFlagsBits,
} from "discord.js";
import type { SubcommandOptionObject } from "swagcommands";

const command = {
  description: "Ban a member",
  aliases: ["b"],
  permissions: [PermissionFlagsBits.BanMembers],
  deferReply: { ephemeral: true },
  options: [
    {
      name: "member",
      description: "Member to ban",
      type: ApplicationCommandOptionType.User,
      required: true,
    },
  ],
  callback: async ({ args, commandName, subcommandName }) => {
    await banMember(args[0]);
    return `${commandName}/${subcommandName} completed`;
  },
} satisfies SubcommandOptionObject;

export default command;
```

Root preconditions run before leaf preconditions. Leaf response settings override root settings; omitted leaf settings inherit from the root.

For message invocation, the root and leaf names may use their aliases:

```text
!admin ban USER_ID spam
!mod b USER_ID spam
```

The callback receives only the remaining arguments. Slash and message invocations expose the same normalized `commandName`, `subcommandName`, and optional `subcommandGroup` identity.

A leaf whose `options` are all Discord subcommand options represents a subcommand group. For example, a `moderation.ts` leaf containing a nested `ban` option is invoked as `/admin moderation ban` or `!admin moderation ban`. Its callback receives `subcommandGroup: "moderation"` and `subcommandName: "ban"`.

## User context menus

Context-menu filenames are displayed as command names. Unlike slash names, their casing and spaces are preserved.

```ts
// context-menus/User Information.ts
import { ApplicationCommandType } from "discord.js";
import type { UserContextMenuCommandObject } from "swagcommands";

const command = {
  type: ApplicationCommandType.User,
  deferReply: { ephemeral: true },
  callback: async ({ targetUser, targetMember, user }) => {
    return {
      content: `${user.username} inspected ${targetUser.username}`,
    };
  },
} satisfies UserContextMenuCommandObject;

export default command;
```

User callbacks receive the invoking `user` and the selected `targetUser`. `targetMember` is available when Discord provides guild-member data.

## Message context menus

```ts
// context-menus/Report Message.ts
import { ApplicationCommandType } from "discord.js";
import type { MessageContextMenuCommandObject } from "swagcommands";

const command = {
  type: ApplicationCommandType.Message,
  guildOnly: true,
  callback: async ({ targetMessage, user }) => {
    await reportMessage(targetMessage, user);
    return { content: "Message reported" };
  },
} satisfies MessageContextMenuCommandObject;

export default command;
```

Message callbacks receive the selected `targetMessage`. Context menus cannot define arguments, options, subcommands, or message aliases. They may define common guards, explicit preconditions, `testOnly`, `init`, and `deferReply`.

User and message context menus may share a name because Discord identifies them by both name and application-command type. Two context menus with the same name and the same type are rejected while loading.

## Context-menu preconditions

Reusable preconditions opt into context menus with `contextMenuRun` and, when state must be committed after every check succeeds, `contextMenuCommit`:

```ts
class Auditable extends Precondition {
  public contextMenuRun(usage: ContextMenuCommandUsage) {
    return usage.guild
      ? this.ok()
      : this.error({ identifier: "GUILD_REQUIRED" });
  }

  public async contextMenuCommit(usage: ContextMenuCommandUsage) {
    await recordInvocation(usage.user.id);
    return this.ok();
  }
}
```

`AllFlowsPrecondition` requires `messageRun`, `chatInputRun`, and `contextMenuRun`. Built-in guild, owner, test-server, permission, and cooldown checks support all three flows.

## Responses and errors

All chat-input and context-menu callbacks use the interaction response path:

- a fresh interaction response calls `interaction.reply()`;
- a response after `deferReply` calls `interaction.editReply()`;
- returning `undefined` leaves response handling to the callback;
- callback, precondition, and Discord response failures use the structured v2 error pipeline.

Message commands continue to use `message.reply()` or `message.channel.send()` according to their resolved `reply` setting.
