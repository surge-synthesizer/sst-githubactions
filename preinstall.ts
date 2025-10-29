import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const pre_commit_script = `#!/bin/sh
echo "Building GitHub action..."
pnpm build || exit 1
git add -A`;

try {
    mkdirSync(resolve(".git/hooks"), { recursive: true });
    writeFileSync(join(resolve(".git/hooks"), "pre-commit"), pre_commit_script, {
        encoding: "utf8",
    });
} catch (err) {
    console.error(`Failed to install pre-commit hook: ${err}`);
    process.exit(1);
}
