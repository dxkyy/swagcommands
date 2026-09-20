import type Command from "../../command-handler/Command";
import type {
  ChatInputCommandUsage,
  MessageCommandUsage,
  PreconditionCommand,
  PreconditionContext,
} from "../Precondition";
import {
  createPreconditionFailure,
  createPreconditionSuccess,
  PreconditionFailureResult,
  PreconditionResult,
} from "../PreconditionResult";
import type { PreconditionStore } from "../PreconditionStore";
import {
  isPreconditionSingleResolvable,
  PreconditionArrayResolvable,
  PreconditionContainer,
  PreconditionEntryResolvable,
} from "./PreconditionContainer";
import { PreconditionContainerSingle } from "./PreconditionContainerSingle";

export enum PreconditionRunCondition {
  And = "and",
  Or = "or",
}

type ContainerRunner = (
  entry: PreconditionContainer,
) => Promise<PreconditionResult>;

export class PreconditionContainerArray implements PreconditionContainer {
  public readonly entries: readonly PreconditionContainer[];
  public readonly runCondition: PreconditionRunCondition;

  public constructor(
    private readonly store: PreconditionStore,
    data: PreconditionArrayResolvable = [],
    parent: PreconditionContainerArray | null = null,
  ) {
    this.runCondition =
      parent?.runCondition === PreconditionRunCondition.And
        ? PreconditionRunCondition.Or
        : PreconditionRunCondition.And;

    if (parent && data.length === 0) {
      throw new TypeError("A nested precondition group cannot be empty.");
    }

    this.entries = Object.freeze(
      data.map((entry) => this.createContainer(entry)),
    );
  }

  public messageRun(
    usage: MessageCommandUsage,
    command: Command,
    context: PreconditionContext = {},
  ): Promise<PreconditionResult> {
    return this.run((entry) => entry.messageRun(usage, command, context));
  }

  public chatInputRun(
    usage: ChatInputCommandUsage,
    command: PreconditionCommand,
    context: PreconditionContext = {},
  ): Promise<PreconditionResult> {
    return this.run((entry) => entry.chatInputRun(usage, command, context));
  }

  private createContainer(
    entry: PreconditionEntryResolvable,
  ): PreconditionContainer {
    if (isPreconditionSingleResolvable(entry)) {
      return new PreconditionContainerSingle(this.store, entry);
    }

    if (Array.isArray(entry)) {
      return new PreconditionContainerArray(this.store, entry, this);
    }

    throw new TypeError("Invalid precondition entry.");
  }

  private async run(runner: ContainerRunner): Promise<PreconditionResult> {
    if (this.runCondition === PreconditionRunCondition.And) {
      for (const entry of this.entries) {
        const result = await runner(entry);
        if (!result.success) {
          return result;
        }
      }

      return createPreconditionSuccess();
    }

    let lastFailure: PreconditionFailureResult | undefined;
    for (const entry of this.entries) {
      const result = await runner(entry);
      if (result.success) {
        return result;
      }
      lastFailure = result;
    }

    return (
      lastFailure ??
      createPreconditionFailure("PreconditionContainer", {
        identifier: "PRECONDITION_EMPTY_OR_GROUP",
        message: "An OR precondition group did not contain any entries.",
      })
    );
  }
}
