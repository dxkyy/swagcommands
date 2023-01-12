import fs from "fs";
import p from "path";

const getAllFiles = (path: string, foldersOnly = false) => {
	const files = fs.readdirSync(path, { withFileTypes: true });
	let filesFound: string[] = [];

	for (const file of files) {
		const fileName = p.join(path, file.name);
		if (file.isDirectory()) {
			if (foldersOnly) filesFound.push(fileName);
			else filesFound = [...filesFound, ...getAllFiles(fileName)];
			continue;
		}

		filesFound.push(fileName);
	}

	return filesFound;
};

export default getAllFiles;
