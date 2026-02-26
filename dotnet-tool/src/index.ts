import * as cache from "@actions/cache";
import * as core from "@actions/core";
import { getInput } from "@actions/core";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

function toPathComponent(value: string): string {
    const normalized = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "_");
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

        const workspace = process.cwd();
        const install_root = getInstallRoot(tool, version);
        const tool_dir = path.join(workspace, ".dotnet-tools", install_root);
        const nuget_packages_dir = path.join(workspace, ".nuget-packages", install_root);
        const cache_key = `${os.platform()}-dotnet-tool-${tool}-${version}`;
        const restored_key = await cache.restoreCache([tool_dir, nuget_packages_dir], cache_key);

        if (!restored_key) {
            fs.mkdirSync(tool_dir, { recursive: true });
            fs.mkdirSync(nuget_packages_dir, { recursive: true });

            const install_tool = spawnSync(
                "dotnet",
                ["tool", "install", tool, "--version", version, "--tool-path", tool_dir],
                {
                    stdio: "inherit",
                    env: {
                        ...process.env,
                        NUGET_PACKAGES: nuget_packages_dir,
                    },
                },
            );

            if (install_tool.status !== 0) {
                throw new Error(`dotnet tool install failed: ${install_tool.status}`);
            }

            await cache.saveCache([tool_dir, nuget_packages_dir], cache_key);
        }

        core.addPath(tool_dir);
    } catch (error: any) {
        core.setFailed(error.message);
    }
})();
