import type { CommandObject } from "../../typings";
import type CommandType from "../util/CommandType";
import { CommandDefinitionError } from "../errors/CommandDefinitionError";
import {
  isPreconditionSingleResolvable,
  PreconditionArrayResolvable,
  PreconditionEntryResolvable,
  PreconditionSingleResolvableDetails,
} from "./containers/PreconditionContainer";
import { PreconditionContainerArray } from "./containers/PreconditionContainerArray";
import type { PreconditionLookup } from "./PreconditionStore";

interface ResolveCommandPreconditionsOptions {
  commandName: string;
  commandType: CommandType;
  filePath?: string;
}

export function resolveCommandPreconditions(
  store: PreconditionLookup,
  entries: CommandObject["preconditions"],
  options: ResolveCommandPreconditionsOptions,
): PreconditionContainerArray {
  if (entries !== undefined && !Array.isArray(entries)) {
    throw definitionError(options, "Preconditions must be an array.");
  }

  const runtimeEntries = (entries ?? []) as PreconditionArrayResolvable;
  validateEntries(store, runtimeEntries, options, 0);

  return new PreconditionContainerArray(store, runtimeEntries);
}

function validateEntries(
  store: PreconditionLookup,
  entries: PreconditionArrayResolvable,
  options: ResolveCommandPreconditionsOptions,
  depth: number,
): void {
  if (depth > 0 && entries.length === 0) {
    throw definitionError(
      options,
      "Nested precondition groups cannot be empty.",
    );
  }

  for (const entry of entries) {
    if (Array.isArray(entry)) {
      validateEntries(
        store,
        entry as PreconditionArrayResolvable,
        options,
        depth + 1,
      );
      continue;
    }

    if (!isPreconditionSingleResolvable(entry as PreconditionEntryResolvable)) {
      throw definitionError(options, "Invalid precondition entry.");
    }

    validateSingle(
      store,
      entry as string | PreconditionSingleResolvableDetails,
      options,
    );
  }
}

function validateSingle(
  store: PreconditionLookup,
  entry: string | PreconditionSingleResolvableDetails,
  options: ResolveCommandPreconditionsOptions,
): void {
  const name = typeof entry === "string" ? entry : entry.name;
  if (!name) {
    throw definitionError(options, "Precondition names cannot be empty.");
  }

  if (
    typeof entry !== "string" &&
    entry.context !== undefined &&
    (typeof entry.context !== "object" ||
      entry.context === null ||
      Array.isArray(entry.context))
  ) {
    throw definitionError(
      options,
      `The context for precondition "${name}" must be an object.`,
    );
  }

  const precondition = store.get(name);
  if (!precondition) {
    throw definitionError(
      options,
      `The precondition "${name}" is not registered.`,
    );
  }

  if (
    options.commandType !== "SLASH" &&
    typeof precondition.messageRun !== "function"
  ) {
    throw definitionError(
      options,
      `The precondition "${name}" does not support message commands.`,
    );
  }

  if (
    options.commandType !== "LEGACY" &&
    typeof precondition.chatInputRun !== "function"
  ) {
    throw definitionError(
      options,
      `The precondition "${name}" does not support chat-input commands.`,
    );
  }
}

function definitionError(
  options: ResolveCommandPreconditionsOptions,
  message: string,
): CommandDefinitionError {
  return new CommandDefinitionError(
    `Command "${options.commandName}" has invalid preconditions: ${message}`,
    {
      commandName: options.commandName,
      filePath: options.filePath,
    },
  );
}
