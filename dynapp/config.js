const path = require('path');
const fs = require('fs-extra');

// TODO: Should be passed as argument to Sync constructor instead, like `new Sync({projectPath: '...'})`.
// TODO: Pass as argument to not make any coupling to Atom.
function projectPath () {
  let pPath = atom.project.getPaths()[0];
  if (pPath == undefined) {
    console.log('Project path is not defined');
    return null;
  }
  return pPath;
}

function projectFilePath (relativePath) {
  return path.join(projectPath(), relativePath);
}

module.exports = {
  projectPath,
  projectFilePath,
  // TODO: Need a better interface to this
  config () {
    let content = fs.readFileSync(path.join(projectPath(), 'dynappconfig.json'), 'utf8');
    return JSON.parse(content);
  }
}
