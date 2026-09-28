# Restored site assets

The original custom asset hostname no longer resolves, but its public S3 bucket
still provided these assets on September 28, 2026:

- `project/img/share_thumbnail.jpg` is the original 500×500 site sharing image,
  copied unchanged from
  https://s3-eu-west-1.amazonaws.com/assets.codedoodl.es/static/img/share_thumbnail.jpg.
  SHA-256: `17d4a52e9b4a08e62b8379790449f347c30543a9fc7862d604bcbb4a388ba9be`.
- `project/sass/holding.scss` restores the standalone login/holding styles from
  https://s3-eu-west-1.amazonaws.com/assets.codedoodl.es/holding/css/main.css,
  retaining its Monosten A font, red background, white wordmark and Twitter link.
  Unused resets and animation styles are omitted. The application stylesheet's
  preloader relies on JavaScript and cannot replace this standalone stylesheet.

These sources ship in the repository and build into the image. Neither builds
nor deployed pages fetch these assets from the old bucket.
