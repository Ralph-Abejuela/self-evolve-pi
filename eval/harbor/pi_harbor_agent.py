"""Harbor adapter: pi coding agent with an optional self-evolve extension arm.

Extends Harbor's built-in ``pi`` installed agent. Two arms share the exact same
container floor (no global extensions exist inside the task image), so the only
difference between arms is the harness extension itself.

Control via agent env (--ae) or process env:
  PI_HARBOR_VARIANT   "baseline" (default) | "extension"
  PI_HARBOR_EXT_DIR   host directory of the extension (uploaded into the container)
  PI_HARBOR_AUTH_B64  base64 of an auth.json to seed the container's ~/.pi/agent
                      (for providers Harbor cannot resolve itself)
  PI_HARBOR_MODELS_B64 base64 of a models.json to seed likewise (optional)

Run:
  harbor run -d terminal-bench@2.1 -a eval.harbor.pi_harbor_agent:PiExtAgent \
      -m opencode-go/deepseek-v4.1-flash --ae PI_HARBOR_VARIANT=extension ...
"""

import shlex
from typing import Annotated, override

from harbor.agents.installed.pi import Pi, PiOptions
from harbor.agents.options import Cli
from harbor.environments.base import BaseEnvironment
from pydantic import Field

_REMOTE_EXT_DIR = "/tmp/harbor-pi-selfevolve"


class PiExtOptions(PiOptions):
    # Renders as `--extension <path>` on the pi command line via format=.
    extension_path: Annotated[
        str | None,
        Cli("--extension", format="--extension {value}"),
    ] = Field(default=None, description="Remote extension entrypoint to load.")


class PiExtAgent(Pi):
    options_model = PiExtOptions
    options: PiExtOptions

    @staticmethod
    @override
    def name() -> str:
        return "pi-ext"

    @override
    async def install(self, environment: BaseEnvironment) -> None:
        await super().install(environment)

        variant = self._get_env("PI_HARBOR_VARIANT")
        ext_dir = self._get_env("PI_HARBOR_EXT_DIR")
        if variant == "extension":
            if not ext_dir:
                raise ValueError(
                    "PI_HARBOR_VARIANT=extension requires PI_HARBOR_EXT_DIR"
                )
            await environment.upload_dir(ext_dir, _REMOTE_EXT_DIR)
            if self.options.extension_path is None:
                self.options.extension_path = f"{_REMOTE_EXT_DIR}/index.ts"
            self.logger.info(
                "extension arm: uploaded %s, loading %s", ext_dir, self.options.extension_path
            )

        # Seed provider auth for providers Harbor's credential resolution does
        # not know (e.g. opencode-go). Values come base64-encoded via env.
        auth_b64 = self._get_env("PI_HARBOR_AUTH_B64")
        models_b64 = self._get_env("PI_HARBOR_MODELS_B64")
        if auth_b64 or models_b64:
            home_res = await self.exec_as_agent(environment, command="echo $HOME")
            home = (home_res.stdout or "").strip().splitlines()[-1]
            config_dir = f"{home}/.pi/agent"
            await self.exec_as_agent(
                environment, command=f"mkdir -p {shlex.quote(config_dir)}"
            )
            for name, b64 in (("auth.json", auth_b64), ("models.json", models_b64)):
                if not b64:
                    continue
                await self.exec_as_agent(
                    environment,
                    command=(
                        f"echo {shlex.quote(b64)} | base64 -d > "
                        f"{shlex.quote(config_dir)}/{name} && "
                        f"chmod 600 {shlex.quote(config_dir)}/{name}"
                    ),
                )
            self.logger.info("seeded pi config in %s", config_dir)
