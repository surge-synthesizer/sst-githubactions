"use strict";var n=require("node:child_process"),t=require("node:fs/promises"),e=require("node:path");(async()=>{let i=process.env.GITHUB_EVENT_PATH;if(!i)throw new Error("GITHUB_EVENT_PATH not set");let o=JSON.parse(await(0,t.readFile)(i,"utf8"));await(0,t.writeFile)((0,e.join)((0,e.resolve)("src/content/generated"),`${o.event_type}.json`),JSON.stringify(o.client_payload.data,null,4)),(0,n.execSync)(`git config user.name github-actions[bot] &&
    git config user.email 41898282+github-actions[bot]@users.noreply.github.com &&
    git add -A &&
    (git commit -m 'github-actions: Update generated files' || echo "No changes to commit") &&
    git push origin main`)})();
