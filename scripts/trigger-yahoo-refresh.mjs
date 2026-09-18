const owner = process.env.GITHUB_OWNER || "Chasin-the-Shiva";
const repository =
  process.env.GITHUB_REPOSITORY || "chasing-the-shiva-assistant";
const workflow =
  process.env.GITHUB_WORKFLOW_FILE || "refresh-yahoo-snapshot.yml";
const branch = process.env.GITHUB_BRANCH || "main";
const token = process.env.GITHUB_ACTIONS_TOKEN;

if (!token) {
  console.error("GITHUB_ACTIONS_TOKEN is not configured.");
  process.exit(1);
}

const url =
  `https://api.github.com/repos/${owner}/${repository}/actions/workflows/${workflow}/dispatches`;

const response = await fetch(url, {
  method: "POST",
  headers: {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "shivagpt-render-scheduler",
  },
  body: JSON.stringify({
    ref: branch,
    inputs: { rebuild_history: "false" },
  }),
});

if (response.status !== 204) {
  const body = await response.text();
  console.error(
    `GitHub workflow dispatch failed with HTTP ${response.status}: ${body.slice(0, 500)}`,
  );
  process.exit(1);
}

console.log(
  `Dispatched ${owner}/${repository} workflow ${workflow} on ${branch}.`,
);
