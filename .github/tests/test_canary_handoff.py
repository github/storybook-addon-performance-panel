import json
import os
from pathlib import Path
import subprocess
import textwrap
import unittest


WORKFLOWS = Path(__file__).resolve().parents[1] / "workflows"
PUBLISH = (WORKFLOWS / "publish.yml").read_text()
BUILD = (WORKFLOWS / "canary-build.yml").read_text()
SHA = "abcdef0" + "0" * 33
RUN = {
    "repository": {"id": 1}, "head_repository": {"id": 2},
    "head_sha": SHA, "pull_requests": [{"number": 215}],
}
PR = {
    "number": 215, "state": "open", "labels": [{"name": "canary"}],
    "base": {"ref": "main", "repo": {"id": 1}},
    "head": {"sha": SHA, "repo": {"id": 2}},
}
DRIVER = """
const {script, run, pr} = JSON.parse(require('node:fs').readFileSync(0, 'utf8'));
const outputs = {}, calls = [];
const core = {setOutput: (key, value) => outputs[key] = value, notice: () => {}};
const context = {repo: {owner: 'github', repo: 'storybook-addon-performance-panel'},
  sha: 'default-branch-sha', payload: {repository: {id: 1}, workflow_run: run}};
const github = {rest: {
  pulls: {get: async args => { calls.push(['get', args]); return {data: pr}; }},
  issues: {
    listComments: async args => { calls.push(['list', args]); return {data: []}; },
    createComment: async args => { calls.push(['create', args]); },
  },
}};
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
new AsyncFunction('github', 'context', 'core', script)(github, context, core)
  .then(() => console.log(JSON.stringify({outputs, calls})))
  .catch(error => { console.error(error.message); process.exitCode = 1; });
"""


class CanaryHandoffTests(unittest.TestCase):
    def execute(self, name, pr=None, run=None):
        script = textwrap.dedent(
            PUBLISH.split(f"      - name: {name}\n", 1)[1]
            .split("          script: |\n", 1)[1].split("      - ", 1)[0]
        )
        return subprocess.run(
            ["node", "-e", DRIVER],
            input=json.dumps({"script": script, "run": RUN if run is None else run, "pr": PR if pr is None else pr}),
            env={**os.environ, "PR_NUMBER": "215", "PR_HEAD_SHA": SHA, "CANARY_VERSION": "1.3.1-canary.abcdef0"},
            capture_output=True, text=True, check=False,
        )

    def test_identifies_pr_from_github_metadata(self):
        result = self.execute("Identify canary PR")
        self.assertEqual(result.returncode, 0, result.stderr)
        data = json.loads(result.stdout)
        self.assertEqual(data["outputs"], {"number": 215, "sha": SHA})
        self.assertEqual(data["calls"][0][1]["pull_number"], 215)

    def test_rejects_invalid_run_metadata(self):
        for change in (
            {"repository": {"id": 99}}, {"pull_requests": []},
            {"pull_requests": [{"number": 215}, {"number": 216}]},
            {"pull_requests": [{"number": "215"}]}, {"head_sha": "invalid"},
        ):
            with self.subTest(change=change):
                result = self.execute("Identify canary PR", run={**RUN, **change})
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("unexpected repository or PR metadata", result.stderr)

    def test_skips_ineligible_prs(self):
        for change in (
            {"state": "closed"}, {"labels": []},
            {"head": {"sha": "0" * 40, "repo": {"id": 2}}},
            {"head": {"sha": SHA, "repo": {"id": 99}}},
            {"head": {"sha": SHA, "repo": None}},
            {"base": {"ref": "other", "repo": {"id": 1}}},
            {"base": {"ref": "main", "repo": {"id": 99}}},
        ):
            with self.subTest(change=change):
                result = self.execute("Identify canary PR", pr={**PR, **change})
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(json.loads(result.stdout)["outputs"], {})

    def test_rechecks_eligibility_before_publishing_and_commenting(self):
        for name in ("Verify current canary PR", "Comment on PR"):
            for change in ({"state": "closed"}, {"labels": []}, {"head": {"sha": "0" * 40}}):
                with self.subTest(step=name, change=change):
                    result = self.execute(name, pr={**PR, **change})
                    self.assertEqual(result.returncode, 0, result.stderr)
                    data = json.loads(result.stdout)
                    self.assertEqual(data["outputs"], {})
                    self.assertEqual([call[0] for call in data["calls"]], ["get"])

    def test_current_pr_can_publish_and_comment_on_verified_sha(self):
        result = self.execute("Verify current canary PR")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["outputs"], {"eligible": "true"})
        result = self.execute("Comment on PR")
        self.assertEqual(result.returncode, 0, result.stderr)
        _, args = json.loads(result.stdout)["calls"][-1]
        self.assertEqual(args["issue_number"], 215)
        self.assertIn("Published from abcdef0", args["body"])
        self.assertNotIn("default-branch-sha", args["body"])

    def test_workflow_trust_and_artifact_wiring(self):
        self.assertIn("  pull_request:\n", BUILD)
        self.assertNotIn("  pull_request:\n", PUBLISH)
        self.assertIn("    workflows: [Canary Build]\n", PUBLISH)
        for condition in ("event == 'pull_request'", "conclusion == 'success'", "path == '.github/workflows/canary-build.yml'"):
            self.assertIn(condition, PUBLISH)
        publisher = PUBLISH.split("  publish-canary:\n", 1)[1]
        for setting in (
            "run-id: ${{ github.event.workflow_run.id }}",
            "github-token: ${{ secrets.GITHUB_TOKEN }}",
            "PR_HEAD_SHA: ${{ github.event.workflow_run.head_sha }}",
            "cancel-in-progress: false",
            "if: steps.current.outputs.eligible == 'true'",
        ):
            self.assertIn(setting, publisher)
        self.assertNotIn("actions/checkout@", publisher)
        self.assertNotIn("cache: npm", publisher)
        self.assertNotIn("id-token:", BUILD)
        self.assertIn("group: canary-build-${{ github.event.pull_request.number }}", BUILD)
        self.assertIn("cancel-in-progress: true", BUILD)


if __name__ == "__main__":
    unittest.main()
