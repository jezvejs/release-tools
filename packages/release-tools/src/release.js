import { asArray } from '@jezvejs/types';
import { runCommand } from './utils.js';

export const release = async (props) => {
    const {
        packageName = null,
        newVersion,
        isMainPackage = true,
        deployCommand = 'deploy',
        publish = true,
    } = props;
    const beforeCommit = asArray(props.beforeCommit);

    const workspace = (packageName) ? `-w ${packageName}` : '';

    await runCommand('all');
    await runCommand(`p-version -- ${newVersion} ${workspace}`);
    await runCommand(`p-install -- ${workspace}`);
    await runCommand('p-update -- --save');

    if (isMainPackage) {
        await runCommand('build-all');
        for (const command of beforeCommit) {
            await runCommand(command);
        }
    }

    if (publish) {
        await runCommand(`p-publish -- ${workspace}`);
    }

    if (isMainPackage) {
        await runCommand('commit-version');
        await runCommand(deployCommand);
    }
};
