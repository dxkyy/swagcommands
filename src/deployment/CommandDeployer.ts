import { Client } from "discord.js";

import {
  buildCommandManifests,
  CommandManifestSources,
} from "./CommandManifestBuilder";

export type CommandDeploymentScope = "global" | "test" | "all";

export interface DeployCommandsOptions {
  scope?: CommandDeploymentScope;
  testGuildIds?: readonly string[];
}

export type CommandDeploymentTarget =
  | { scope: "global" }
  | { scope: "guild"; guildId: string };

export type CommandDeploymentTargetResult = CommandDeploymentTarget & {
  commandNames: readonly string[];
};

export interface CommandDeploymentResult {
  targets: readonly CommandDeploymentTargetResult[];
}

export type ClearCommandsTarget = CommandDeploymentTarget;

export type CommandManifestSourceProvider = () => CommandManifestSources;

export class CommandDeploymentTargetError extends Error {
  public readonly target: Readonly<CommandDeploymentTarget>;
  public readonly completedTargets: readonly CommandDeploymentTargetResult[];

  public constructor(
    target: CommandDeploymentTarget,
    cause: unknown,
    completedTargets: readonly CommandDeploymentTargetResult[] = [],
  ) {
    super(`Failed to synchronize ${formatTarget(target)} commands.`, {
      cause,
    });
    this.name = new.target.name;
    this.target = Object.freeze({ ...target });
    this.completedTargets = Object.freeze([...completedTargets]);
  }
}

export class CommandDeployer {
  private queue: Promise<void> = Promise.resolve();

  public constructor(
    private readonly client: Client,
    private readonly sourceProvider: CommandManifestSourceProvider,
    private readonly defaultTestGuildIds: readonly string[] = [],
  ) {}

  public deploy(
    options: DeployCommandsOptions = {},
  ): Promise<CommandDeploymentResult> {
    return this.enqueue(() => this.performDeployment(options));
  }

  public clear(target: ClearCommandsTarget): Promise<void> {
    return this.enqueue(() => this.performClear(target));
  }

  private async performDeployment(
    options: DeployCommandsOptions,
  ): Promise<CommandDeploymentResult> {
    const commands = this.getApplicationCommands();
    const manifests = buildCommandManifests(this.sourceProvider());
    const scope = options.scope ?? "all";
    const guildIds = normalizeGuildIds(
      options.testGuildIds ?? this.defaultTestGuildIds,
    );
    const completedTargets: CommandDeploymentTargetResult[] = [];

    if (scope === "global" || scope === "all") {
      const target: CommandDeploymentTarget = { scope: "global" };
      try {
        await commands.set(manifests.global);
      } catch (error) {
        throw new CommandDeploymentTargetError(
          target,
          error,
          completedTargets,
        );
      }
      completedTargets.push({
        ...target,
        commandNames: getCommandNames(manifests.global),
      });
    }

    if (scope === "test" || scope === "all") {
      for (const guildId of guildIds) {
        const target: CommandDeploymentTarget = { scope: "guild", guildId };
        try {
          await commands.set(manifests.test, guildId);
        } catch (error) {
          throw new CommandDeploymentTargetError(
            target,
            error,
            completedTargets,
          );
        }
        completedTargets.push({
          ...target,
          commandNames: getCommandNames(manifests.test),
        });
      }
    }

    return {
      targets: Object.freeze(completedTargets),
    };
  }

  private async performClear(target: ClearCommandsTarget): Promise<void> {
    const commands = this.getApplicationCommands();

    try {
      if (target.scope === "global") {
        await commands.set([]);
      } else {
        await commands.set([], target.guildId);
      }
    } catch (error) {
      throw new CommandDeploymentTargetError(target, error);
    }
  }

  private getApplicationCommands() {
    if (!this.client.isReady() || !this.client.application) {
      throw new Error(
        "The Discord client must be logged in and ready before commands can be deployed.",
      );
    }

    return this.client.application.commands;
  }

  private enqueue<Result>(operation: () => Promise<Result>): Promise<Result> {
    const result = this.queue.then(operation);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

function normalizeGuildIds(guildIds: readonly string[]): string[] {
  return [...new Set(guildIds)].sort((left, right) =>
    left.localeCompare(right),
  );
}

function getCommandNames(
  commands: readonly { name: string }[],
): readonly string[] {
  return Object.freeze(commands.map((command) => command.name));
}

function formatTarget(target: CommandDeploymentTarget): string {
  return target.scope === "global"
    ? "global"
    : `guild ${target.guildId}`;
}
