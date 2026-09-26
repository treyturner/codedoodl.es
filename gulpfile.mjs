import gulp from 'gulp';
import { clean, scripts, vendor, styles, images, fonts, data, revision, html } from './build/tasks.mjs';
import { watchSources, serve } from './build/development.mjs';

function compile(callback) {
  const errors = [];
  // Gulp parallel normally reports the first error before other tasks finish.
  // Drain all branches before reporting failure so a queued watch build is safe.
  const tasks = [scripts, vendor, styles, images, fonts, data].map(task => {
    const wrapped = async () => { try { await task(); } catch (error) { errors.push(error); } };
    wrapped.displayName = task.name;
    return wrapped;
  });
  gulp.parallel(...tasks)(error => callback(error || (errors.length
    ? new AggregateError(errors, errors.map(item => item.message).join('\n')) : undefined)));
}

// Run each prerequisite once, then hash/encode complete outputs and render.
export const build = gulp.series(
  clean,
  compile,
  revision,
  html,
);
export const watch = gulp.series(build, () => watchSources(build));
export const dev = gulp.series(build, () => serve(build));
export default watch;
