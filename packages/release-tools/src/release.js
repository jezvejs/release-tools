import { asArray } from '@jezvejs/types';
import { runCommand } from './utils.js';

export const release = (props) => {
    const {
        packageName = null,
        newVersion,
        isMainPackage = true,
        deployCommand = 'npm run deploy',
        publish = true,
    } = props;
    const beforeCommit = asArray(props.beforeCommit);

    const workspace = (packageName) ? `-w ${packageName}` : '';

    runCommand('npm run all');
    runCommand(`npm version ${newVersion} ${workspace}`);
    runCommand(`npm install ${workspace}`);
    runCommand('npm update --save');

    if (isMainPackage) {
        runCommand('npm run build-all');
        for (const command of beforeCommit) {
            runCommand(command);
        }
    }

    if (publish) {
        runCommand(`npm publish ${workspace}`);
    }

    if (isMainPackage) {
        runCommand('npm run commit-version');
        runCommand(deployCommand);
    }
};
