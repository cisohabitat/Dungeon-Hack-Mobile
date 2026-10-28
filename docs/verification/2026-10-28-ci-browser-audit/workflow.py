"""Require PyYAML; compare test selection and publication gates with baseline."""
import hashlib
import json
import pathlib
import re
import subprocess
import yaml

root = pathlib.Path(__file__).resolve().parents[3]
baseline = "f15a96a3012b424f9357e85a3e11dbfeb9d80ff9"
before_text = subprocess.check_output(
    ["git", "show", baseline + ":.github/workflows/test.yml"], cwd=root, text=True
)
after_text = (root / ".github/workflows/test.yml").read_text()
before, after = map(yaml.safe_load, [before_text, after_text])
assert before["permissions"] == after["permissions"] == {"contents": "read"}
assert before["jobs"].keys() == after["jobs"].keys()
for name in ["rules", "release"]:
    assert before["jobs"][name] == after["jobs"][name]


def selections(job):
    commands = []
    for step in job["steps"]:
        command = step.get("run", "")
        if not re.search(r"playwright test|test:webkit|run-browser-ci.sh", command):
            continue
        command = command.replace(
            "npm run test:webkit --", "npx playwright test --project=safari --workers=1"
        )
        command = re.sub(r"sh tools/run-browser-ci.sh [a-z-]+", "npx playwright test", command)
        commands.append(command)
    return commands


jobs = {}
for name in ["browser", "small", "safari", "perf"]:
    old, new = before["jobs"][name], after["jobs"][name]
    assert old.get("strategy") == new.get("strategy")
    assert old["runs-on"] == new["runs-on"] == "ubuntu-24.04"
    assert selections(old) == selections(new)
    assert old["steps"][0] == new["steps"][0], "checkout inputs must stay identical"
    for step in new["steps"]:
        if step.get("uses", "").startswith("actions/upload-artifact"):
            assert step["if"] == "${{ !cancelled() }}"
            assert "ci-diagnostics/" in step["with"]["path"]
            assert "test-results/" in step["with"]["path"]
    jobs[name] = {"selection_unchanged": True, "commands": selections(new)}

result = {"baseline": baseline, "matrix_and_gates_unchanged": True, "jobs": jobs,
          "workflow_sha256": hashlib.sha256(after_text.encode()).hexdigest()}
pathlib.Path(__file__).with_name("workflow.json").write_text(json.dumps(result, indent=2) + "\n")
print("All test selections, matrices, checkout inputs and publication gates are unchanged.")
