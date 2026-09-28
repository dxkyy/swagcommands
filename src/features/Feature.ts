import type { Client } from "discord.js";
import type SWAGCommands from "../SWAG";
import type { Awaitable } from "../types";
import { FeaturePhase } from "./FeaturePhase";

export interface FeatureContext {
  client: Client;
  instance: SWAGCommands;
  signal: AbortSignal;
}

export type FeatureCleanup = () => Awaitable<void>;

export type FeatureFunction = (
  context: FeatureContext,
) => Awaitable<void | FeatureCleanup>;

export interface FeatureDefinitionBase {
  name?: string;
  phase?: FeaturePhase;
}

export interface OneTimeFeature extends FeatureDefinitionBase {
  everyMs?: never;
  runOnStart?: never;
  run: FeatureFunction;
}

export interface RecurringFeature extends FeatureDefinitionBase {
  everyMs: number;
  runOnStart?: boolean;
  run: (context: FeatureContext) => Awaitable<void>;
}

export type FeatureDefinition = OneTimeFeature | RecurringFeature;

export type Feature = FeatureFunction | FeatureDefinition;
