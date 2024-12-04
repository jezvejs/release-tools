# JezveJS release tools

Simple tools for package release automation:

- Run tests or any other precondition commands
- Update version of package
- Build package release
- Create git commit for version and merge to release branch
- Publish on NPM registry
- Deploy to remove server using SFTP

Something like mini CI/CD.

<h2 align="left">Install</h2>

Add package to your project:

```bash
npm install -D @jezvejs/release-tools
```

<h2 align="left">Environment setup</h2>

It is recommended to use `.env` files to store sensitive data.


```bash
SFTP_SERVER='<your domain>'
SFTP_USER='<FTP user>'
SFTP_PASSWORD='<FTP password>'
SFTP_PORT=<FTP port>
DEPLOY_PATH='<path to domain directory on server>'
APP_DIR='<application subdirectory inside domain directory>'
SOURCE_DIR='<source directory relative to project root>'
PROJECT_GIT_DIR="<optional git directory for case it is different from project root>"

```

<h2 align="left">Usage</h2>

### release

Create new Node.js script at your project, for example `./scripts/release.js`

```js
import { release } from "@jezvejs/release-tools";

if (process.argv.length < 3) {
  console.log("Usage: release.js <newversion> [<package>]");
  process.exit(1);
}

const MAIN_PACKAGE = "<your package name>";
const newVersion = process.argv[2];
const packageName = process.argv.length > 3 ? process.argv[3] : MAIN_PACKAGE;
const isMainPackage = packageName === MAIN_PACKAGE;

release({
  packageName,
  isMainPackage,
  newVersion,
  buildAllCommand: null,
});
```

Add NPM script to `package.json`:

```js
"scripts": {
    ...
    "release": "node ./scripts/release.js"
}
```

Release with following command:

```bash
npm run release patch subpackage
```

### Options

- `packageName` (string, required): name of your project from package.json
- `newVersion` (string, required): new version to release according to semver
- `isMainPackage` (boolean, default is true): if enabled run commands from 'buildAllCommand' and 'beforeCommit' options after version update step
- `beforeVersion` (string|string[], default is 'npm run all'): commands to run before version update step
- `buildAllCommand` (string|string[], default is 'npm run build-all'): commands to run after version update step if 'isMainPackage' option is true
- `beforeCommit` (string|string[], default is null): commands to run after 'buildAllCommand' if 'isMainPackage' option is true
- `commitCommand` (string|string[], default is 'npm run commit-version'): commands to run to create commits/merge branches
- `deployCommand` (string|string[], default is 'npm run deploy'): commands to upload build results to remote server
- `publish` (boolean, default is true): if enabled publish new version to NPM registry

<h2 align="left">commitVersion</h2>

```js
import * as dotenv from "dotenv";
import { commitVersion } from "@jezvejs/release-tools";

dotenv.config();

commitVersion({
  versionFiles: [
    "package-lock.json",
    "package.json",
    "packages/release-tools/package.json",
  ],
  packageName: "release-tools",
  gitDir: process.env.PROJECT_GIT_DIR,
});
```

### Options

- `packageName` (string, required): name of your project from package.json
- `mainBranch` (string|string[], default is 'main'): main branch name
- `releaseBranch` (string|string[], default is 'release'): release branch name
- `gitDir` (string): optional git directory for case it is different from project root
- `versionFiles` (string|string[], default is 'release'): array of files to use for version commit

<h2 align="left">deploy</h2>

```js
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";
import { deploy } from "@jezvejs/release-tools";

const filename = fileURLToPath(import.meta.url);
const currentDir = dirname(filename);

dotenv.config();

if (!process.env.SFTP_SERVER) {
  process.exit(0);
}

const processRes = await deploy({
  clientConfig: {
    host: process.env.SFTP_SERVER,
    username: process.env.SFTP_USER,
    password: process.env.SFTP_PASSWORD,
    port: process.env.SFTP_PORT,
  },
  sourceDir: join(currentDir, "..", "dist"),
  destDir: process.env.DEPLOY_PATH,
  appDir: process.env.APP_DIR,
});

process.exit(processRes);
```

### Options

- `clientConfig` (object, required): configuration for `ssh2-sftp-client`
- `sourceDir` (string, required): source directory
- `destDir` (string, required): destination directory
- `appDir` (string, required): application directory
- `deployDir` (string, default is \`${appDir}-deploy\`): optional name of upload directory
- `backupDir` (string, default is \` ${appDir}-backup\`): optional name of application backup directory
- `createDirs` (string|string[]): array of directories to create after upload
- `uploadSymLinks` (boolean, default is false): if enabled includes symlinks to upload
- `uploadSymLinks` (boolean, default is true): if enabled upload all files
- `partialUploadSkipList` (string|string[], default is null): optional array of files to skip on partial upload
- `removeSkipList` (string|string[], default is null): optional array of files to skip on remove excess
- `cleanAll` (boolean, default is false): if enabled then remove all excess files in the destination directory on server after upload
- `extraUpload` (string|string[], default is null): optional array of files to upload from alternative locations
- `extraUploadRoot` (string|string[], default is null): optional array of alternative locations to upload files from
