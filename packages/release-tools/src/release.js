import { runCommand, runCommands } from './utils.js';

export const release = (props) => {
    const {
        packageName = null,
        newVersion,
        isMainPackage = true,
        beforeVersion = 'npm run all',
        updateCommand = 'npm update --save',
        buildAllCommand = 'npm run build-all',
        beforeCommit = null,
        commitCommand = 'npm run commit-version',
        deployCommand = 'npm run deploy',
        publish = true,
    } = props;

    const workspace = (packageName) ? `-w ${packageName}` : '';

    runCommands(beforeVersion);

    runCommand(`npm version ${newVersion} ${workspace}`);
    runCommand(`npm install ${workspace}`);
    runCommand(updateCommand);

    if (isMainPackage) {
        runCommands(buildAllCommand);
        runCommands(beforeCommit);
    }

    if (publish) {
        runCommand(`npm publish ${workspace}`);
    }

    if (isMainPackage) {
        runCommands(commitCommand);
        runCommands(deployCommand);
    }
};
