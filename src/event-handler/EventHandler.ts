import { Client, Interaction, InteractionType, Message } from "discord.js";
import path from "path";

import getAllFiles from "../util/get-all-files";
import SWAG, { Events } from "../../typings";
import { EventExecutionError } from "../errors/EventExecutionError";
import { Logger } from "../logger/structures/Logger";

const logger = new Logger();

class EventHandler {
	// <eventName, array of [function, dynamic validation functions]>
	private _eventCallbacks = new Map();
	private _instance: SWAG;
	private _eventsDir: string;
	private _client: Client;
	private _events: Events;
	private _builtInEvents: any;
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

			const functions = this._eventCallbacks.get(event) || [];

			for (const { filePath, fileContents } of files) {
				const isBuiltIn = !folderPath.includes(this._eventsDir);
				const result = [fileContents];

				const split = filePath.split(event)[1].split(/[\/\\]/g);
				const methodName = split[split.length - 2];

				if (
					isBuiltIn &&
					this._builtInEvents[event] &&
					this._builtInEvents[event][methodName]
				) {
					result.push(this._builtInEvents[event][methodName]);
				} else if (this._events[event] && this._events[event][methodName]) {
					result.push(this._events[event][methodName]);
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
			const functions = this._eventCallbacks.get(eventName);

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
