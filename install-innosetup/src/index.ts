import * as cache from "@actions/cache";
import * as core from "@actions/core";
import { getInput } from "@actions/core";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as stream from "node:stream";
import * as util from "node:util";

function toPathComponent(value: string): string {
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "_");
    return normalized.replace(/^_+|_+$/g, "") || "innosetup";
}

function getInstallRoot(version: string, asset_name: string): string {
    const digest = createHash("sha256")
        .update(`${version}|${asset_name}`)
        .digest("hex")
        .slice(0, 12);
    return `${toPathComponent(version)}-${digest}`;
}

(async () => {
    if (os.platform() !== "win32") {
        return;
    }

    try {
        const stream_pipeline = util.promisify(stream.pipeline);
        const version = getInput("version", { required: true }).trim();
        const platform = os.platform();
        const arch = os.arch();
        const workspace = process.cwd();
        const installer_name = `innosetup-${version}.exe`;
        const install_root = getInstallRoot(version, installer_name);
        const install_dir = path.join(workspace, ".innosetup", install_root);
        const cache_key = `${platform}-${arch}-innosetup-${version}`;
        const restored_key = await cache.restoreCache([install_dir], cache_key);
        const version_underscore = version.replace(/\./g,'_');

        if (!restored_key) {
            const asset_url = `https://github.com/jrsoftware/issrc/releases/download/is-${version_underscore}/innosetup-${version}.exe`;
            const installer_path = path.join(workspace, installer_name);

            const res = await fetch(asset_url);

            if (!res.ok) {
                throw new Error(`Failed to fetch ${asset_url}: ${res.statusText}`);
            }

            if (!res.body) {
                throw new Error("Response body is null");
            }

            await stream_pipeline(res.body, fs.createWriteStream(installer_path));

            const install_result = spawnSync(
                installer_path,
                ["/VERYSILENT", "/CURRENTUSER", `/DIR=${install_dir}`],
                {
                    stdio: "inherit",
                },
            );

            if (install_result.error) {
                throw install_result.error;
            }
            if (install_result.status !== 0) {
                throw new Error(
                    `Inno Setup installation failed with code ${install_result.status}`,
                );
            }

            fs.rmSync(installer_path);

            await cache.saveCache([install_dir], cache_key);
        }

        core.addPath(install_dir);
    } catch (error: any) {
        core.setFailed(error.message);
    }
})();
