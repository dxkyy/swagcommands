import type { Client } from "discord.js";
import type SWAG from "../SWAG";
import { FeatureExecutionError } from "../errors/FeatureExecutionError";
import { FeatureDefinitionError } from "../errors/FeatureDefinitionError";
import {
  discoverFeatures,
  type DiscoveredFeature,
} from "../features/discover-features";
import { FeaturePhase } from "../features/FeaturePhase";

class FeaturesHandler {
  private readonly controller = new AbortController();
  private readonly phaseRuns = new Map<FeaturePhase, Promise<void>>();
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
        throw new FeatureDefinitionError(
          `Recurring feature "${feature.name}" cannot start until recurring scheduling is implemented.`,
          { featureName: feature.name, filePath: feature.filePath },
        );
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
}

export default FeaturesHandler;
