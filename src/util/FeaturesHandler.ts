import type { Client } from "discord.js";
import type SWAG from "../SWAG";
import { FeatureExecutionError } from "../errors/FeatureExecutionError";
import { FeatureCleanupError } from "../errors/FeatureCleanupError";
import type { FeatureCleanup } from "../features/Feature";
import { Logger } from "../logger/structures/Logger";
import {
  discoverFeatures,
  type DiscoveredFeature,
} from "../features/discover-features";
import { FeaturePhase } from "../features/FeaturePhase";

const logger = new Logger();

interface RecurringRun {
  feature: Extract<DiscoveredFeature, { kind: "recurring" }>;
  timer?: ReturnType<typeof setTimeout>;
  inFlight?: Promise<void>;
}

class FeaturesHandler {
  private readonly controller = new AbortController();
  private readonly phaseRuns = new Map<FeaturePhase, Promise<void>>();
  private readonly recurring = new Map<string, RecurringRun>();
  private readonly cleanups: Array<{
    feature: DiscoveredFeature;
    cleanup: FeatureCleanup;
  }> = [];
  private features: DiscoveredFeature[] = [];
  private loading: Promise<void> | undefined;
  private stopping: Promise<void> | undefined;

  public constructor(
    private readonly instance: SWAG,
    private readonly featuresDir: string,
    private readonly client: Client,
  ) {}

  public load(): Promise<void> {
    this.loading ??= Promise.resolve().then(() => {
      this.features = discoverFeatures(this.featuresDir);
    });
    return this.loading;
  }

  public runPhase(phase: FeaturePhase): Promise<void> {
    let run = this.phaseRuns.get(phase);
    if (!run) {
      run = this.executePhase(phase);
      this.phaseRuns.set(phase, run);
    }
    return run;
  }

  public hasPhase(phase: FeaturePhase): boolean {
    return this.features.some((feature) => feature.phase === phase);
  }

  public get signal(): AbortSignal {
    return this.controller.signal;
  }

  public stop(): Promise<void> {
    if (!this.stopping) {
      this.controller.abort();
      for (const state of this.recurring.values()) {
        if (state.timer) {
          clearTimeout(state.timer);
          state.timer = undefined;
        }
      }
      this.stopping = this.finishStop();
    }
    return this.stopping;
  }

  private async finishStop(): Promise<void> {
    await Promise.allSettled(this.phaseRuns.values());
    await Promise.allSettled(
      [...this.recurring.values()].map((state) => state.inFlight),
    );

    const failures: FeatureCleanupError[] = [];
    for (const { feature, cleanup } of this.cleanups.reverse()) {
      try {
        await cleanup();
      } catch (error) {
        failures.push(new FeatureCleanupError(error, {
          featureName: feature.name,
          filePath: feature.filePath,
        }));
      }
    }
    this.cleanups.length = 0;

    if (failures.length === 1) {
      throw failures[0];
    }
    if (failures.length > 1) {
      throw new AggregateError(failures, "Multiple feature cleanups failed.");
    }
  }

  private async executePhase(phase: FeaturePhase): Promise<void> {
    await this.load();

    for (const feature of this.features) {
      if (this.controller.signal.aborted) {
        throw new Error("Features have been stopped.");
      }
      if (feature.phase !== phase) {
        continue;
      }
      if (feature.kind === "recurring") {
        this.startRecurring(feature);
        continue;
      }

      try {
        const cleanup = await feature.run({
          client: this.client,
          instance: this.instance,
          signal: this.controller.signal,
        });
        if (cleanup !== undefined) {
          if (typeof cleanup !== "function") {
            throw new TypeError(
              `Feature "${feature.name}" must return a cleanup function or undefined.`,
            );
          }
          this.cleanups.push({ feature, cleanup });
        }
      } catch (error) {
        throw new FeatureExecutionError(error, {
          featureName: feature.name,
          filePath: feature.filePath,
        });
      }
    }
  }

  private startRecurring(
    feature: Extract<DiscoveredFeature, { kind: "recurring" }>,
  ): void {
    const state: RecurringRun = { feature };
    this.recurring.set(feature.name, state);
    if (feature.runOnStart) {
      state.inFlight = this.runRecurring(state);
    } else {
      this.scheduleNext(state);
    }
  }

  private scheduleNext(state: RecurringRun): void {
    if (this.controller.signal.aborted) {
      return;
    }
    state.timer = setTimeout(() => {
      state.timer = undefined;
      state.inFlight = this.runRecurring(state);
    }, state.feature.everyMs);
  }

  private async runRecurring(state: RecurringRun): Promise<void> {
    const feature = state.feature;
    try {
      await feature.run({
        client: this.client,
        instance: this.instance,
        signal: this.controller.signal,
      });
    } catch (error) {
      if (!this.controller.signal.aborted) {
        try {
          await this.instance.reportError(new FeatureExecutionError(error, {
            featureName: feature.name,
            filePath: feature.filePath,
          }));
        } catch (reportingError) {
          logger.error(
            `[SWAG_FEATURE_ERROR_HANDLER_FAILED] Failed to report an error from feature "${feature.name}".`,
            reportingError,
          );
        }
      }
    } finally {
      this.scheduleNext(state);
    }
  }
}

export default FeaturesHandler;
