import { asArray, isFunction } from '@jezvejs/types';
import Client from 'ssh2-sftp-client';
import ProgressBar from 'progress';

import { getDirectoryFiles, getFirstPathPart } from './utils.js';

/* eslint-disable no-console */

/**
 * Deploy client class
 */
class DeployClient {
    static defaultProps = {
        clientConfig: null,
        sourceDir: null,
        destDir: null,
        appDir: null,
        createDirs: null,
        uploadSymLinks: false,
        fullDeploy: true,
        partialUploadSkipList: null,
        removeSkipList: null,
        cleanAll: false,
        extraUpload: null,
        extraUploadRoot: null,
    };

    static create(props) {
        const instance = new this(props);
        return instance.deploy();
    }

    constructor(props = {}) {
        this.props = {
            ...DeployClient.defaultProps,
            ...props,
        };
    }

    async deploy() {
        const {
            clientConfig,
            sourceDir,
            destDir,
            appDir,
            uploadSymLinks,
            fullDeploy,
            cleanAll,
        } = this.props;

        this.src = sourceDir;
        this.dest = destDir;

        const deployDir = this.props.deployDir ?? `${appDir}-deploy`;
        const backupDir = this.props.backupDir ?? `${appDir}-backup`;

        this.appPath = this.destPath(appDir);
        this.deployPath = this.destPath(deployDir);
        this.backupPath = this.destPath(backupDir);
        let res = 1;

        try {
            this.client = new Client();
            this.client.on('error', (e) => this.onError(e));

            await this.initProgress();

            await this.client.connect(clientConfig);
            this.client.on('upload', (info) => {
                this.updateProgress(info);
            });

            if (fullDeploy) {
                await this.prepareDeployDir();
            }

            // Upload to deploy directory
            console.log(`Deploy from: ${this.src} to: ${this.deployPath}`);
            await this.client.uploadDir(this.src, this.deployPath, {
                filter: (source) => this.filterFiles(source),
            });

            if (uploadSymLinks) {
                for (const item of this.srcDir.linkTargets) {
                    const srcPath = this.srcPath(item.name);
                    const childDeployPath = this.destPath(deployDir, item.name);

                    await this.client.mkdir(childDeployPath, true);
                    await this.client.chmod(childDeployPath, 0o0755);

                    await this.client.uploadDir(srcPath, childDeployPath);
                }
            }

            this.finishProgress();

            if (fullDeploy) {
                await this.renameAppToBackup();
                await this.renameDeployToApp();
                await this.extraUpload();
                await this.createDirectories();

                await this.afterUpload();

                if (cleanAll) {
                    await this.removeExcessItems();
                } else {
                    await this.removeBackupDir();
                }
            }

            res = 0;
        } catch (e) {
            this.onError(e);
        } finally {
            this.client.end();
            this.client = null;
        }

        return res;
    }

    srcPath(...parts) {
        return `${this.src}/${parts.join('/')}`;
    }

    destPath(...parts) {
        return `${this.dest}/${parts.join('/')}`;
    }

    // Prepare empty deploy directory
    async prepareDeployDir() {
        await this.removeIfExists(this.deployPath);
        await this.client.mkdir(this.deployPath, true);
    }

    // Rename current app directory to backup if available
    async renameAppToBackup() {
        const appDirType = await this.isExists(this.appPath);
        if (appDirType === 'd') {
            await this.removeIfExists(this.backupPath);
            await this.client.rename(this.appPath, this.backupPath);
        }
    }

    // Rename deploy directory to app
    async renameDeployToApp() {
        await this.client.rename(this.deployPath, this.appPath);
    }

    // Remove backup directory
    async removeBackupDir() {
        return this.removeIfExists(this.backupPath);
    }

    // Remove all excess paths
    async removeExcessItems() {
        const removeSkipList = asArray(this.props.removeSkipList);

        const list = await this.client.list(this.dest);
        for (const item of list) {
            const firstPart = getFirstPathPart(item.name);
            if (removeSkipList.includes(firstPart)) {
                continue;
            }

            const itemPath = this.destPath(item.name);

            console.log(`Removing ${itemPath}`);
            await this.removeByType(itemPath, item.type);
        }
    }

    // Upload extra files
    async extraUpload() {
        const files = asArray(this.props.extraUpload);
        const srcPathItems = asArray(this.props.extraUploadRoot);

        for (const item of files) {
            await this.client.put(
                this.srcPath(...srcPathItems, item),
                this.destPath(item),
            );
        }
    }

    // Create directories after upload
    async createDirectories() {
        const dirs = asArray(this.props.createDirs);

        for (const item of dirs) {
            const itemPath = [this.appPath, item].join('/');
            console.log(`Creating ${itemPath}`);

            await this.client.mkdir(itemPath, true);
            await this.client.chmod(itemPath, 0o0755);
        }
    }

    async afterUpload() {
        const { afterUpload } = this.props;
        return (isFunction(afterUpload)) ? afterUpload() : null;
    }

    async initProgress() {
        this.srcDir = null;
        this.srcDir = await getDirectoryFiles(this.src, (source) => (
            this.filterFiles(source)
        ));

        this.progress = new ProgressBar('[:bar] :percent :file', {
            total: this.srcDir.files.length + 1,
            width: 20,
            complete: '█',
            incomplete: ' ',
        });
    }

    updateProgress(info) {
        this.progress.tick({
            file: info.source.substring(this.src.length + 1),
        });
    }

    finishProgress() {
        this.progress.tick({ file: 'Upload done' });
    }

    filterFiles(source) {
        const { filterFiles } = this.props;

        if (this.srcDir?.linkNames?.includes(source)) {
            return false;
        }

        return !filterFiles || filterFiles(source, this.src);
    }

    async isExists(path) {
        try {
            return await this.client.exists(path);
        } catch {
            return false;
        }
    }

    async removeByType(path, type) {
        if (type === 'd') {
            await this.client.rmdir(path, true);
        } else if (type === '-') {
            await this.client.delete(path, true);
        }
    }

    async removeIfExists(path) {
        const type = await this.isExists(path);
        if (type !== false) {
            console.log(`Removing ${path}`);
        }

        return this.removeByType(path, type);
    }

    async restoreBackup() {
        if (!this.backupPath) {
            return;
        }
        // Rename current app/ directory back to deploy/
        await this.client.rename(this.appPath, this.deployPath);
        // Rename backup/ directory to back app/
        await this.client.rename(this.backupPath, this.appPath);
    }

    async onError(e) {
        console.log('Upload error: ', e.message);
        await this.restoreBackup();

        this.progress?.interrupt(`Upload error: ${e.message}`);
    }
}

export const deploy = async (options) => (
    DeployClient.create(options)
);
