.DEFAULT_GOAL := help

.PHONY: help install dev build preview check test verify audit format format-check

help:
	@printf '%s\n' \
	  'make install       Install dependencies from the lockfile' \
	  'make dev           Start the development server' \
	  'make build         Build the static site and offline shell' \
	  'make preview       Serve the existing production build locally' \
	  'make check         Run TypeScript checks' \
	  'make test          Run regression tests' \
	  'make verify        Check formatting, types, tests, and build' \
	  'make audit         Audit dependencies' \
	  'make format        Format source files' \
	  'make format-check  Check source formatting' \
	  '' \
	  'Pass Vite options with ARGS="--port 5174" for dev or preview.' \
	  'Set the build origin with PUBLIC_ORIGIN=https://www.picopos.app.'

install:
	npm ci

dev:
	npm run dev -- $(ARGS)

build:
	npm run build

preview:
	npm run preview -- $(ARGS)

check:
	npm run check

test:
	npm test

verify:
	npm run verify

audit:
	npm run audit

format:
	npm run format

format-check:
	npm run format:check
