var gulp = require('gulp'),
    concat = require('gulp-concat'),
    uglify = require('gulp-uglify'),
    rename = require('gulp-rename'),
    es6ModuleTranspiler = require("gulp-es6-module-transpiler"),
    amdOptimize = require("amd-optimize");

gulp.task('amd', function() {
    gulp.src(["src/*.js", "src/**/*.js"])
    .pipe(es6ModuleTranspiler({ type: "amd" }))
    .pipe(amdOptimize('htmlliterals-preprocessor', { preserveComments: true }))
    .pipe(concat("htmlliterals-preprocessor.js"))
    .pipe(gulp.dest("dist"))
    .pipe(rename("htmlliterals-preprocessor.min.js"))
    .pipe(uglify())
    .pipe(gulp.dest("dist"));
});

gulp.task('default', ['amd']);
gulp.watch('src/*.js', ['amd']);
