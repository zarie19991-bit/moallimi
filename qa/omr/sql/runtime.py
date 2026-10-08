"""Short-lived PostgreSQL 17; local Unix socket only, no inherited connection settings."""
import json
import os
import subprocess
import tempfile
from pathlib import Path


class LocalPostgres:
    def __enter__(self):
        self.directory = Path(tempfile.mkdtemp(prefix="moallimi-synthetic-sql-"))
        self.socket = self.directory / "socket"
        self.socket.mkdir(mode=0o700)
        self.data = self.directory / "data"
        self.port = 56439
        # Do not inherit secrets, DATABASE_URL, PGSERVICE or libpq connection settings.
        self.env = {"PATH": os.environ["PATH"], "HOME": str(self.directory), "LANG": "C.UTF-8"}
        version = self.command(["postgres", "--version"]).stdout.strip()
        assert "17.6" in version, f"Original server major/minor expected: {version}"
        self.version = version
        self.command(["initdb", "-D", str(self.data), "-U", "postgres",
                      "-A", "trust", "--locale=C", "-E", "UTF8", "--no-instructions"])
        self.command(["pg_ctl", "-D", str(self.data), "-l", str(self.directory / "postgres.log"),
                      "-o", f"-c listen_addresses='' -c unix_socket_directories='{self.socket}' "
                            f"-c port={self.port}", "-w", "start"])
        self.sql("postgres", "CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; "
                 "CREATE ROLE service_role NOLOGIN BYPASSRLS;")
        assert self.sql("postgres", "SELECT current_setting('listen_addresses');").stdout.strip() == ""
        return self

    def command(self, command, **kwargs):
        result = subprocess.run(command, text=True, capture_output=True, env=self.env,
                                timeout=kwargs.pop("timeout", 90), **kwargs)
        if result.returncode:
            raise RuntimeError(result.stderr)
        return result

    def sql(self, database, text, *, allow_error=False):
        assert database in {"postgres", "omr_original", "omr_repaired"}
        result = subprocess.run(
            ["psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1",
             "-h", str(self.socket), "-p", str(self.port), "-U", "postgres",
             "-d", database],
            input=text, capture_output=True, text=True, env=self.env, timeout=25)
        if result.returncode and not allow_error:
            raise RuntimeError(result.stderr.strip())
        return result

    def json(self, database, text):
        return json.loads(self.sql(database, text).stdout.strip())

    def __exit__(self, *args):
        self.command(["pg_ctl", "-D", str(self.data), "-m", "fast", "-w", "stop"])
        # Keep this temporary, synthetic-only directory for audit; never remove user files.
