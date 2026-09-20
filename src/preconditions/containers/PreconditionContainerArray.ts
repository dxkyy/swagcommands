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
import type { PreconditionLookup } from "../PreconditionStore";
import {
  isPreconditionSingleResolvable,
  isPreconditionGroupResolvable,
  PreconditionArrayResolvable,
  PreconditionCheckResult,
  PreconditionCommit,
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
    private readonly store: PreconditionLookup,
    data: PreconditionArrayResolvable = [],
    runCondition: PreconditionRunCondition = PreconditionRunCondition.And,
  ) {
    this.runCondition = runCondition;

    if (runCondition === PreconditionRunCondition.Or && data.length === 0) {
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

  public messageCheck(
    usage: MessageCommandUsage,
    command: Command,
    context: PreconditionContext = {},
  ): Promise<PreconditionCheckResult> {
    return this.check((entry) => entry.messageCheck(usage, command, context));
  }

  public chatInputCheck(
    usage: ChatInputCommandUsage,
    command: PreconditionCommand,
    context: PreconditionContext = {},
  ): Promise<PreconditionCheckResult> {
    return this.check((entry) =>
      entry.chatInputCheck(usage, command, context),
    );
  }

  private createContainer(
    entry: PreconditionEntryResolvable,
  ): PreconditionContainer {
    if (isPreconditionSingleResolvable(entry)) {
      return new PreconditionContainerSingle(this.store, entry);
    }

    if (isPreconditionGroupResolvable(entry)) {
      if ("any" in entry) {
        return new PreconditionContainerArray(
          this.store,
          entry.any,
          PreconditionRunCondition.Or,
        );
      }

      return new PreconditionContainerArray(
        this.store,
        entry.all,
        PreconditionRunCondition.And,
      );
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

  private async check(
    runner: (entry: PreconditionContainer) => Promise<PreconditionCheckResult>,
  ): Promise<PreconditionCheckResult> {
    if (this.runCondition === PreconditionRunCondition.And) {
      const commits: PreconditionCommit[] = [];
      for (const entry of this.entries) {
        const result = await runner(entry);
        if (!result.success) return result;
        commits.push(...result.commits);
      }
      return { commits: Object.freeze(commits), success: true };
    }

    let lastFailure: Extract<PreconditionResult, { success: false }> | undefined;
    for (const entry of this.entries) {
      const result = await runner(entry);
      if (result.success) return result;
      lastFailure = result;
    }

    return lastFailure ?? createPreconditionFailure("PreconditionContainer", {
      identifier: "PRECONDITION_EMPTY_OR_GROUP",
      message: "An OR precondition group did not contain any entries.",
    });
  }
}
