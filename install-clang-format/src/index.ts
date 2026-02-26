import * as cache from "@actions/cache";
import * as core from "@actions/core";
import { getInput } from "@actions/core";
import { spawnSync } from "node:child_process";
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

(async () => {
    try {
        const version = getInput("version", { required: true });
        const tool_dir = getToolDir();
        const bin_dir = getBinDir();
        const cache_key = `${os.platform()}-clang-format-${version}`;
        const restored_key = await cache.restoreCache([tool_dir, bin_dir], cache_key);

        if (!restored_key) {
            const install = spawnSync("uv", ["tool", "install", `clang-format==${version}`], {
                stdio: "inherit",
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
