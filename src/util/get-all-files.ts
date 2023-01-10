import fs from "fs";
import p from "path";

const getAllFiles = (path: string) => {
	const files = fs.readdirSync(path, { withFileTypes: true });
	let commandFiles: string[] = [];

	for (const file of files) {
		const fileName = p.join(path, file.name);
		if (file.isDirectory()) {
			commandFiles = [...commandFiles, ...getAllFiles(fileName)];
			continue;
		}

		commandFiles.push(fileName);
	}

	return commandFiles;
};

export default getAllFiles;
