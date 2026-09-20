# V2 command deployment and migration

V2 separates local command loading from Discord application-command deployment. `SWAG.create()` reads and validates command definitions without contacting Discord's application-command API. After the Discord client is ready, call `deployCommands()` explicitly to synchronize the desired commands.

## Deploy after the Discord client is ready

```ts
import { once } from "node:events";
import {
  Client,
  Events,
  GatewayIntentBits,
} from "discord.js";
import SWAG from "swagcommands";

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const swag = await SWAG.create({
  client,
  commandsDir: "./commands",
  subcommandsDir: "./subcommands",
  testServers: ["TEST_GUILD_ID"],
  botOwners: ["YOUR_DISCORD_USER_ID"],
});

await client.login(process.env.DISCORD_TOKEN);

if (!client.isReady()) {
  await once(client, Events.ClientReady);
}

const result = await swag.deployCommands();
console.log(result.targets);
```

SWAGCommands initialization and Discord client readiness are separate states. `swag.isReady()` means local framework initialization is complete; deployment additionally requires `client.isReady()` and `client.application`.

Calling deployment before the Discord client is ready rejects with a `CommandDeploymentError`. It does not change a successfully initialized SWAGCommands instance from `"ready"` to `"failed"`.

## Deployment scopes

`deployCommands()` defaults to synchronizing every configured scope:

```ts
await swag.deployCommands();
// Equivalent to:
await swag.deployCommands({ scope: "all" });
```

The available scopes are:

| Scope | Commands synchronized | Discord target |
| --- | --- | --- |
| `"global"` | `SLASH` and `BOTH` commands without `testOnly`, plus non-test subcommand roots | Global application commands |
| `"test"` | Commands and subcommand roots with `testOnly: true` | Every configured test guild |
| `"all"` | Both manifests | Global application commands followed by test guilds |

Message-only commands are never included. Command aliases remain message-command aliases and do not become additional application commands.

Synchronize only one kind of target when needed:

```ts
await swag.deployCommands({ scope: "global" });
await swag.deployCommands({ scope: "test" });
```

By default, test deployment uses the `testServers` supplied to `SWAG.create()`. Override those guilds for one deployment with `testGuildIds`:

```ts
await swag.deployCommands({
  scope: "test",
  testGuildIds: ["GUILD_A", "GUILD_B"],
});
```

Duplicate guild IDs are synchronized once, in deterministic ID order. Global synchronization always runs before test-guild synchronization when using `scope: "all"`.

## Synchronization is authoritative

Deployment uses Discord's bulk application-command replacement endpoint for each target. The local manifest is the complete desired state for that target:

- Missing remote commands are created.
- Changed remote commands are replaced with their local definitions.
- Remote commands absent from the local manifest are deleted.
- An empty local manifest clears the targeted scope.

> **Warning:** SWAGCommands owns every application command in a synchronized target. A command registered by another script or framework is deleted if it is not also present in the SWAGCommands manifest for that scope.

Global and guild commands are separate Discord scopes. Test-guild manifests contain only `testOnly` commands; global commands remain visible in those guilds through Discord's global command registration.

Global command changes may take longer to propagate through Discord than guild command changes.

## Delete or rename a command

To delete one command:

1. Remove its local command file or subcommand root.
2. Synchronize its current scope.

```ts
await swag.deployCommands({ scope: "global" });
```

The remote command is omitted from the new manifest and Discord deletes it. Renaming behaves the same way: the previous name is removed and the new name is created during synchronization.

V2 no longer supports `delete: true` command definitions. Do not keep tombstone files for removed commands.

## Clear an entire scope

Use `clearCommands()` when the desired outcome is explicitly empty, or when the target is no longer represented by the current configuration:

```ts
await swag.clearCommands({ scope: "global" });

await swag.clearCommands({
  scope: "guild",
  guildId: "OLD_TEST_GUILD_ID",
});
```

Clearing a guild is particularly important when removing it from `testServers`. SWAGCommands cannot discover guild IDs used by earlier deployments, so clear the old guild explicitly before or after changing the configuration.

`clearCommands()` affects exactly one requested scope. Clearing guild commands does not remove global commands, and clearing global commands does not remove guild commands.

## Move commands between scopes

The root command's `testOnly` setting determines its deployment manifest:

```ts
export default {
  type: CommandType.SLASH,
  description: "Preview a feature",
  testOnly: true,
  callback: async () => "Preview enabled",
};
```

When changing `testOnly` from `false` to `true`, or from `true` to `false`, synchronize both scopes:

```ts
await swag.deployCommands({ scope: "all" });
```

This removes the command from its old scope and registers it in the new scope. Deploying only the new scope would leave the old registration in place.

For subcommands, deployment scope is determined by `testOnly` on the root subcommand definition rather than individual leaf options.

## Results and failures

Successful deployments return the targets and command names that were synchronized:

```ts
const result = await swag.deployCommands();

for (const target of result.targets) {
  console.log(target.scope, target.guildId, target.commandNames);
}
```

Multiple targets are synchronized independently and the operation is not transactional. If a later target fails, earlier successful targets are not rolled back. `CommandDeploymentError.completedTargets` reports those successful targets, while the error context identifies the failed target:

```ts
import {
  CommandDeploymentError,
} from "swagcommands";

try {
  await swag.deployCommands();
} catch (error) {
  if (error instanceof CommandDeploymentError) {
    console.error(error.code); // SWAG_COMMAND_DEPLOYMENT_FAILED
    console.error(error.context.deploymentScope); // global or guild
    console.error(error.context.guildId); // present for a guild failure
    console.error(error.completedTargets);
    console.error(error.cause);
  }

  throw error;
}
```

Deployment errors reject the public method directly so deployment scripts and CI can fail visibly. They are not routed through the runtime `onError` callback. Invalid local manifests, such as duplicate root command names in one scope, reject with `CommandDefinitionError` before any Discord scope is modified.

## V1 migration

1. Keep initialization and deployment separate:

   ```ts
   const swag = await SWAG.create(options);
   await client.login(token);
   await swag.deployCommands();
   ```

2. Do not expect constructors or command loading to create, edit, or delete Discord commands.
3. Remove `delete: true` tombstone definitions. Delete the file and synchronize its scope instead.
4. Use `clearCommands()` to clean a global scope or a test guild that is no longer configured.
5. Review `testOnly` definitions. They deploy only to `testServers`; non-test definitions deploy globally.
6. Deploy `scope: "all"` after moving a command between global and test deployment.
7. Ensure SWAGCommands is the only owner of synchronized command scopes, or include externally managed commands in the same desired manifest.
8. Handle rejected deployment promises in startup scripts and CI.

This explicit workflow makes startup deterministic: local loading can be tested without Discord credentials, while remote command changes occur only when application code deliberately requests them.
