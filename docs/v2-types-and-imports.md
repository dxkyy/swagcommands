# V2 generated types and import migration

V2 publishes JavaScript and TypeScript declarations from the same `src` files. CommonJS uses `dist/index.js` and `dist/index.d.ts`; ESM uses `dist/index.mjs` and `dist/index.d.mts`. The package exports only the root `swagcommands` import; deep imports into `src`, `dist`, or other internal paths are unavailable. The removed root `typings.d.ts` is no longer an import target. The tarball contains the generated declarations alongside the JavaScript files they describe.

## Imports

In TypeScript and ESM projects, use the default export for the framework and named exports for helpers. Use `import type` for contracts:

```ts
import SWAG, { CommandType, MemoryPrefixStore } from "swagcommands";
import type { CommandObject } from "swagcommands";

const prefixStore = new MemoryPrefixStore();
// Pass prefixStore to SWAG.create({ client, prefixStore, ... })
```

The class is also available as a named export, `SWAGCommands`. CommonJS callers using `const SWAG = require("swagcommands")` must use the exported property instead:

```js
const { default: SWAG, CommandType } = require("swagcommands");
// Or: const { SWAGCommands: SWAG } = require("swagcommands");
```

Native Node ESM, including TypeScript files compiled as ESM, can import the class directly:

```js
import SWAG from "swagcommands";
```

Code using named helpers through `require("swagcommands").CommandType` can keep doing so.

If your code imported an internal path such as `swagcommands/dist/types`, replace it with a type import from `swagcommands`. The root export is the supported API boundary for both JavaScript and TypeScript.

## Type checked definitions

Use `satisfies` on each exported command object. It checks the definition and gives the callback a parameter type while preserving the object's inferred properties:

```ts
import { CommandType } from "swagcommands";
import type { CommandObject } from "swagcommands";

const command = {
  type: CommandType.SLASH,
  description: "Greet a user",
  callback: ({ interaction }) => `Hello from ${interaction.commandName}`,
  autocomplete: (_command, focusedOption) => [focusedOption],
} satisfies CommandObject;

export default command;
```

`CommandObject` selects the callback usage from `type`: `LEGACY` has a message, `SLASH` has a chat-input interaction, and `BOTH` accepts either. Autocomplete callbacks return strings or a promise of strings. For subcommands, use `SubcommandObject` on the root and `SubcommandOptionObject` on each leaf. Context menus use `UserContextMenuCommandObject` or `MessageContextMenuCommandObject` to type their selected target. See [V2 command definitions and routing](v2-command-support.md) for examples.

Feature definitions use the exported `Feature` type and `FeaturePhase` enum. See [V2 features](v2-features.md) for one-time and recurring examples.

## Custom precondition names

Augment `Preconditions` through the package entry point to check custom names and required context in command definitions:

```ts
import type { PreconditionArrayResolvable } from "swagcommands";

declare module "swagcommands" {
  interface Preconditions {
    MinimumLevel: { level: number };
  }
}

const checks = [
  { name: "MinimumLevel", context: { level: 3 } },
] satisfies PreconditionArrayResolvable;
```

Put the augmentation in a `.ts` or `.d.ts` file included by your project's TypeScript configuration. A precondition with required context cannot use the string shorthand. The framework still needs a matching runtime precondition registered under that name; augmentation only checks your TypeScript code. See [V2 preconditions and cooldowns](v2-preconditions-and-cooldowns.md) for registration and composition.

## Building and checking the package

`npm run build` emits the JavaScript and declaration files in `dist`. `npm pack` runs the build through `prepack`. `npm test` runs the runtime suite and then packs the package, compiles consumers against its declarations, and checks its CommonJS and ESM exports. `npm run test:typecheck` checks the source and test types. Run these checks before publishing a v2 release.
