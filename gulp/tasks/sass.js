var gulp         = require('gulp');
var sass         = require('gulp-sass');
var prefix       = require('gulp-autoprefixer');
var minifyCSS    = require('gulp-minify-css');
var gutil        = require('gulp-util');
var path         = require('path');
var gzip         = require('gulp-gzip');
var livereload   = require('gulp-livereload');
var handleErrors = require('../util/handleErrors');
var pkg          = require('../../package.json');
var rename       = require('gulp-rename');

gulp.task('holdingStyles', function () {
    return gulp.src(pkg.folders.src+'/sass/holding.scss')
        .pipe(sass())
        .pipe(prefix("ie >= 8", "ff >= 3", "safari >= 4", "opera >= 12", "chrome >= 4"))
        .pipe(minifyCSS())
        .pipe(rename('main.css'))
        .pipe(gzip({ append: false }))
        .pipe(gulp.dest(pkg.folders.dest+'/holding/css'));
});

gulp.task('sass', ['images'], function () {
    if (global.isWatching) {
        livereload.listen();
    }

    return gulp.src(pkg.folders.src+'/sass/main.scss')
        .pipe(sass())
        .on('error', handleErrors)
        .pipe(prefix("ie >= 8", "ff >= 3", "safari >= 4", "opera >= 12", "chrome >= 4"))
        .pipe(global.isWatching ? gutil.noop() : minifyCSS())
        // always gzip, make sure headers set by server
        .pipe(gzip({ append: false }))
        .pipe(gulp.dest(pkg.folders.dest+'/css'))
        .pipe(!global.isWatching ? gutil.noop() : livereload({
            host: '127.0.0.1',
            port: 3000
        }));
});
