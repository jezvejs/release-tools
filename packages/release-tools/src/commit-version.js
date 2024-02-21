import { asArray } from '@jezvejs/types';
import shell from 'shelljs';
import { resolve } from 'path';
import { getPackageVersion } from './utils.js';

/**
 * Version commit client class
 */
class VersionCommitClient {
    static defaultProps = {
        sourceDir: null,
        destDir: null,
        appDir: null,
        gitDir: null,
        packageName: null,
        mainBranch: 'main',
        releaseBranch: 'release',
        versionFiles: [],
    };

    static create(props) {
        const instance = new this(props);
        return instance.commit();
    }

    constructor(props = {}) {
        this.props = {
            ...VersionCommitClient.defaultProps,
            ...props,
        };
    }

    dirPath(str) {
        return resolve(str.toString()).replace(/\\/g, '/');
    }

    commit() {
        if (!shell.which('git')) {
            shell.echo('Sorry, this script requires git');
            shell.exit(1);
        }

        const {
            gitDir,
            versionFiles,
            packageName,
            mainBranch,
            releaseBranch,
        } = this.props;

        this.gitDir = this.dirPath(gitDir);
        this.currentDir = this.dirPath(shell.pwd());

        // If git directory is different from current(working) directory
        // then copy files with package version updates to git directory
        if (this.gitDir.toLowerCase() !== this.currentDir.toLowerCase()) {
            asArray(versionFiles).forEach((file) => {
                const source = resolve(this.currentDir, file);
                const dest = resolve(this.gitDir, file);

                shell.cp('-f', source, dest);
            });
        }

        const packagePath = (packageName)
            ? `./packages/${packageName}/package.json`
            : './package.json';

        const version = getPackageVersion(packagePath);

        shell.pushd('-q', this.gitDir);

        shell.exec(`git commit -a -m "Updated version to ${version}"`);
        shell.exec(`git checkout ${releaseBranch} --`);
        shell.exec(`git pull -v --no-rebase "origin/${releaseBranch}"`);
        shell.exec(`git merge --no-ff -m "Version ${version}" ${mainBranch}`);
        shell.exec(`git tag -a v.${version} -m "Version ${version}"`);
        shell.exec(`git checkout ${mainBranch} --`);

        shell.popd('-q');
    }
}

export const commitVersion = async (props) => (
    VersionCommitClient.create(props)
);
