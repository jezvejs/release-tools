import { join } from 'path';
import { readFileSync } from 'fs';
import { readdir, readlink, stat } from 'fs/promises';
import runAll from 'npm-run-all';

/* eslint-disable no-console */

export const runCommand = async (command) => {
    const options = {
        stdin: process.stdin,
        stdout: process.stdout,
        stderr: process.stderr,
    };

    try {
        const [result] = await runAll([command], options);
        if (result.code !== 0) {
            console.log('Command failed');
            process.exit(result.code);
        }
    } catch (error) {
        console.log(error.message);
        process.exit(1);
    }
};

export const getDirectoryFiles = async (directoryPath, filterFiles = null) => {
    const res = {
        files: [],
        links: [],
        linkTargets: [],
    };
    const files = await readdir(directoryPath, { withFileTypes: true, recursive: true });

    files.forEach((file) => {
        const fullName = join(file.path, file.name);
        if (filterFiles && !filterFiles(fullName)) {
            return;
        }

        if (file.isSymbolicLink()) {
            res.links.push(file);
        } else if (file.isFile()) {
            res.files.push(file);
        }
    });

    for (const item of res.links) {
        const fullName = join(item.path, item.name);
        const linkValue = await readlink(fullName);
        const linkTarget = await stat(linkValue);

        const extendedItem = {
            path: item.path,
            name: item.name,
            fullName,
            linkValue,
            linkTarget,
        };

        if (linkTarget.isDirectory()) {
            extendedItem.child = await getDirectoryFiles(linkValue, filterFiles);
            res.files.push(...extendedItem.child.files);
        }

        res.linkTargets.push(extendedItem);
    }

    return res;
};

export const getPackageVersion = (fileName) => {
    const content = readFileSync(fileName);
    const json = JSON.parse(content);
    return json.version;
};

export const getFirstPathPart = (path, sourcePart) => {
    const relPath = path.startsWith(sourcePart) ? path.substring(sourcePart.length + 1) : path;
    const parts = relPath.split(/[\\/]/);
    return parts[0].toLowerCase();
};
