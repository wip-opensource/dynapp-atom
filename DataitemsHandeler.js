const request = require('request')
const fs = require('fs');
const {File} = require('atom')
const {Project} = require('atom')
const path = require('path')
let filelistHandeler = require('./FilelistHandeler.js')


var addOnDeleteListener = function(){
  try{
    var cred = getCred()
    var filepath = atom.project.getPaths()[0] + '/data-items/'
    fs.readdir(filepath, (err, files) => {
      files.forEach(file => {
        var fileobj = new File(filepath + file)
        fileobj.onDidDelete(function(cb){
          var urlString = cred.baseUrl + "dynapp-server/rest/groups/" + cred.group + "/apps/" + cred.app + "/data-items/" + file
          const settings = {
            buttons: [
              {
                onDidClick: function() {
                  var options = {
                    url: urlString,
                    method: 'DELETE',
                    auth: {
                      'user': cred.username,
                      'pass': cred.password
                    }
                  };

                  function callback(error, response, body) {
                    if(response.statusCode != 204){
                      atom.notifications.addError("Kunde inte ta bort filen", options)
                    }
                    else{
                      atom.notifications.addInfo("Filen är nu borttagen", options)
                    }
                  }
                  request(options, callback);

                },
                text: "TA BORT"
              }
            ]}
          atom.notifications.addWarning("Vill du ta bort denna fil även på serven?", settings)
        });
      });
    });

  }catch(ex){

  }
}

module.exports.addOnDeleteListener = addOnDeleteListener;

// Make a post request to the server for new files
var postFile = function(file){
  return new Promise((resolve, reject) => {
    var cred = getCred()

    var filepath = atom.project.getPaths()[0] + '/data-items/' + file;
    var urlString = cred.baseUrl + "dynapp-server/rest/groups/" + cred.group + "/apps/" + cred.app + "/data-items/" + file
    var  headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Category': '2',

      };

    if (file.indexOf('.css') != -1) {
      headers['Content-Type'] = 'text/css'
    } else if (file.indexOf('.html') != -1) {
      headers['Content-Type'] = 'text/html'
    } else if (file.indexOf('.js') != -1) {
      headers['Content-Type'] = 'text/javascript'
    } else if(file.indexOf('.json') != -1){

    } else{
      atom.notifications.addError("Kan inte spara filen på serven, fel filformat", undefined)
      return;
    }

    var content = fs.readFileSync(filepath, 'utf8')
    var options = {
      url: urlString,
      method: 'POST',
      headers: headers,
      body: content,
      auth: {
        'user': cred.username,
        'pass': cred.password
      }
    };

    function callback(error, response, body) {
      if(response.statusCode != 204){
        atom.notifications.addWarning("Kunde inte spara data. Kolla dina uppgifter i dynappconfig.json", null)
        reject()
      }
      resolve()
      filelistHandeler.saveFileListToLocal()
      addOnDeleteListener()
    }
    request(options, callback);
  });
}

module.exports.postFile = postFile;

// get project credentials
var getCred = function(){
  var filepath = atom.project.getPaths()[0] + '/dynappconfig.json'
  var content = fs.readFileSync(filepath, 'utf8')
  var cred = JSON.parse(content)
  return cred
}


// upload all files from a filelist
var uploadFile = function(file, filename) {
  return new Promise((resolve, reject) => {
    var cred = getCred()
    console.log('uploading file ' + file)

        if(!file['dirty']){
          resolve()
          return;
        }

        var filepath = atom.project.getPaths()[0] + '/data-items/' + filename;
        var urlString = cred.baseUrl + "dynapp-server/rest/groups/" + cred.group + "/apps/" + cred.app + "/data-items/" + filename
        var  headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Category': file['cat'],

          };
          /*
        if (filename.indexOf('.css') != -1) {
          headers['Content-Type'] = 'text/css'
        } else if (filename.indexOf('.html') != -1) {
          headers['Content-Type'] = 'text/html'
        } else if (filename.indexOf('.js') != -1) {
          headers['Content-Type'] = 'text/javascript'
        } else {
          resolve()
          return;
        }
        */

        var content = fs.readFileSync(filepath, 'utf8')
        var options = {
          url: urlString,
          method: 'PUT',
          headers: headers,
          body: content,
          auth: {
            'user': cred.username,
            'pass': cred.password
          }
        };
        var name = filename
        var callback =  function(error, response, body) {
          if(response.statusCode > 204){
            atom.notifications.addWarning("Kunde inte spara alla filer. Kolla dina uppgifter i dynappconfig.json", null)
          }
          console.log("whhow " + filename)
          console.log(response)
          var resolveObj = {
            name:name,
            isUploaded: true,
            list:"fileList"
          }
          resolve(resolveObj)
        }
        request(options, callback);
      });
}

module.exports.uploadFile = uploadFile

// download a specific file
var downloadFile = function(file, etag) {
  return new Promise(function(resolve,reject){
    var cred = getCred()

    filepath = atom.project.getPaths()[0]

    var options = {
      url: cred.baseUrl + "dynapp-server/rest/groups/" +cred.group + "/apps/" + cred.app + "/data-items/" + file,
      auth: {
        user: cred.username,
        password: cred.password
      },
      headers:{}
    }



    if(etag != undefined){
      etag = etag.replace("\"", '')
      etag = etag.replace("\"", '')
      options['headers']["If-None-Match"] = "\"" + etag +"\""
    }

    request(options, function(err, res, body) {
      if (err) {
        console.dir(err)
        reject()
        return
      }
      if(res.statusCode == 200){
        var resolveObj = {
          fileName: file,
          etag: res.headers.etag,
          list:"fileList"
        }
        fs.writeFile(filepath + '/data-items/' + file, body, 'binary', function(err) {});
        resolve(resolveObj)
      }else{
        resolve()
      }

    })
  })
}

module.exports.downloadFile = downloadFile
