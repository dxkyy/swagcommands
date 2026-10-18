import path from "path";
import { FeatureDefinitionError } from "../errors/FeatureDefinitionError";
import getAllFiles from "../util/get-all-files";
import type {
  FeatureFunction,
  RecurringFeature,
} from "./Feature";
import { FeaturePhase } from "./FeaturePhase";

interface DiscoveredFeatureBase {
  filePath: string;
  name: string;
  phase: FeaturePhase;
}

export type DiscoveredFeature = DiscoveredFeatureBase &
  (
    | { kind: "once"; run: FeatureFunction }
    | {
        kind: "recurring";
        everyMs: number;
        runOnStart: boolean;
        run: RecurringFeature["run"];
      }
  );

const phases = new Set<string>(Object.values(FeaturePhase));

function nameFromPath(featuresDir: string, filePath: string): string {
  return path
    .relative(featuresDir, filePath)
    .replace(/\.(?:js|ts)$/, "")
    .split(path.sep)
    .join("/");
}

function invalid(
  message: string,
  filePath: string,
  featureName?: string,
): never {
  throw new FeatureDefinitionError(message, { filePath, featureName });
}

function normalizeFeature(
  value: unknown,
  filePath: string,
  featuresDir: string,
): DiscoveredFeature {
  const derivedName = nameFromPath(featuresDir, filePath);

  if (typeof value === "function") {
    return {
      filePath,
      kind: "once",
      name: derivedName,
      phase: FeaturePhase.ClientReady,
      run: value as FeatureFunction,
    };
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    invalid(`Feature file "${filePath}" must export a function or feature object.`, filePath);
  }

  const definition = value as Record<string, unknown>;
  if (typeof definition.run !== "function") {
    invalid(`Feature file "${filePath}" must define a run function.`, filePath);
  }

  if (
    definition.name !== undefined &&
    (typeof definition.name !== "string" || definition.name.trim() === "")
  ) {
    invalid(`Feature file "${filePath}" has an invalid name.`, filePath);
  }
  const name = typeof definition.name === "string"
    ? definition.name.trim()
    : derivedName;

  if (definition.phase !== undefined && !phases.has(definition.phase as string)) {
    invalid(`Feature "${name}" has an invalid phase.`, filePath, name);
  }
  const phase = (definition.phase as FeaturePhase | undefined) ?? FeaturePhase.ClientReady;
  const base = { filePath, name, phase };

  if (definition.everyMs === undefined) {
    if (definition.runOnStart !== undefined) {
      invalid(`Feature "${name}" cannot use runOnStart without everyMs.`, filePath, name);
    }
    return { ...base, kind: "once", run: definition.run as FeatureFunction };
  }

  if (
    typeof definition.everyMs !== "number" ||
    !Number.isFinite(definition.everyMs) ||
    definition.everyMs <= 0 ||
    definition.everyMs > 2_147_483_647
  ) {
    invalid(`Feature "${name}" must set everyMs above 0 and at most 2,147,483,647 milliseconds.`, filePath, name);
  }
  if (
    definition.runOnStart !== undefined &&
    typeof definition.runOnStart !== "boolean"
  ) {
    invalid(`Feature "${name}" must set runOnStart to a boolean.`, filePath, name);
  }

  return {
    ...base,
    everyMs: definition.everyMs as number,
    kind: "recurring",
    run: definition.run as RecurringFeature["run"],
    runOnStart: (definition.runOnStart as boolean | undefined) ?? false,
  };
}

export function discoverFeatures(featuresDir: string): DiscoveredFeature[] {
  const files = getAllFiles(featuresDir).sort((a, b) =>
    a.filePath < b.filePath ? -1 : a.filePath > b.filePath ? 1 : 0,
  );
  const features: DiscoveredFeature[] = [];
  const names = new Map<string, string>();

  for (const { fileContents, filePath } of files) {
    const feature = normalizeFeature(fileContents, filePath, featuresDir);
    const previousPath = names.get(feature.name);
    if (previousPath !== undefined) {
      invalid(
        `Feature "${feature.name}" is defined in both "${previousPath}" and "${filePath}".`,
        filePath,
        feature.name,
      );
    }
    names.set(feature.name, filePath);
    features.push(feature);
  }

  return features;
}
