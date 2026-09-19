# V2 initialization and response behavior

V2 makes framework startup explicitly asynchronous and centralizes command, autocomplete, event, and Discord response failures. Command callbacks keep the same convenient return-value API: return a string or a Discord.js response payload and SWAGCommands sends it for you.

## Initialize with `SWAG.create()`

Creating a SWAGCommands instance is now asynchronous. Replace constructor usage with the factory and await it before logging in the Discord client:

```ts
import { Client, GatewayIntentBits } from "discord.js";
import SWAG from "swagcommands";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const swag = await SWAG.create({
  client,
  commandsDir: "./commands",
  subcommandsDir: "./subcommands",
  featuresDir: "./features",
  botOwners: ["YOUR_DISCORD_USER_ID"],
});

await client.login(process.env.DISCORD_TOKEN);
```

`SWAG.create()` resolves only after command, subcommand, feature, and event files have loaded, their asynchronous initialization hooks have completed, and event listeners have been registered. If any of that work fails, the promise rejects with an `InitializationError`; a partially initialized instance is not returned.

The instance exposes `state` and `isReady()` for lifecycle inspection:

```ts
swag.state; // "ready" after SWAG.create() resolves
swag.isReady(); // true
```

Initialization no longer creates, updates, or deletes Discord application commands. Command loading is local-only in v2. Slash-command deployment will be handled separately as part of [issue #68](https://github.com/dxkyy/swagcommands/issues/68).

Supply `botOwners` explicitly when using `ownerOnly` commands. This keeps local initialization independent from Discord application-owner lookups.

## Return Discord.js response values directly

A command callback may return a string, a `MessagePayload`, or the options object accepted by the Discord.js response method used for that invocation:

```ts
export default {
  type: CommandType.BOTH,
  callback: async () => {
    return "Hello world";
  },
};
```

```ts
return {
  content: "Hello world",
};
```

```ts
return {
  embeds: [embed],
  components: [row],
  files: [attachment],
};
```

SWAGCommands forwards the returned value to Discord.js without reconstructing the payload:

| Invocation                         | Framework method                |
| ---------------------------------- | ------------------------------- |
| Fresh interaction                  | `interaction.reply(result)`     |
| Deferred interaction               | `interaction.editReply(result)` |
| Message command with `reply: true` | `message.reply(result)`         |
| Other message commands             | `message.channel.send(result)`  |

Return `undefined` when the callback handles its own response or should not send one. The framework checks specifically for `undefined`; it does not use a broad truthiness check.

## Deferred responses

Set `deferReply` to `true` to acknowledge an interaction before running the callback. The callback's returned value is then passed to `editReply()`:

```ts
export default {
  type: CommandType.SLASH,
  deferReply: true,
  callback: async () => {
    const result = await doSlowWork();
    return { content: result };
  },
};
```

Use the object form for an ephemeral deferred response:

```ts
deferReply: {
  ephemeral: true,
},
```

For message commands, `deferReply` sends the channel typing indicator instead of deferring an interaction.

## Structured errors

Use `onError` to handle framework failures in one place:

```ts
const swag = await SWAG.create({
  client,
  commandsDir: "./commands",
  onError: async (error, context) => {
    console.error(error.code, error.phase, context, error.cause);
  },
});
```

Every framework error extends `SwagError` and includes:

- `code`: a stable, machine-readable error code
- `phase`: `initialization`, `validation`, `execution`, `response`,
  `autocomplete`, or `event`
- `context`: relevant command, subcommand, event, file, and invocation details
- `cause`: the original failure, when one exists

Command callback failures, Discord API response failures, autocomplete failures, and event callback failures are awaited and routed through this hook. Duplicate interaction acknowledgements are reported instead of being silently ignored. Without an `onError` hook, SWAGCommands logs the structured error.

## Autocomplete responses

Autocomplete remains separate from normal command response handling because Discord uses `interaction.respond()` for it. An autocomplete callback returns an array of strings:

```ts
autocomplete: async (_command, _focusedOption, _interaction) => {
  return ["apple", "apricot", "banana"];
},
```

SWAGCommands filters those strings against the focused value, limits the result to Discord's maximum of 25 choices, and awaits `interaction.respond()`. Invalid results and unexpected callback or response failures are reported as `AutocompleteError`. When the interaction is still respondable, the framework attempts to send an empty choice list so Discord can complete the interaction.

## V1 migration checklist

- Replace `new SWAG(options)` with `await SWAG.create(options)`.
- Catch rejected initialization or let it fail application startup explicitly.
- Provide `botOwners` when any command or subcommand uses `ownerOnly`.
- Move slash-command deployment out of command loading.
- Use `deferReply: { ephemeral: true }` for ephemeral deferrals.
- Add `onError` when the application needs custom logging or reporting.
- Keep returning Discord.js strings and payload objects from callbacks as before.
