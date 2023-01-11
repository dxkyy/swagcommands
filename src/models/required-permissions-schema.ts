import { Schema, model, models } from "mongoose";

const requiredPermissionsSchema = new Schema({
	_id: {
		type: String,
		required: true,
	},
	permissions: {
		type: [String],
		required: true,
	},
});

const name = "required-permissions";
export default models[name] || model(name, requiredPermissionsSchema);
