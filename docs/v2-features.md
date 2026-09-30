# V2 features

Features are startup tasks and optional recurring jobs. Put one default-exported function or definition object in each file under `featuresDir`. Use an event file for a Discord event callback; a feature runs at a startup phase and can continue on a timer.

## Start and stop features

```ts
import { Client, GatewayIntentBits } from "discord.js";
import SWAG from "swagcommands";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const swag = await SWAG.create({
  client,
  commandsDir: "./commands",
  featuresDir: "./features",
});

await client.login(process.env.DISCORD_TOKEN);
await swag.startFeatures();

// During application shutdown:
await swag.stopFeatures();
client.destroy();
```

`SWAG.create()` discovers feature files, runs `BeforeCommands` features, loads commands, context menus, and subcommands, then runs `AfterCommands` features. `startFeatures()` waits for the Discord client to become ready before running `ClientReady` features. Calling it again does not rerun a phase. Call `stopFeatures()` when shutting down; it is safe to call more than once. Once stopped, features cannot be started again on that instance.

## Run once

A default-exported function runs once at `FeaturePhase.ClientReady`. It receives the client, the SWAGCommands instance, and an abort signal:

```ts
// features/report-startup.ts
import type { FeatureFunction } from "swagcommands";

const reportStartup: FeatureFunction = ({ client }) => {
  console.info(`Connected as ${client.user?.tag}`);
};

export default reportStartup;
```

Use an object to choose another phase. This example builds a command name index after command loading. Its returned function clears the index during shutdown:

```ts
// features/command-index.ts
import { FeaturePhase } from "swagcommands";
import type { Feature } from "swagcommands";

export const commandNames = new Set<string>();

const commandIndex = {
  phase: FeaturePhase.AfterCommands,
  run: ({ instance }) => {
    for (const command of instance.listCommands()) {
      commandNames.add(command.name);
    }
    return () => commandNames.clear();
  },
} satisfies Feature;

export default commandIndex;
```

An object without `everyMs` also runs just once. `BeforeCommands` is useful for setup that command loading needs; command metadata is available from `AfterCommands` onward.

## Run repeatedly

Set `everyMs` to run a feature repeatedly. `runOnStart: true` starts its first run when the phase starts; otherwise it waits one interval before the first run:

```ts
// features/guild-count.ts
import { FeaturePhase } from "swagcommands";
import type { Feature } from "swagcommands";

const guildCount = {
  phase: FeaturePhase.ClientReady,
  everyMs: 5 * 60_000,
  runOnStart: true,
  run: async ({ client, signal }) => {
    if (signal.aborted) return;
    console.info(`Guilds in cache: ${client.guilds.cache.size}`);
  },
} satisfies Feature;

export default guildCount;
```

The next interval begins after the current run finishes, so runs of the same feature do not overlap. `everyMs` must be greater than zero and at most 2,147,483,647. Recurring features cannot return cleanup functions; use the abort signal to stop ongoing work cooperatively. `stopFeatures()` clears pending timers and waits for in-flight runs. It does not automatically cancel external requests made by a feature.

| Phase | When it starts |
| --- | --- |
| `FeaturePhase.BeforeCommands` | During `SWAG.create()`, before command loading |
| `FeaturePhase.AfterCommands` | During `SWAG.create()`, after command loading |
| `FeaturePhase.ClientReady` | Through `startFeatures()`, after the Discord client is ready |

Omitting `phase` selects `ClientReady`, for both one-time and recurring objects. `runOnStart` applies only when `everyMs` is set. One-time features are awaited before their phase completes. An immediate recurring run is started without waiting for that run to finish.

## Files, errors, and cleanup

Feature files are discovered recursively from `featuresDir`. Their relative path without `.js` or `.ts` is the default name: `features/reports/daily.ts` becomes `reports/daily`. An object can set `name` explicitly. Names must be unique, and files run in path order within each phase. In a compiled project, point `featuresDir` at the emitted JavaScript directory. Modules are imported during discovery, so top-level module code executes during `SWAG.create()` even if its feature is assigned to `ClientReady`.

Invalid definitions and duplicate names fail initialization. A one-time feature failure rejects `SWAG.create()` or `startFeatures()`, depending on its phase. Already registered cleanup functions run in reverse order during rollback. A recurring run failure is sent to `onError` as a `FeatureExecutionError`, or logged if no `onError` callback is configured; later runs are still scheduled. `stopFeatures()` runs one-time cleanup functions in reverse order and reports cleanup failures. Keep cleanup functions safe to run after partial startup.

For a v1 feature directory, review each file's behavior: export a plain function for a one-time client-ready task, or an object for a chosen phase or recurring schedule. Move Discord event listeners to the existing event system, and call `startFeatures()` after login and `stopFeatures()` during shutdown. See [V2 initialization and response behavior](v2-initialization-and-responses.md) for the complete startup flow.
