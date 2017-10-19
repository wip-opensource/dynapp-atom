const path = require('path');
const fs = require('fs');

module.exports = {
  mkdirp: function(filepath, pwd) {
    let dirs = filepath.split(path.sep);
    let createdDirs = [];

    dirs.forEach((dir, i) => {
      /* Last element should be a file, so dont create a directory for that. */
      if (i == dirs.length - 1) {
        return;
      }
      /* If we get an exception that dir exists, just continue happily. Rethrow other errors. */
      try {
        fs.mkdirSync(path.join(pwd, createdDirs.join(path.sep), dir));
      } catch (e) {
        if (e.code !== 'EEXIST') {
          throw e;
        }
      }
      /* Append dir to created dirs, so the next dir will be added to this one. */
      createdDirs.push(dir);
    });
  }
}
