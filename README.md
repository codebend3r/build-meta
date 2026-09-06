# build-meta

A CLI that writes a `meta.json` describing the current build: package version, build date, environment, git branch, and the last commit's author and hash.

It has no runtime dependencies. It needs Node 24 or newer and `git` on the PATH.

## Install

```sh
npm i -D build-meta
```

Note: the version currently on npm (0.0.12) is the older implementation, which depends on `yargs`, `moment`, `moment-timezone`, `jsonfile`, and several git helpers. The dependency-free rewrite documented here lives in this repository and has not been published yet.

## Generate

Run it from the directory that holds your `package.json`, and point `--src-folder` at the folder that should receive `meta.json`:

```sh
build-meta --src-folder src
build-meta --src-folder src --env production
```

Typically wired into a build script:

```json
{
  "scripts": {
    "prebuild": "build-meta --src-folder src"
  }
}
```

`--src-folder` is the only required flag. It takes a path relative to the current working directory, or an absolute one, and `--src-folder=src` works as well. The folder must already exist; the CLI does not create it. There is no positional form, so `build-meta src` is rejected.

`--env` sets `buildEnv`. When it is absent or empty, the value falls back to `NODE_ENV`, then `PROFILE`, then the literal `development`.

On success the CLI writes the file and also prints the object to stdout.

## Failures

Every failure exits with status 1:

| Cause | Output |
| --- | --- |
| `--src-folder` missing | `build-meta: --src-folder <dir> is required` |
| Unknown flag, or a positional argument | `parseArgs` error and a stack trace |
| No `package.json` in the working directory | Module resolution error and a stack trace |
| Not a git repository, or `git` not on the PATH | git's own stderr, then a stack trace |
| `--src-folder` points at a folder that does not exist | `ENOENT` and a stack trace |

Only the first case is handled with a friendly message; the rest surface as uncaught exceptions. The git commands run before the file is written, so a bad `--src-folder` fails at the last step, after the git work has already happened.

## Output

`buildDate` is formatted in Eastern Time (`America/Toronto`). The timezone and the format are hardcoded and cannot be configured.

```json
{
  "version": "1.2.3",
  "buildDate": "09-05-2026 10:44:01 PM ET",
  "buildEnv": "production",
  "branchName": "main",
  "lastCommitAuthor": "CJ Rivas",
  "lastCommitHash": "907761dd591f6bc3a69a514092acfb8c147b73cf"
}
```

`version` is read from the `package.json` in the current working directory, not from the git root and not from build-meta's own package.

`branchName` comes from `git rev-parse --abbrev-ref HEAD`, which returns the string `HEAD` when the repository is in a detached HEAD state. Many CI systems check out a detached commit, so expect `"branchName": "HEAD"` there unless a branch is checked out explicitly.

## Tests

```sh
npm test
```

Node 24 is pinned for the repo in `.node-version` and `.nvmrc`, so `fnm use` or `nvm use` selects the right runtime before running anything. The suite runs on the `node:test` runner with no dependencies. Each test builds a temporary project with its own git repository and runs the CLI against it, so it checks the file that actually ships rather than an importable copy of its logic.

## Use in the app

`meta.json` is a plain JSON file, so any bundler that resolves JSON imports can pull it in. One way to make it inspectable from the browser console:

```js
import meta from './meta.json';

window.yourcompany = window.yourcompany || {};
window.yourcompany.meta = window.yourcompany.meta || meta;
```
