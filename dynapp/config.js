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

function workPath () {
  let wPath = config().workpath || '';
  return path.join(projectPath(), wPath);
}

function workFilePath (relativePath) {
  return path.join(workPath(), relativePath);
}

function config () {
  try {
    let content = fs.readFileSync(projectFilePath('dynappconfig.json'), 'utf8');
    return JSON.parse(content);
  } catch(ex) {
    console.log('Could not find dynappconfig.json');
    return {};
  }
}

module.exports = {
  projectPath,
  projectFilePath,
  workPath,
  workFilePath,
  config
}
