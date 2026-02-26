import * as cache from "@actions/cache";
import * as core from "@actions/core";
import { getInput } from "@actions/core";
import { Octokit } from "@octokit/rest";
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
    return normalized.replace(/^_+|_+$/g, "") || "ninja";
}

function getInstallRoot(version: string, asset_name: string): string {
    const digest = createHash("sha256")
        .update(`${version}|${asset_name}`)
        .digest("hex")
        .slice(0, 12);
    return `${toPathComponent(version)}-${digest}`;
}

function getNinjaAssetName(platform: NodeJS.Platform, arch: string): string {
    switch (platform) {
        case "win32":
            if (arch === "arm64") return "ninja-winarm64.zip";
            if (arch === "x64") return "ninja-win.zip";
            break;
        case "linux":
            if (arch === "arm64") return "ninja-linux-aarch64.zip";
            if (arch === "x64") return "ninja-linux.zip";
            break;
        case "darwin":
            if (arch === "arm64" || arch === "x64") return "ninja-mac.zip";
            break;
    }

    throw new Error(`Unsupported platform/arch combination: ${platform}/${arch}`);
}

(async () => {
    try {
        const stream_pipeline = util.promisify(stream.pipeline);
        const version = getInput("version", { required: true }).trim();
        const platform = os.platform();
        const arch = os.arch();
        const asset_name = getNinjaAssetName(platform, arch);
        const workspace = process.cwd();
        const install_root = getInstallRoot(version, asset_name);
        const install_dir = path.join(workspace, ".ninja", install_root);
        const cache_key = `${platform}-${arch}-ninja-${version}`;
        const restored_key = await cache.restoreCache([install_dir], cache_key);

        if (!restored_key) {
            fs.mkdirSync(install_dir, { recursive: true });

            const octokit = new Octokit();
            const releases = await octokit.rest.repos.getReleaseByTag({
                owner: "ninja-build",
                repo: "ninja",
                tag: `v${version}`,
            });

            const asset = releases.data.assets.find((a) => a.name === asset_name);

            if (!asset) {
                throw new Error(`No asset found for ${asset_name} in ninja release v${version}`);
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
    } catch (error: any) {
        core.setFailed(error.message);
    }
})();
