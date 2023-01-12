import { Schema, model, models } from "mongoose";

const disabledCommandSchema = new Schema({
	_id: {
		type: String,
		required: true,
	},
});

const name = "disabled-commands";

export default models[name] || model(name, disabledCommandSchema);
