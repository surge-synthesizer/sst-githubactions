import * as cache from "@actions/cache";
import * as core from "@actions/core";
import { getInput } from "@actions/core";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as os from "node:os";
import * as path from "node:path";

function getPersistentDataDir(): string {
    const uv_data_dir = process.env.UV_DATA_DIR;
    if (uv_data_dir) {
        return uv_data_dir;
    }

    const xdg_data_home = process.env.XDG_DATA_HOME;
    if (xdg_data_home) {
        return path.join(xdg_data_home, "uv");
    }

    const home_dir = os.homedir();
    if (process.platform === "win32") {
        const appdata = process.env.APPDATA;
        if (appdata) {
            return path.join(appdata, "uv", "data");
        }
    }

    if (home_dir) {
        return path.join(home_dir, ".local", "share", "uv");
    }

    return path.join(process.cwd(), ".uv");
}

function getToolDir(): string {
    return process.env.UV_TOOL_DIR ?? path.join(getPersistentDataDir(), "tools");
}

function getBinDir(): string {
    const uv_tool_bin_dir = process.env.UV_TOOL_BIN_DIR;
    if (uv_tool_bin_dir) {
        return uv_tool_bin_dir;
    }

    const xdg_bin_home = process.env.XDG_BIN_HOME;
    if (xdg_bin_home) {
        return xdg_bin_home;
    }

    const xdg_data_home = process.env.XDG_DATA_HOME;
    if (xdg_data_home) {
        return path.resolve(xdg_data_home, "..", "bin");
    }

    return path.join(os.homedir(), ".local", "bin");
}

function toPathComponent(value: string): string {
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "_");
    return normalized.replace(/^_+|_+$/g, "") || "tool";
}

function getInstallRoot(tool: string, version: string): string {
    const digest = createHash("sha256").update(`${tool}==${version}`).digest("hex").slice(0, 12);
    return `${toPathComponent(tool)}-${toPathComponent(version)}-${digest}`;
}

(async () => {
    try {
        const tool = getInput("tool", { required: true }).trim();
        const version = getInput("version", { required: true }).trim();

        const install_root = getInstallRoot(tool, version);
        const tool_dir = path.join(getToolDir(), install_root);
        const bin_dir = path.join(getBinDir(), install_root);
        const cache_key = `${os.platform()}-uv-tool-${tool}-${version}`;
        const restored_key = await cache.restoreCache([tool_dir, bin_dir], cache_key);

        if (!restored_key) {
            const install = spawnSync("uv", ["tool", "install", `${tool}==${version}`], {
                stdio: "inherit",
                env: {
                    ...process.env,
                    UV_TOOL_DIR: tool_dir,
                    UV_TOOL_BIN_DIR: bin_dir,
                },
            });

            if (install.status !== 0) {
                throw new Error(`uv tool install failed: ${install.status}`);
            }

            await cache.saveCache([tool_dir, bin_dir], cache_key);
        }

        core.addPath(bin_dir);
    } catch (error: any) {
        core.setFailed(error.message);
    }
})();
