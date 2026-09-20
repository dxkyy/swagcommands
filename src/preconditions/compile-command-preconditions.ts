import type { PreconditionArrayResolvable } from "../../typings";

interface GuardedCommandDefinition {
  expectedArgs?: string;
  guildOnly?: boolean;
  maxArgs?: number;
  minArgs?: number;
  ownerOnly?: boolean;
  permissions?: readonly bigint[];
  preconditions?: PreconditionArrayResolvable;
  testOnly?: boolean;
}

export function compileCommandPreconditions(
  definition: GuardedCommandDefinition,
): PreconditionArrayResolvable {
  const compiled: unknown[] = [];

  if (definition.guildOnly) compiled.push("GuildOnly");
  if (definition.ownerOnly) compiled.push("OwnerOnly");
  if (definition.testOnly) compiled.push("TestOnly");
  if (definition.permissions?.length) {
    compiled.push({
      context: { permissions: definition.permissions },
      name: "HasPermissions",
    });
  }
  if (definition.minArgs !== undefined || definition.maxArgs !== undefined) {
    compiled.push({
      context: {
        expectedArgs: definition.expectedArgs,
        maxArgs: definition.maxArgs,
        minArgs: definition.minArgs,
      },
      name: "ArgumentCount",
    });
  }

  compiled.push(...(definition.preconditions ?? []));
  return compiled as PreconditionArrayResolvable;
}
