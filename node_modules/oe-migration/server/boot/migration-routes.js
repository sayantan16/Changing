
var AdmZip = require('adm-zip');
var path = require('path');
var fs = require('fs');
var semver = require('semver');
var multer  = require('multer');
var uploadPath = path.resolve(process.cwd(), typeof global.it !== 'function' ? '' : 'test', 'uploads/');
var extractPath = path.resolve(process.cwd(), typeof global.it !== 'function' ? '' : 'test', 'extracts/');
var upload = multer({ dest: uploadPath });
var m;
try {
    m = require('oe-migration');
} catch (e) {
    m = require('../..');
}

var downloadVersion = '1.0.0';

module.exports = function (app) {
    app.get('/getzip', function (req, res) {
        var exportedPath = path.resolve(process.cwd(), typeof global.it !== 'function' ? '' : 'test', 'export');

        deleteFolderRecursive(exportedPath);

        var options = {};
        if (req.query && req.query.exportAllTables) {
            if (req.query.exportAllTables.toLowerCase() === 'true') options.exportAllTables = true;
        }
        if (req.query && req.query.tableList) options.tableList = req.query.tableList.split(',');

        m.exportTableDataToFolder(options, function (err, data) {
            if (data && data.warnings) {
                try {
                    fs.writeFileSync(path.join(exportedPath, 'warnings.txt'), data.warnings);
                } catch (e) {
                    // eslint-disable-next-line no-console
                    console.warn('Could not write warnings file: ' + e.message);
                }
            }
            if (err) {
                res.set({'content-type': 'application/json'});
                res.send(JSON.stringify({ message: err.message }));
            } else {
                var zip = new AdmZip();
                try {
                    zip.addLocalFolder(exportedPath);
                } catch (e) {
                    res.set({'content-type': 'application/json'});
                    return res.send(JSON.stringify({ message: e.message || JSON.stringify(e) }));
                }
                res.set({'content-type': 'application/octet-stream', 'content-disposition': 'attachment; filename=export-' + new Date().getTime() + '.zip' });
                res.send(zip.toBuffer());
                downloadVersion = semver.inc(downloadVersion, 'minor');
            }
        });
    });


    app.get('/uploadzip', function (req, res) {
        var form = '<html><head><title>Upload ZIP file</title></head>';
        form += "<body><form action='/uploadzip' method='post' enctype='multipart/form-data'>";
        form += "Upload Zip File: <input type='file' name='import'> <input type='submit' name='upload' value='Upload'>";
        form += '</form></body></html>';
        return res.send(form);
    });


    app.post('/uploadzip', upload.any(), function (req, res) {
        try {
            if (req.files) {
                if (req.files.length !== 1) {
                    var msg = 'Exactly one zip file needs to be uploaded.';
                    // eslint-disable-next-line no-console
                    console.error(msg);
                    res.status(422);
                    return res.send(msg);
                }
            } else {
                msg = 'No file uploaded';
                // eslint-disable-next-line no-console
                console.error(msg);
                res.status(422);
                return res.send(msg);
            }
            var src = req.files[0].path;
            var dest =  path.resolve(req.files[0].destination, new Date().getTime() + '-' + req.files[0].originalname);
            fs.renameSync(src, dest);
            var zip = new AdmZip(dest);
            deleteFolderRecursive(extractPath);
            if (!fs.existsSync(extractPath)) {
                try {
                    fs.mkdirSync(extractPath);
                } catch (e) {
                    // eslint-disable-next-line no-console
                    console.error(e.message || e);
                    res.status(422);
                    return res.send(e.message || e);
                }
            }
            try {
                zip.extractAllTo(extractPath, true);
            } catch (e) {
                // eslint-disable-next-line no-console
                console.error(e.message || e);
                res.status(422);
                return res.send(e.message || e);
            }

            var options = {verbose: true};
            m.setBasePath(extractPath);
            m.migrate(options, function (err, oldDbVersion, data) {
                if (err) {
                    // eslint-disable-next-line no-console
                    console.error(err.message || err);
                    res.status(422);
                    return res.send(err.message || err);
                }
                if (oldDbVersion && data) data.oldDbVersion = oldDbVersion;
                return res.send(data);
            });
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('An error occured while uploading data to import:');
            // eslint-disable-next-line no-console
            console.error(e.message || e);
            res.status(422);
            return res.send(e.message || e);
        }
    });
};


function deleteFolderRecursive(pathToDelete) {
    if (fs.existsSync(pathToDelete)) {
        fs.readdirSync(pathToDelete).forEach(function (file, index) {
            var curPath = path.resolve(pathToDelete, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                deleteFolderRecursive(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        try {
            fs.rmdirSync(pathToDelete);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn(e.message);
        }
    }
}
