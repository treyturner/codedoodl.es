# Retired publishing tools

The tasks in `gulp/` preserve the former S3, CloudFront, and Elastic Beanstalk
publishing source. They are not registered by the root Gulpfile and their AWS,
Gulp 3, archive, and deployment dependencies are not installed by `npm ci`.
`dependencies.json` records the historical declarations for reference; it is
not an installable package or a supported deployment workflow.

Related historical helpers remain in `utils/`: `uploadToS3`,
`invalidateCloudfront`, `masterManifestManager`, `validateDoodleUpload`,
`getCredentials`, `cloneRepo`, and `deployer`. The application's webhook still
returns its existing disabled-deployer response before reaching these imports.
Restoring this service requires a separate AWS SDK and deployment migration.

Local `npm run doodle:create` and `npm run doodle:preview -- <directory>` remain
available with development dependencies installed. Container publishing uses
the tested image in `.github/workflows/build-push.yml`.
