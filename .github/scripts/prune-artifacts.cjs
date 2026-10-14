"use strict";

// Prune only artifacts of the explicitly selected name in the current repository.
// This never touches source files, releases, Pages deployments, PDFs or databases.
function chooseRemovals(artifacts, { keep, nowMs, graceMinutes, currentRunId }) {
  const ordered = [...artifacts]
    .filter(a => a && a.expired !== true)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const remove = [];
  let preserved = 0;
  for (const artifact of ordered) {
    if (preserved < keep) { preserved++; continue; }
    if (Number(artifact.workflow_run?.id) === currentRunId) continue;
    if (!Number.isFinite(Date.parse(artifact.created_at))) continue;
    if (nowMs - Date.parse(artifact.created_at) < graceMinutes * 60000) continue;
    remove.push(artifact);
  }
  return { ordered, remove };
}

async function run() {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const artifactName = process.env.ARTIFACT_NAME;
  const keep = Number(process.env.ARTIFACT_KEEP ?? "1");
  const graceMinutes = Number(process.env.ARTIFACT_GRACE_MINUTES ?? "20");
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo || "") || !token || !artifactName ||
      !Number.isInteger(keep) || keep < 1 || keep > 10 ||
      !Number.isInteger(graceMinutes) || graceMinutes < 0) {
    throw Error("Invalid artifact cleanup configuration");
  }
  const apiRoot = process.env.GITHUB_API_URL || "https://api.github.com";
  const headers = {
    Authorization: "Bearer " + token,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  const request = async (method, path) => {
    const response = await fetch(apiRoot + path, { method, headers });
    if (!response.ok) throw Error("GitHub API " + method + " " + path + " failed: HTTP " + response.status);
    return response.status === 204 ? null : response.json();
  };
  const records = [];
  for (let page = 1; page <= 20; page++) {
    const result = await request("GET", "/repos/" + repo + "/actions/artifacts?per_page=100&page=" + page + "&name=" + encodeURIComponent(artifactName));
    records.push(...result.artifacts.filter(a => a.name === artifactName));
    if (result.artifacts.length < 100) break;
    if (page === 20) throw Error("Artifact listing too large; refusing partial cleanup");
  }
  const { ordered, remove } = chooseRemovals(records, {
    keep, nowMs: Date.now(), graceMinutes, currentRunId: Number(process.env.GITHUB_RUN_ID || "0")
  });
  let deleted = 0, freed = 0, inProgress = 0;
  for (const artifact of remove) {
    // Never delete an artifact that another workflow might still be uploading/deploying.
    if (artifact.workflow_run?.id) {
      try {
        const run = await request("GET", "/repos/" + repo + "/actions/runs/" + artifact.workflow_run.id);
        if (run.status !== "completed") { inProgress++; continue; }
      } catch (error) {
        throw Error("Unable to verify artifact owner workflow " + artifact.id + ": " + error.message);
      }
    }
    await request("DELETE", "/repos/" + repo + "/actions/artifacts/" + artifact.id);
    deleted++;
    freed += artifact.size_in_bytes || 0;
    console.log("Removed expired-version artifact: " + artifact.name + " id=" + artifact.id);
  }
  console.log(JSON.stringify({ artifactName, knownActive: ordered.length, keptMinimum: keep,
    protectedInProgress: inProgress, deleted, estimatedFreedMiB: Math.round(freed / 1048576) }));
}
if (require.main === module) run().catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { chooseRemovals };