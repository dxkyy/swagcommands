import { Client, Interaction, InteractionType, Message } from "discord.js";
import path from "path";

import getAllFiles from "../util/get-all-files";
import type SWAG from "../SWAG";
import type { Events } from "../types";
import { EventExecutionError } from "../errors/EventExecutionError";
import { Logger } from "../logger/structures/Logger";

const logger = new Logger();
type EventCallback = (...args: unknown[]) => unknown;
type EventEntry = [EventCallback, EventCallback?];

class EventHandler {
	// <eventName, array of [function, dynamic validation functions]>
	private _eventCallbacks = new Map<string, EventEntry[]>();
	private _instance: SWAG;
	private _eventsDir: string | undefined;
	private _client: Client;
	private _events: Events;
	private _builtInEvents: Record<string, Record<string, unknown>>;
	private _loading: Promise<void> | undefined;
	private _registered = false;

	constructor(instance: SWAG, events: Events, client: Client) {
		this._instance = instance;
		this._eventsDir = events?.dir;
		this._events = events;
		this._client = client;

		this._builtInEvents = {
			interactionCreate: {
				isButton: (interaction: Interaction) => interaction.isButton(),
				isChatInputCommand: (interaction: Interaction) =>
					interaction.isChatInputCommand(),
				isContextMenuCommand: (interaction: Interaction) =>
					interaction.isContextMenuCommand(),
				isCommand: (interaction: Interaction) =>
					interaction.type === InteractionType.ApplicationCommand,
				isAutocomplete: (interaction: Interaction) =>
					interaction.type === InteractionType.ApplicationCommandAutocomplete,
			},
			messageCreate: {
				isHuman: (message: Message) => !message.author.bot,
			},
		};

	}

	public load(): Promise<void> {
		this._loading ??= this.readFiles();
		return this._loading;
	}

	private async readFiles() {
		const defaultEvents = getAllFiles(path.join(__dirname, "events"), true);
		const folders = this._eventsDir ? getAllFiles(this._eventsDir, true) : [];

		for (const { filePath: folderPath } of [...defaultEvents, ...folders]) {
			const event = folderPath.split(/[\/\\]/g).pop()!;
			const files = getAllFiles(folderPath);

			const functions = this._eventCallbacks.get(event) ?? [];

			for (const { filePath, fileContents } of files) {
				if (typeof fileContents !== "function") {
					throw new TypeError(`Event file "${filePath}" must export a function.`);
				}
				const isBuiltIn = !this._eventsDir || !folderPath.includes(this._eventsDir);
				const result: EventEntry = [fileContents as EventCallback];

				const split = filePath.split(event)[1].split(/[\/\\]/g);
				const methodName = split[split.length - 2];

				const builtIn = this._builtInEvents[event]?.[methodName];
				const configured = this._events[event];
				const custom = configured && typeof configured === "object"
					? (configured as Record<string, unknown>)[methodName]
					: undefined;
				const validation = isBuiltIn && typeof builtIn === "function"
					? builtIn
					: custom;
				if (typeof validation === "function") {
					result.push(validation as EventCallback);
				}

				functions.push(result);
			}

			this._eventCallbacks.set(event, functions);
		}
	}

	registerEvents() {
		if (this._registered) {
			return;
		}
		this._registered = true;

		const instance = this._instance;

		for (const eventName of this._eventCallbacks.keys()) {
			const functions = this._eventCallbacks.get(eventName) ?? [];

			this._client.on(eventName, async (...args: unknown[]) => {
				for (const [func, dynamicValidation] of functions) {
					try {
						if (dynamicValidation && !(await dynamicValidation(...args))) {
							continue;
						}

						await func(...args, instance);
					} catch (error) {
						try {
							await instance.reportError(
								new EventExecutionError(error, { eventName }),
							);
						} catch (reportingError) {
							logger.error(
								`[SWAG_EVENT_ERROR_HANDLER_FAILED] Failed to report an error from event "${eventName}".`,
								reportingError,
							);
						}
						return;
					}
				}
			});
		}
	}
}

export default EventHandler;
