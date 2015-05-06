module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        concat: {
            css: {
                src: [
                    'lib/css/thirdparty/*.css',
                    'lib/css/freeboard/styles.css'
                ],
                dest: 'css/freeboard.css'
            },
            thirdparty : {
                src : [
                    [
                        'lib/js/thirdparty/head.js',
                        'lib/js/thirdparty/knockout.js',
                        'lib/js/thirdparty/jquery.js',
                        'lib/js/thirdparty/i18next.js',
                        'lib/js/thirdparty/i18next-init.js',
                        'lib/js/thirdparty/lodash.js',
                        'lib/js/thirdparty/jquery.gridster.js',
                        'lib/js/thirdparty/jquery.caret.js',
                        'lib/js/thirdparty/jquery.xdomainrequest.js',
                        'lib/js/thirdparty/jquery.validationEngine-en.js',
                        'lib/js/thirdparty/jquery.validationEngine-ja.js',
                        'lib/js/thirdparty/jquery.validationEngine.js',
                        'lib/js/thirdparty/moment.js',
                        'lib/js/thirdparty/moment-timezone.js',
                        'lib/js/thirdparty/codemirror.js',
                        'lib/js/thirdparty/codemirror-jshint.js',
                        'lib/js/thirdparty/codemirror-csslint.js',
                        'lib/js/thirdparty/colpick.js',
                        'lib/js/thirdparty/webfont.js',
                        'lib/js/thirdparty/d3.v3.min.js'
                    ]
                ],
                dest : 'js/freeboard.thirdparty.js'
            },
            fb : {
                src : [
                    'lib/js/freeboard/DatasourceModel.js',
                    'lib/js/freeboard/DeveloperConsole.js',
                    'lib/js/freeboard/DialogBox.js',
                    'lib/js/freeboard/FreeboardModel.js',
                    'lib/js/freeboard/FreeboardUI.js',
                    'lib/js/freeboard/JSEditor.js',
                    'lib/js/freeboard/PaneModel.js',
                    'lib/js/freeboard/PluginEditor.js',
                    'lib/js/freeboard/ValueEditor.js',
                    'lib/js/freeboard/WidgetModel.js',
                    'lib/js/freeboard/freeboard.js'
                ],
                dest : 'js/freeboard.js'
            },
            plugins : {
                src : [
                    'plugins/freeboard/plugin.ds.clock.js',
                    'plugins/freeboard/plugin.ds.json.js',
                    'plugins/freeboard/plugin.ds.yahoow.js',
                    'plugins/freeboard/plugin.ds.owm.js',
                    'plugins/freeboard/plugin.ds.playback.js',
                    'plugins/freeboard/plugin.ds.websocket.js',
                    'plugins/freeboard/plugin.ds.nodejs.js',
                    'plugins/freeboard/plugin.ds.mqtt.js',
                    'plugins/freeboard/plugin.wg.text.js',
                    'plugins/freeboard/plugin.wg.gmap.js',
                    'plugins/freeboard/plugin.wg.pointer.js',
                    'plugins/freeboard/plugin.wg.gauge.js',
                    'plugins/freeboard/plugin.wg.c3js.js',
                    'plugins/freeboard/plugin.wg.indicator.js',
                    'plugins/freeboard/plugin.wg.picture.js',
                    'plugins/freeboard/plugin.wg.html.js'
                ],
                dest : 'js/freeboard.plugins.js'
            },
            'fb+plugins' : {
                src : [
                    'js/freeboard.js',
                    'js/freeboard.plugins.js'
                ],
                dest : 'js/freeboard+plugins.js'
            }
        },
        cssmin : {
            css:{
                src: 'css/freeboard.css',
                dest: 'css/freeboard.min.css'
            }
        },
        uglify : {
            fb: {
                files: {
                    'js/freeboard.min.js' : [ 'js/freeboard.js' ]
                }
            },
            plugins: {
                files: {
                    'js/freeboard.plugins.min.js' : [ 'js/freeboard.plugins.js' ]
                }
            },
            thirdparty :{
                options: {
                    mangle : false,
                    beautify : false,
                    compress: true
                },
                files: {
                    'js/freeboard.thirdparty.min.js' : [ 'js/freeboard.thirdparty.js' ]
                }
            },
            'fb+plugins': {
                files: {
                    'js/freeboard+plugins.min.js' : [ 'js/freeboard+plugins.js' ]
                }
            }
        },
        'string-replace': {
            css: {
                files: {
                    'css/': 'css/*.css'
                },
                options: {
                    replacements: [{
                        pattern: /..\/..\/..\/img/ig,
                        replacement: '../img'
                    }]
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-string-replace');
    grunt.registerTask('default', [ 'concat:css', 'cssmin:css', 'concat:fb', 'concat:thirdparty', 'concat:plugins', 'concat:fb+plugins', 'uglify:fb', 'uglify:plugins', 'uglify:fb+plugins', 'uglify:thirdparty', 'string-replace:css' ]);
};
