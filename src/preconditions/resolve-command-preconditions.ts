import type {
  CommandObject,
  PreconditionArrayResolvable as DeclaredPreconditionArrayResolvable,
} from "../../typings";
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

interface ResolveChatInputPreconditionsOptions {
  commandName: string;
  filePath?: string;
  subcommandName?: string;
}

interface ResolvePreconditionsOptions
  extends ResolveChatInputPreconditionsOptions {
  requireChatInput: boolean;
  requireMessage: boolean;
}

export function resolveCommandPreconditions(
  store: PreconditionLookup,
  entries: CommandObject["preconditions"],
  options: ResolveCommandPreconditionsOptions,
): PreconditionContainerArray {
  return resolvePreconditions(store, entries, {
    ...options,
    requireChatInput: options.commandType !== "LEGACY",
    requireMessage: options.commandType !== "SLASH",
  });
}

export function resolveChatInputPreconditions(
  store: PreconditionLookup,
  entries: DeclaredPreconditionArrayResolvable | undefined,
  options: ResolveChatInputPreconditionsOptions,
): PreconditionContainerArray {
  return resolvePreconditions(store, entries, {
    ...options,
    requireChatInput: true,
    requireMessage: false,
  });
}

function resolvePreconditions(
  store: PreconditionLookup,
  entries: DeclaredPreconditionArrayResolvable | undefined,
  options: ResolvePreconditionsOptions,
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
  options: ResolvePreconditionsOptions,
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
  options: ResolvePreconditionsOptions,
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
    options.requireMessage &&
    typeof precondition.messageRun !== "function"
  ) {
    throw definitionError(
      options,
      `The precondition "${name}" does not support message commands.`,
    );
  }

  if (
    options.requireChatInput &&
    typeof precondition.chatInputRun !== "function"
  ) {
    throw definitionError(
      options,
      `The precondition "${name}" does not support chat-input commands.`,
    );
  }
}

function definitionError(
  options: ResolveChatInputPreconditionsOptions,
  message: string,
): CommandDefinitionError {
  const commandIdentity = options.subcommandName
    ? `${options.commandName}/${options.subcommandName}`
    : options.commandName;

  return new CommandDefinitionError(
    `Command "${commandIdentity}" has invalid preconditions: ${message}`,
    {
      commandName: options.commandName,
      filePath: options.filePath,
      subcommandName: options.subcommandName,
    },
  );
}
