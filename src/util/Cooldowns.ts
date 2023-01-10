import SWAGCommands from "..";
import { CooldownConfig, InternalCooldownConfig } from "../types";
import cooldownSchema from "../models/cooldown-schema";

const cooldownDurations: any = {
	s: 1,
	m: 60,
	h: 60 * 60,
	d: 60 * 60 * 24,
};

export type cooldownTypesType =
	| "perUser"
	| "perUserPerGuild"
	| "perGuild"
	| "global";

export const cooldownTypes = [
	"perUser",
	"perUserPerGuild",
	"perGuild",
	"global",
];

class Cooldowns {
	/*
	 * perUser:
	 * <`${userId}-${actionId}`: expires>
	 *
	 * perUserPerGuild:
	 * <`${userId}-${guildId}-${actionId}`: expires>
	 *
	 * perGuild:
	 * <`${guildId}-${actionId}`: expires>
	 *
	 * global:
	 * <action: expires>
	 */
	_cooldowns = new Map();
	_instance: SWAGCommands;
	_errorMessage: string;
	_botOwnersBypass: boolean;
	_dbRequired: number;

	constructor(instance: SWAGCommands, cooldownConfig: CooldownConfig) {
		this._instance = instance;
		this._errorMessage =
			cooldownConfig.errorMessage ||
			"Please wait {TIME} before doing that again.";
		this._botOwnersBypass = cooldownConfig.botOwnersBypass;
		this._dbRequired = cooldownConfig.dbRequired;

		this.loadCooldowns();
	}

	async loadCooldowns() {
		await cooldownSchema.deleteMany({
			expires: { $lt: Date.now() },
		});

		const results = await cooldownSchema.find({});

		for (const result of results) {
			const { _id, expires } = result;

			this._cooldowns.set(_id, expires);
		}
	}

	verifyCooldown(duration: number | string) {
		if (typeof duration === "number") return duration;

		const split = duration.split(" ");
		if (split.length !== 2)
			throw new Error(
				`Duration "${duration}" is an invalid duration. Please use "10 m", "15 s", etc..`
			);

		const quantity = +split[0];
		const type = split[1].toLowerCase();
		if (!cooldownDurations[type])
			throw new Error(
				`Unknown duration type "${type}". Please use one of the following: ${Object.keys(
					cooldownDurations
				)}`
			);

		if (quantity <= 0)
			throw new Error(
				`Invalid quantity of "${quantity}". Please use a value grater than 0.`
			);

		return quantity * cooldownDurations[type];
	}

	getKey(
		cooldownType: cooldownTypesType,
		userId: string,
		actionId: string,
		guildId: string
	) {
		const isPerUser = cooldownType === "perUser";
		const isPerUserPerGuild = cooldownType === "perUserPerGuild";
		const isPerGuild = cooldownType === "perGuild";
		const isGlobal = cooldownType === "global";

		if ((isPerUserPerGuild || isPerGuild) && !guildId)
			throw new Error(
				`Invalid cooldown type "${cooldownType}" used outside of a guild.`
			);

		if (isPerUser) return `${userId}-${actionId}`;
		if (isPerUserPerGuild) return `${userId}-${guildId}-${actionId}`;
		if (isPerGuild) return `${guildId}-${actionId}`;
		if (isGlobal) return actionId;
	}

	canBypass(userId: string) {
		return this._botOwnersBypass && this._instance.botOwners.includes(userId);
	}

	async start({
		cooldownType,
		userId,
		actionId,
		guildId = "",
		duration,
	}: InternalCooldownConfig) {
		if (this.canBypass(userId)) return;

		if (!cooldownTypes.includes(cooldownType))
			throw new Error(
				`Invalid cooldown type "${cooldownType}". Please use one of the following: ${cooldownTypes}`
			);

		const seconds = this.verifyCooldown(duration!);

		const key = this.getKey(cooldownType, userId, actionId, guildId);
		const expires = new Date();
		expires.setSeconds(expires.getSeconds() + seconds);

		if (seconds >= this._dbRequired) {
			await cooldownSchema.findOneAndUpdate(
				{ _id: key },
				{
					_id: key,
					expires,
				},
				{ upsert: true }
			);
		}

		this._cooldowns.set(key, expires);

		console.log(this._cooldowns);
	}

	canRunAction({
		cooldownType,
		userId,
		actionId,
		guildId = "",
		errorMessage = this._errorMessage,
	}: InternalCooldownConfig) {
		if (this.canBypass(userId)) return true;

		const key = this.getKey(cooldownType, userId, actionId, guildId);
		const expires = this._cooldowns.get(key);

		if (!expires) return true;

		const now = new Date();
		if (now > expires) {
			this._cooldowns.delete(key);
			return true;
		}

		const secondsDiff = (expires.getTime() - now.getTime()) / 1000;
		const d = Math.floor(secondsDiff / (3600 * 24));
		const h = Math.floor((secondsDiff % (3600 * 24)) / 3600);
		const m = Math.floor((secondsDiff % 3600) / 60);
		const s = Math.floor(secondsDiff % 60);

		let time = "";
		if (d > 0) time += `${d}d `;
		if (h > 0) time += `${h}h `;
		if (m > 0) time += `${m}m `;
		time += `${s}s`;

		return errorMessage.replace("{TIME}", time);
	}
}

export default Cooldowns;
