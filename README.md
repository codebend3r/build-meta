# build-meta

Writes a `meta.json` describing the current build: package version, build date, environment, git branch, and the last commit's author and hash. Zero dependencies. Needs Node 18.3 or newer and `git` on the PATH.

## Install

```sh
npm i -D build-meta
```

## Generate

Run it from the project root and point it at the folder that should receive `meta.json`:

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

`--env` falls back to `NODE_ENV`, then `PROFILE`, then `development`. The command exits non-zero if the flag is missing, the folder does not exist, or the project is not a git repository, so a broken build cannot ship stale or empty metadata.

## Output

`buildDate` is Eastern Time (America/Toronto).

```json
{
  "version": "0.0.12",
  "buildDate": "09-05-2026 01:12:24 AM ET",
  "buildEnv": "development",
  "branchName": "master",
  "lastCommitAuthor": "Chester Rivas",
  "lastCommitHash": "89b9101fd08a4d83ec44b64f1e617e0dca1233b7"
}
```

## Use in the app

Import the file and hang it on a namespaced window object so it is inspectable in the browser console:

```js
import meta from './meta.json';

window.yourcompany = window.yourcompany || {};
window.yourcompany.meta = window.yourcompany.meta || meta;
```
