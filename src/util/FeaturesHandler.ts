import type { Client } from "discord.js";
import type SWAG from "../SWAG";
import { FeatureExecutionError } from "../errors/FeatureExecutionError";
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
  private features: DiscoveredFeature[] = [];
  private loading: Promise<void> | undefined;

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

  private async executePhase(phase: FeaturePhase): Promise<void> {
    await this.load();

    for (const feature of this.features) {
      if (feature.phase !== phase) {
        continue;
      }
      if (feature.kind === "recurring") {
        this.startRecurring(feature);
        continue;
      }

      try {
        await feature.run({
          client: this.client,
          instance: this.instance,
          signal: this.controller.signal,
        });
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
    } finally {
      this.scheduleNext(state);
    }
  }
}

export default FeaturesHandler;
