/*
	npm install gulp --save-dev
	npm install gulp-minify-css --save-dev	//reduce critical bytes (CSS)
	npm install gulp-uglify --save-dev  //reduce critical bytes (JS)
	npm install gulp-htmlmin --save-dev  //reduce critical bytes (HTML)
  npm install gulp-autoprefixer --save-dev   //adds vendor prefixes (CSS)
  npm install gulp-svgmin --save-dev  //reduce bytes of .svg files
*/	

var gulp = require('gulp');
var minifyCss = require('gulp-minify-css');
var uglify = require('gulp-uglify');
var htmlmin = require('gulp-htmlmin');
var autoprefixer = require('gulp-autoprefixer');
var svgmin = require('gulp-svgmin');

//Minify HTML
gulp.task('miniHTML', function() {
  return gulp.src('dist/index.html')
    .pipe(htmlmin({collapseWhitespace: true}))
    .pipe(gulp.dest('dist'))
});

//Minify CSS
gulp.task('miniCSS', function() {  
  return gulp.src('dist/css/style.css')
    .pipe(minifyCss())
    .pipe(gulp.dest('dist/css'));
});

//Minify JS
gulp.task('miniJS', function() {
  return gulp.src('dist/js/main.js')
    .pipe(uglify())
    .pipe(gulp.dest('dist/js'));
});

//Autoprefix
gulp.task('autoP', function () {
    return gulp.src('src/css/style.css')
        .pipe(autoprefixer({
            browsers: ['last 2 versions'],
            cascade: false
        }))
        .pipe(gulp.dest('src/css'));
});

//Reduce svg file sizes:
gulp.task('miniSVG', function () {
  return gulp.src('dist/img/*.svg')
        .pipe(svgmin())
        .pipe(gulp.dest('dist/img'));
});
