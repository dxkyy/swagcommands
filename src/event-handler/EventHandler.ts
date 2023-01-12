import { Client, Interaction, InteractionType, Message } from "discord.js";
import path from "path";
import SWAGCommands from "..";
import { Events } from "../types";
import getAllFiles from "../util/get-all-files";

class EventHandler {
	_eventCallbacks = new Map();
	_instance;
	_eventsDir;
	_client;
	_events;
	_buildInEvents: any;

	constructor(instance: SWAGCommands, events: Events, client: Client) {
		this._instance = instance;
		this._eventsDir = events.dir;
		this._client = client;

		delete events.dir;
		this._events = events;

		this._buildInEvents = {
			interactionCreate: {
				isButton: (interaction: Interaction) => interaction.isButton(),
				isCommand: (interaction: Interaction) =>
					interaction.type === InteractionType.ApplicationCommand ||
					interaction.type === InteractionType.ApplicationCommandAutocomplete,
			},
			messageCreate: {
				isHuman: (message: Message) => !message.author.bot,
			},
		};

		this.readFiles();
		this.registerEvents();
	}

	async readFiles() {
		const defaultEvents = getAllFiles(path.join(__dirname, "events"), true);
		const folders = getAllFiles(this._eventsDir!, true);

		for (const folderPath of [...defaultEvents, ...folders]) {
			const event = folderPath.split(/[\/\\]/g).pop()!;
			const files = getAllFiles(folderPath);

			const functions = this._eventCallbacks.get(event) || [];

			for (const file of files) {
				const isBuiltIn = !folderPath.includes(this._eventsDir!);
				const func = require(file).event;
				const result = [func];

				const split = file.split(event)[1].split(/[\/\\]/g);
				const methodName = split[split.length - 2];

				if (
					isBuiltIn &&
					this._buildInEvents[event] &&
					this._buildInEvents[event][methodName]
				)
					result.push(this._buildInEvents[event][methodName]);
				else if (this._events[event] && this._events[event][methodName])
					result.push(this._events[event][methodName]);

				functions.push(result);
			}

			this._eventCallbacks.set(event, functions);
		}

		console.log(this._eventCallbacks);
	}

	registerEvents() {
		const instance = this._instance;

		for (const eventName of this._eventCallbacks.keys()) {
			const functions = this._eventCallbacks.get(eventName);

			this._client.on(eventName, async function() {
				for (const [func, dynamicValidation] of functions) {
					if (dynamicValidation && !(await dynamicValidation(...arguments)))
						continue;
					func(...arguments, instance);
				}
			});
		}
	}
}

export default EventHandler;
