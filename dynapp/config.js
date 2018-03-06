const path = require('path');
const fs = require('fs-extra');

function projectPath() {
  return process.cwd();
}

module.exports = {
  projectPath,
  // TODO: Need a better interface to this
  config () {
    let content = fs.readFileSync(path.join(projectPath(), 'dynappconfig.json'), 'utf8');
    return JSON.parse(content);
  }
}
