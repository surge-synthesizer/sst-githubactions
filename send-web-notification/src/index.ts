import { getInput } from "@actions/core";
import { Temporal } from "@js-temporal/polyfill";
import { Octokit } from "@octokit/rest";
import { execSync, spawnSync } from "node:child_process";

(async () => {
    const web_repo = getInput("web_repo", { required: true });
    const event_type = getInput("event_type", { required: true });
    const name = getInput("name", { required: true });
    const version = getInput("version", { required: true });

    const releasesInput = getInput("releases", { required: false }) || "{}";
    let releases: Record<string, string>;

    try {
        console.log(`releasesInput: ${releasesInput}`);
        releases = JSON.parse(releasesInput);
    } catch (error) {
        throw new Error(`Invalid JSON for releases input: ${error}`);
    }

    const dataInput = getInput("data", { required: false }) || "{}";
    let data: Record<string, string>;

    try {
        console.log(`dataInput: ${dataInput}`);
        data = JSON.parse(dataInput);
    } catch (error) {
        throw new Error(`Invalid JSON for data input: ${error}`);
    }

    const octokit = new Octokit({ auth: process.env.GH_TOKEN });

    await octokit.repos.createDispatchEvent({
        owner: "surge",
        repo: web_repo,
        event_type,
        client_payload: {
            data: {
                name,
                version,
                project_repo: execSync(`gh repo view --json url --jq '.url'`),
                releases,
                data,
                build_time: Temporal.Now.plainDateTimeISO().toString(),
                latest_commit: spawnSync("git", ["rev-parse", "--short", "HEAD"], {
                    encoding: "utf-8",
                }).stdout.trim(),
                recent_commits: spawnSync(
                    "git",
                    ["log", "-5", "--pretty=format:%h%x00%an%x00%aI%x00%s%x00"],
                    {
                        encoding: "utf-8",
                    },
                )
                    .stdout.split("\n")
                    .filter(Boolean)
                    .map((line) => {
                        const [commit, author, date, message] = line.split("\x00");
                        return { commit, author, date, message };
                    }),
            },
        },
    });
})();
