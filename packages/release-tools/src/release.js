import { runCommand } from './utils.js';

export const release = async (props) => {
    const {
        packageName,
        newVersion,
        isMainPackage = true,
    } = props;

    await runCommand('all');
    await runCommand(`p-version -- ${newVersion} -w ${packageName}`);
    await runCommand(`p-install -- -w ${packageName}`);
    await runCommand('p-update -- --save');

    if (isMainPackage) {
        await runCommand('build-all');
    }

    await runCommand(`p-publish -- -w ${packageName}`);

    if (isMainPackage) {
        await runCommand('commit-version');
        await runCommand('deploy');
    }
};
