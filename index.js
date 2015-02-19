var through = require('through2');
var gutil = require('gulp-util');
var objectAssign = require('object-assign');
var PluginError = gutil.PluginError;
var jison = require('jison');

const PLUGIN_NAME = 'gulp-jison';

module.exports = function (options) {
    options = options || {};

    // always produce a working function
    function mkF(f, default_f) {
        if (typeof f !== 'function') {
            return default_f;
        }
        return f;
    }

    return through.obj(function (file, enc, callback) {
        if (file.isNull()) {
            callback(null, file);
            return;
        }

        if (file.isStream()) {
            this.emit('error', new PluginError(PLUGIN_NAME, 'Streams not supported'));
            callback();
            return;
        }

        if (file.isBuffer()) {
            var fileOpts = objectAssign({}, options);
            
            // special callbacks:
            var preprocessor = mkF(fileOpts.preprocessor, function (file, content, options) {
                return content;
            });
            var postprocessor = mkF(fileOpts.postprocessor, function (file, content, options) {
                return content;
            });
            var customizer = mkF(fileOpts.customizer, function (file, options) {
                console.log("jison file: ", file, options);
            });
            
            // do not pollute the Jison environment with our own options:
            delete fileOpts.preprocessor;
            delete fileOpts.postprocessor;
            delete fileOpts.customizer;

            try {
                customizer(file, fileOpts);
                var source_contents = file.contents.toString();
                source_contents = preprocessor(file, source_contents, fileOpts);

                var gen = jison.Generator(source_contents, fileOpts);
                var dest_contents = gen.generate();

                dest_contents = postprocessor(file, dest_contents, fileOpts);
                file.contents = new Buffer(dest_contents);
                
                file.path = gutil.replaceExtension(file.path, ".js");
                this.push(file);
            } catch (error) {
                // Tweak the exception message to include the jison source file/path:
                // make it clear which of possibly many jison input files caused the exception.
                error.message += '   (in source file: ' + file.relative + ')';

                this.emit('error', new PluginError(PLUGIN_NAME, error));
            }
            callback();
        }
    });
}
