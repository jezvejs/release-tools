import Client from 'ssh2-sftp-client';
import ProgressBar from 'progress';

import { getDirectoryFiles } from './utils.js';

/* eslint-disable no-console */

/**
 * Deploy client class
 */
class DeployClient {
    static defaultProps = {
        sourceDir: null,
        destDir: null,
        appDir: null,
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
        } = this.props;

        this.src = sourceDir;
        this.dest = destDir;

        const deployDir = `${appDir}-deploy`;
        const backupDir = `${appDir}-backup`;

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

            // Prepare empty deploy directory
            await this.removeIfExists(this.deployPath);
            await this.client.mkdir(this.deployPath, true);

            // Upload to deploy directory
            console.log(`Deploy from: ${this.src} to: ${this.deployPath}`);
            await this.client.uploadDir(this.src, this.deployPath);

            this.finishProgress();

            // Rename current app directory to backup if available
            const appDirType = await this.isExists(this.appPath);
            if (appDirType === 'd') {
                await this.removeIfExists(this.backupPath);
                await this.client.rename(this.appPath, this.backupPath);
            }

            // Rename deploy directory to app
            await this.client.rename(this.deployPath, this.appPath);

            // Remove backup directory
            await this.removeIfExists(this.backupPath);

            res = 0;
        } catch (e) {
            this.onError(e);
        } finally {
            this.client.end();
            this.client = null;
        }

        return res;
    }

    destPath(...parts) {
        return `${this.dest}/${parts.join('/')}`;
    }

    async initProgress() {
        const srcDir = await getDirectoryFiles(this.src);

        this.progress = new ProgressBar('[:bar] :percent :file', {
            total: srcDir.files.length + 1,
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
