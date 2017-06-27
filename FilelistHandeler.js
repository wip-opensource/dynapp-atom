const request = require('request')
const fs = require('fs');
const {File} = require('atom')
const {Project} = require('atom')
const path = require('path')

// download only json, css, html and js
var validateFilesToDownload = function(files) {
  for (file in files.fileList) {
    if (file.indexOf('.json') != -1) {

    } else if (file.indexOf('.css') != -1) {

    } else if (file.indexOf('.html') != -1) {

    } else if (file.indexOf('.js') != -1) {

    } else {
      delete files.fileList[file];
    }
  }
  return files;
}

var saveFileListToLocal = function(){
  getFileList().then(function(result) {
    var files = validateFilesToDownload(result)
    var filepath = atom.project.getPaths()[0]
    fs.writeFile(filepath + '/.files.json', JSON.stringify(files, null, 4));
  });
}
module.exports.saveFileListToLocal = saveFileListToLocal;

// get a list of all the files in the server
var getFileList = function() {
  return new Promise(function(resolve,reject){
    var cred = getCred()

    var dataItemsList = new Promise(function(resolve, reject) {

      var options = {
        url: cred.baseUrl + "dynapp-server/rest/groups/" + cred.group + "/apps/" + cred.app + "/data-items/",
        auth: {
          user: cred.username,
          password: cred.password
        }
      }

      request(options, function(err, res, body) {
        if (err) {
          console.dir(err)
          return
        }

        if(res.statusCode != 200){
          atom.notifications.addWarning("Kunde inte hämta data. Kolla dina uppgifter i dynappconfig.json", null)
          reject()
          return
        }
        var fileList = JSON.parse(body)

        resolve(fileList)
      })
    })

    var dataSourcePromise = new Promise(function(resolve, reject){
      var options = {
        url: cred.baseUrl + "dynapp-server/rest/groups/" + cred.group + "/apps/" + cred.app + "/source/",
        auth: {
          user: cred.username,
          password: cred.password
        }
      }

      request(options, function(err, res, body) {
        if (err) {
          console.dir(err)
          return
        }

        if(res.statusCode != 200){
          atom.notifications.addWarning("Kunde inte hämta data. Kolla dina uppgifter i dynappconfig.json", null)
          reject()
          return
        }
        var fileList = JSON.parse(body)
        var datasources = {}
        for(index in fileList){
          datasources[fileList[index]] = {}
        }
        resolve(datasources)
      })
    });


    var dataObjectList = new Promise(function(resolve,reject){
      var options = {
        url: cred.baseUrl + "dynapp-server/rest/groups/" + cred.group + "/apps/" + cred.app + "/data-object-entities/",
        auth: {
          user: cred.username,
          password: cred.password
        }
      }

      request(options, function(err, res, body) {
        if (err) {
          console.dir(err)
          return
        }

        if(res.statusCode != 200){
          atom.notifications.addWarning("Kunde inte hämta data. Kolla dina uppgifter i dynappconfig.json", null)
          reject()
          return
        }
        var fileList = JSON.parse(body)
        var dataobjects = {}
        for(index in fileList){
          dataobjects[fileList[index]] = {}
        }
        resolve(dataobjects)
      })
    });



    Promise.all([dataSourcePromise, dataItemsList, dataObjectList]).then(function(obj){
      var obj = {
        dataSources: obj[0],
        fileList:obj[1],
        dataObjects: obj[2]
      }

      resolve(obj)
    });
  })
}

// get project credentials
var getCred = function(){
  var filepath = atom.project.getPaths()[0] + '/dynappconfig.json'
  var content = fs.readFileSync(filepath, 'utf8')
  var cred = JSON.parse(content)
  return cred
}

module.exports.getFileList = getFileList;
