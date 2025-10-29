import { execSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

(async () => {
    const event_path = process.env.GITHUB_EVENT_PATH;

    if (!event_path) {
        throw new Error("GITHUB_EVENT_PATH not set");
    }

    const event = JSON.parse(await readFile(event_path, "utf8"));
    console.dir(event, { depth: null });

    await writeFile(
        join(resolve("src/content/generated"), `${event.event_type}.json`),
        JSON.stringify(event.client_payload.data, null, 4),
    );

    execSync(
        `git config user.name github-actions[bot] &&
    git config user.email 41898282+github-actions[bot]@users.noreply.github.com &&
    git add -A &&
    (git commit -m 'github-actions: Update generated files' || echo "No changes to commit") &&
    git push origin master`,
    );
})();
