import io
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import textwrap
import unittest


WORKFLOW = Path(__file__).resolve().parents[1] / "workflows" / "publish.yml"
VALIDATION_STEP = textwrap.dedent(
    WORKFLOW.read_text().split("      - name: Validate canary package\n", 1)[1]
    .split("        run: |\n", 1)[1]
    .split("      - name: Verify current canary PR\n", 1)[0]
)
HEAD_SHA = "abcdef0" + "0" * 33
MANIFEST = {"name": "@github-ui/storybook-addon-performance-panel", "version": "1.3.1-canary.abcdef0"}


def entry(name, content=b"", kind=tarfile.REGTYPE):
    info = tarfile.TarInfo(name)
    info.type, info.size = kind, len(content)
    return info, content


def package(manifest=MANIFEST):
    return entry("package/package.json", json.dumps(manifest).encode())


class CanaryValidationTests(unittest.TestCase):
    def validate(self, entries, sha=HEAD_SHA, archive_count=1, archive_name="canary"):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "canary-package").mkdir()
            for index in range(archive_count):
                path = root / "canary-package" / f"{archive_name}-{index}.tgz"
                with tarfile.open(path, "w:gz") as archive:
                    for info, content in entries:
                        archive.addfile(info, io.BytesIO(content))
            output = root / "output"
            output.touch()
            result = subprocess.run(
                ["bash", "--noprofile", "--norc", "-eo", "pipefail", "-c", VALIDATION_STEP],
                env={**os.environ, "RUNNER_TEMP": str(root), "GITHUB_OUTPUT": str(output), "PR_HEAD_SHA": sha},
                capture_output=True, text=True, check=False,
            )
            return result, output.read_text(), root / "canary-package" / f"{archive_name}-0.tgz"

    def assert_rejected(self, entries, **options):
        result, output, _ = self.validate(entries, **options)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Invalid canary archive", result.stderr)
        self.assertEqual(output, "")

    def test_valid_packages(self):
        for extra in (
            {}, {"tag": "canary"}, {"publishConfig": {}},
            {"publishConfig": {"registry": "https://registry.npmjs.org/"}},
            {"publishConfig": {"access": "public"}},
            {"publishConfig": {"registry": "https://registry.npmjs.org/", "access": "public"}},
        ):
            with self.subTest(extra=extra):
                result, output, path = self.validate([
                    entry("package/", kind=tarfile.DIRTYPE),
                    package({**MANIFEST, **extra}),
                    entry("package/dist/", kind=tarfile.DIRTYPE),
                    entry("package/dist/index.js", b"export {};"),
                ])
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(output, f"version={MANIFEST['version']}\narchive={path}\n")

    def test_replacement_manifests(self):
        for path in (
            "other/package.json", "package/./package.json", "package/dist/../package.json",
            "./package/package.json", "/package/package.json", "package//package.json",
            "package/package.json", "package\\package.json",
        ):
            with self.subTest(path=path):
                self.assert_rejected([package(), entry(path, b'{"version":"9.0.0"}')])

    def test_invalid_archive_entries(self):
        cases = [
            [], [entry("package/index.js")],
            [entry("package/package.json/", kind=tarfile.DIRTYPE)],
            [package(), entry("package/index.js"), entry("package/index.js")],
            [package(), entry("package/dist"), entry("package/dist/index.js")],
            [package(), entry("package/dist/index.js"), entry("package/dist")],
        ]
        cases += [
            [package(), entry("package/alias", kind=kind)]
            for kind in (tarfile.SYMTYPE, tarfile.LNKTYPE, tarfile.FIFOTYPE, tarfile.CHRTYPE, tarfile.BLKTYPE)
        ]
        for index, entries in enumerate(cases):
            with self.subTest(case=index):
                self.assert_rejected(entries)

    def test_archive_count(self):
        for count in (0, 2):
            with self.subTest(count=count):
                self.assert_rejected([package()], archive_count=count)

    def test_archive_path_cannot_inject_outputs(self):
        self.assert_rejected([package()], archive_name="canary\nversion=9.0.0")

    def test_invalid_manifests(self):
        cases = [{"name": "other-package"}]
        cases += [{"version": value} for value in (
            "1.3.1", "1.3.1-canary.0000000", "1.3.1-canary.abcdef0.1",
            "1.3.1-canary.abcdef0+metadata", "01.3.1-canary.abcdef0", None,
        )]
        cases += [{"publishConfig": value} for value in (
            {"https-proxy": "https://proxy.invalid", "strict-ssl": False},
            {"registry": "https://registry.npmjs.org/", "strict-ssl": False},
            {"registry": "https://registry.invalid/"}, {"access": "restricted"},
            {"tag": "latest"}, {"_authToken": "untrusted"},
            {"registry": "https://registry.npmjs.org/", "extra": True},
            {"registry": ["https://registry.npmjs.org/"]}, None, [], "invalid",
        )]
        cases += [{"tag": value} for value in ("latest", "next", "", None, False, [], {})]
        for extra in cases:
            with self.subTest(extra=extra):
                self.assert_rejected([package({**MANIFEST, **extra})])
        for manifest in (None, [], "invalid"):
            with self.subTest(manifest=manifest):
                self.assert_rejected([package(manifest)])

    def test_invalid_head_sha(self):
        self.assert_rejected([package()], sha="not-a-sha")

    def test_manifest_is_data_not_a_command(self):
        for content in (b"not JSON", b"NaN", b'--eval=process.stdout.write("OPTION_EXECUTED")'):
            with self.subTest(content=content):
                self.assert_rejected([entry("package/package.json", content)])


if __name__ == "__main__":
    unittest.main()
