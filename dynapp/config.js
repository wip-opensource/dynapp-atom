const path = require('path');
const fs = require('fs-extra');

// TODO: Should be passed as argument to Sync constructor instead, like `new Sync({projectPath: '...'})`.
// TODO: Pass as argument to not make any coupling to Atom.
function projectPath() {
  return atom.project.getPaths()[0];
}

module.exports = {
  projectPath,
  // TODO: Need a better interface to this
  config () {
    let content = fs.readFileSync(path.join(projectPath(), 'dynappconfig.json'), 'utf8');
    return JSON.parse(content);
  }
}
