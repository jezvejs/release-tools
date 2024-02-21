import { release } from '@jezvejs/release-tools';

/* eslint-disable no-console */

const MAIN_PACKAGE = '@jezvejs/release-tools';

if (process.argv.length < 3) {
    console.log('Usage: release.js <newversion> [<package>]');
    process.exit(1);
}

const newVersion = process.argv[2];
const packageName = (process.argv.length > 3)
    ? process.argv[3]
    : MAIN_PACKAGE;
const isMainPackage = (packageName === MAIN_PACKAGE);

const run = async () => {
    await release({
        packageName,
        isMainPackage,
        newVersion,
    });

    process.exit(0);
};

run();