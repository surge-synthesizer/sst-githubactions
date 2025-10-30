import * as cache from "@actions/cache";
import * as core from "@actions/core";
import { getInput } from "@actions/core";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as stream from "node:stream";
import * as util from "node:util";

(async () => {
    if (os.platform() !== "win32") {
        return;
    }

    try {
        const stream_pipeline = util.promisify(stream.pipeline);
        const version = getInput("version", { required: true });
        const workspace = process.cwd();
        const install_dir = path.join(workspace, `innosetup-${version}`);
        const cache_key = `${os.platform()}-innosetup-${version}`;
        const restored_key = await cache.restoreCache([install_dir], cache_key);

        if (!restored_key) {
            const asset_url = `https://files.jrsoftware.org/is/6/innosetup-${version}.exe`;
            const installer_path = path.join(workspace, `innosetup-${version}.exe`);

            const res = await fetch(asset_url);

            if (!res.ok) {
                throw new Error(`Failed to fetch ${asset_url}: ${res.statusText}`);
            }

            if (!res.body) {
                throw new Error("Response body is null");
            }

            await stream_pipeline(res.body, fs.createWriteStream(installer_path));

            spawnSync(installer_path, ["/VERYSILENT", "/CURRENTUSER", `/DIR=${install_dir}`], {
                stdio: "inherit",
            });

            fs.rmSync(installer_path);

            await cache.saveCache([install_dir], cache_key);
        }

        core.addPath(install_dir);
        core.info(`Inno Setup ${version} added to PATH`);
    } catch (error: any) {
        core.setFailed(error.message);
    }
})();
