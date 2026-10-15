"""Shared pytest configuration and a Windows/WSL compatibility shim.

genlayer-test direct mode deploys contracts into short-lived temporary files.
On Windows these files can still be memory-mapped or held open by the runner
when teardown calls unlink, raising PermissionError and failing otherwise green
tests. This shim defers failed deletions until interpreter exit so the same
suite passes cleanly on Windows and WSL without changing any test logic.
"""

import atexit
import os
import shutil
import sys
import tempfile

_PENDING_REMOVALS: set[str] = set()


def _flush_pending() -> None:
    for path in list(_PENDING_REMOVALS):
        try:
            if os.path.isdir(path):
                shutil.rmtree(path, ignore_errors=True)
            elif os.path.exists(path):
                os.remove(path)
        except OSError:
            pass
        finally:
            _PENDING_REMOVALS.discard(path)


atexit.register(_flush_pending)

# Bind the ORIGINAL stdlib functions once, before any patching, so the shims
# below never call themselves recursively.
_ORIG_REMOVE = os.remove
_ORIG_RMTREE = shutil.rmtree


def _patched_remove(src, *args, **kwargs):
    try:
        return _ORIG_REMOVE(src, *args, **kwargs)
    except PermissionError:
        if sys.platform == "win32":
            _PENDING_REMOVALS.add(str(src))
            return None
        raise


def _patched_rmtree(path, *args, **kwargs):
    try:
        return _ORIG_RMTREE(path, *args, **kwargs)
    except PermissionError:
        if sys.platform == "win32":
            _PENDING_REMOVALS.add(str(path))
            return None
        raise


if sys.platform == "win32":
    os.remove = _patched_remove
    os.unlink = _patched_remove
    shutil.rmtree = _patched_rmtree

# Make TempDirectory teardown tolerant on Windows as well.
if sys.platform == "win32":
    _orig_td_cleanup = tempfile.TemporaryDirectory.cleanup

    def _safe_cleanup(self, *args, **kwargs):
        try:
            _orig_td_cleanup(self, *args, **kwargs)
        except (PermissionError, OSError):
            _PENDING_REMOVALS.add(str(self.name))

    tempfile.TemporaryDirectory.cleanup = _safe_cleanup
