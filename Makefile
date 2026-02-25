.PHONY: help bootstrap deps-cli deps-ext build-ext package-ext install-ext install release clean validate-protocol ci-check

help:
	@echo "Feedback Loop commands:"
	@echo "  make release      - 开发者一键发布 (bump+build+prebuilt+install+rules)"
	@echo "  make install      - 用户安装 (从 prebuilt 安装，无需打包)"
	@echo "  make bootstrap    - install CLI and extension dependencies"
	@echo "  make build-ext    - compile extension"
	@echo "  make package-ext  - package VSIX"
	@echo "  make install-ext  - install VSIX to editor CLI"
	@echo "  make validate-protocol - validate protocol schemas"
	@echo "  make ci-check     - run local CI checks"
	@echo "  make clean        - clean extension dist"

bootstrap: deps-cli deps-ext

deps-cli:
	cd apps/feedback-cli && uv sync

deps-ext:
	cd apps/extension && npm install

build-ext:
	cd apps/extension && npm run compile

package-ext:
	cd apps/extension && npm run package

install-ext:
	code --install-extension apps/extension/dist/feedback-loop.vsix --force

release:
	bash scripts/release.sh

install:
	bash scripts/install.sh

validate-protocol:
	python3 scripts/validate_protocol.py

ci-check: validate-protocol
	cd apps/extension && npm run compile
	PYTHONPATH=apps/feedback-cli/src python3 -c "import feedback.cli, feedback.collector, feedback.config"

clean:
	cd apps/extension && npm run clean
