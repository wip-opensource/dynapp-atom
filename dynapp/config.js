const path = require('path');
const fs = require('fs');

function projectPath() {
  return atom.project.getPaths()[0];
}

const _config = JSON.parse(
  fs.readFileSync(path.join(projectPath(), 'dynappconfig.json'), 'utf8')
);

module.exports = Object.assign({}, _config, {
  projectPath
});
