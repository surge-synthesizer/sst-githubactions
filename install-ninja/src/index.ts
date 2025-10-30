import * as cache from "@actions/cache";
import * as core from "@actions/core";
import { getInput } from "@actions/core";
import { Octokit } from "@octokit/rest";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as stream from "node:stream";
import * as util from "node:util";

(async () => {
    try {
        const stream_pipeline = util.promisify(stream.pipeline);
        const version = getInput("version", { required: true });
        const workspace = process.cwd();
        const install_dir = path.join(workspace, `ninja-${version}`);
        const cache_key = `${os.platform()}-ninja-${version}`;
        const restored_key = await cache.restoreCache([install_dir], cache_key);

        if (restored_key) {
            core.info(`Cache hit for Ninja ${version}`);
        } else {
            core.info(`Cache miss, downloading Ninja ${version}`);

            fs.mkdirSync(install_dir, { recursive: true });

            let platform: string;
            switch (os.platform()) {
                case "win32":
                    platform = "win";
                    break;
                case "linux":
                    platform = "linux";
                    break;
                case "darwin":
                    platform = "mac";
                    break;
                default:
                    throw new Error(`Unsupported OS: ${os.platform()}`);
            }

            const octokit = new Octokit();
            const releases = await octokit.rest.repos.getReleaseByTag({
                owner: "ninja-build",
                repo: "ninja",
                tag: `v${version}`,
            });

            const asset = releases.data.assets.find((a) => a.name.includes(platform));

            if (!asset) {
                throw new Error(`No asset found for platform ${platform}`);
            }

            const asset_url = asset.browser_download_url;
            const zip_path = path.join(workspace, asset.name);

            const res = await fetch(asset_url);

            if (!res.ok) {
                throw new Error(`Failed to fetch ${asset_url}: ${res.statusText}`);
            }

            if (!res.body) {
                throw new Error("Response body is null");
            }

            await stream_pipeline(res.body, fs.createWriteStream(zip_path));

            const extract_result = spawnSync("7z", ["x", zip_path, `-o${install_dir}`, "-y"], {
                stdio: "inherit",
            });

            if (extract_result.error) {
                throw extract_result.error;
            }
            if (extract_result.status !== 0) {
                throw new Error(`7-Zip extraction failed with code ${extract_result.status}`);
            }

            fs.rmSync(zip_path);

            await cache.saveCache([install_dir], cache_key);
        }

        core.addPath(install_dir);
        core.info(`Ninja ${version} added to PATH`);
    } catch (error: any) {
        core.setFailed(error.message);
    }
})();
