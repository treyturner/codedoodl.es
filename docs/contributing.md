# Creating doodles locally

The original contribution/review service closed in 2020. These file conventions
and local tools remain useful for self-hosted artwork; they do not submit to an
active review queue. Discuss archive additions with the fork maintainer.

## Submitting via GitHub

### Minimum requirements

These are the minimum number of files required for each doodle, these will be used to display / reference each individual doodle on the site / extension.

* <code>**index.html**</code>

	Every doodle must have a single `index.html` file as an entry point. This file must be situated in the root of the doodle directory, which should be located in `/doodles/<author_github_username>/<doodle_name>`.

* <code>**manifest.json**</code>

	Most importantly - each doodle requires a manifest file which contains all the metadata for the doodle, including doodle information / instructions, author details and tech used. You can manually create this file based on the [schema outlined here](manifest.md), or if you use the doodle-creation utility script (<code>utils/createDoodle.js</code>), the manifest will be automatically generated based on answers you have given.

### Step-by-step guide

**Route 1 - using `createDoodle.js` util script**

1. Fork repo and clone local version
2. `cd` in to local repo and run `npm ci (with Node 24.21.0 / npm 11.19.0)`
3. Run `npm run doodle:create`
4. Answer the questions within the interactive CLI - this creates a new directory within `/doodles/<author_github_username>/<doodle_name>`, and populates a `manifest.json` file for you
5. Paste in your doodle `index.html` and accompanying asset files / directories
6. Push to github
7. Submit pull request!

**Route 2 - DIY**

1. Fork repo and clone local version
2. Manually create directory at `/doodles/<author_github_username>/<doodle_name>`
3. Create `manifest.json` in this directory based on [schema outlined here](manifest.md)
4. Paste in your doodle `index.html` and accompanying asset files / directories
5. Push to github
6. Submit pull request!

## Preview

Run `npm run doodle:preview -- doodles/author/name` and open
http://127.0.0.1:3001. It supports both newly created plain files and the archive's
gzip convention. See [build.md](build.md) for bind/port options. Existing
sketch directories are never overwritten by the creator.

## Historical submission form

The original project accepted a Google Form or GitHub pull request, followed by
maintainer review and publication using the historical AWS tools. This fork has
no active form submission service. The `/form` redirect and its Google Form URL
have been removed; `/form` now returns 404.
