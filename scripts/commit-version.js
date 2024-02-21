import * as dotenv from 'dotenv';
import { commitVersion } from '@jezvejs/release-tools';

dotenv.config();

commitVersion({
    versionFiles: [
        'package-lock.json',
        'package.json',
        'packages/release-tools/package.json',
    ],
    packageName: 'release-tools',
    gitDir: process.env.PROJECT_GIT_DIR,
});
