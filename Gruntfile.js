module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n',
        mangle: true,
        compress: true,
        preserveComments: "some"
      },
      build: {
        src: 'secrets.js',
        dest: 'secrets.min.js'
      }
    },

    jasmine_nodejs: {
        // task specific (default) options
        options: {
            showColors: true,
            // FILED BUG : https://github.com/onury/grunt-jasmine-nodejs/issues/1
            // Helpers never load.
            specNameSuffix: '.js', // also accepts an array
            helperNameSuffix: 'helper.js',
            useHelpers: true
        },
        secrets: {
            // target specific options
            options: {
                useHelpers: true
            },
            // spec files
            specs: [
                "spec/**"
            ],
            helpers: [
                "spec/**"
            ]
        }
    },

    jshint: {
        all: ['Gruntfile.js', 'secrets.js', 'spec/**/*.js']
    },

    eslint: {
        target: ['secrets.js']
    },

    watch: {
      scripts: {
        files: ['**/*.js'],
        tasks: ['uglify', 'jasmine_nodejs', 'jshint', 'eslint'],
        options: {
          spawn: false,
        },
      },
    }

  });

  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-jasmine-nodejs');
  grunt.loadNpmTasks('grunt-check-modules');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-eslint');
  grunt.loadNpmTasks('grunt-contrib-watch');

  // Default task(s).
  grunt.registerTask('default', ['uglify', 'jasmine_nodejs', 'jshint', 'eslint', 'check-modules']);

};
