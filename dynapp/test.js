/*const { listFiles, listFiles2 } = require('./sync');*/
const fs = require('fs-extra');
const path = require('path');

function async(makeGenerator) {
  return function () {
    var generator = makeGenerator.apply(this, arguments)

    function handle(result) { // { done: [Boolean], value: [Object] }
      if (result.done) return result.value

      return result.value.then(function (res) {
        return handle(generator.next(res))
      }, function (err) {
        return handle(generator.throw(err))
      })
    }

    return handle(generator.next())
  }
}

function asyncGen(makeGenerator){
  return function* () {
    var generator = makeGenerator.apply(this, arguments);

    function* handle(result) { // { done: [Boolean], value: [Object] }
      if (result.done) {
        yield result.value;
      } else {
        let value =
        /*return result.value.then(function (res) {
          yield* handle(generator.next(res));
        }, function (err) {
          yield* handle(generator.throw(err));
        });*/
      }
    }

    yield* handle(generator.next());
  }
}

const listFiles3 = asyncGen(function* (folder, ignore) {
  let files = yield fs.readdir(folder);
  for (file of files) {
    if (ignore.indexOf(file) != -1) {
      continue;
    }
    let stats = yield fs.stat(path.join(folder, file));
    if (stats.isDirectory()) {
      let subFiles = yield listFiles3(path.join(folder, file), ignore);
      for (let subFile of subFiles) {
        yield path.join(file, subFile);
      }
    } else {
      yield file;
    }
  }
});

/*
(async function() {
    console.log('WAIT FOR STUFF');
    let data = await listFiles2('/Users/daniel/Dev/wip/kpmg-alert/data-items', ['node_modules']);
    console.log('DATA', data);
})();

return;
*/

for (let file of listFiles3('/Users/daniel/Dev/wip/kpmg-alert/data-items', ['node_modules'])) {
  console.log(file);
}

/*
listFiles3('/Users/daniel/Dev/wip/kpmg-alert/data-items', ['node_modules']).then(result => {
    console.log(result);
});
*/
