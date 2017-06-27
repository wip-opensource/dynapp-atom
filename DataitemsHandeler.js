const request = require('request')
const fs = require('fs');
const {File} = require('atom')
const {Project} = require('atom')
const path = require('path')


var addOnDeleteListener = function(){
  try{
    var cred = getCred()
    var filepath = atom.project.getPaths()[0]
    fs.readdir(filepath, (err, files) => {
      files.forEach(file => {
        var fileobj = new File(filepath +'/data-items/'+ file)
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
    } else {
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
      console.log(response)
      resolve()
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

        if(!file['dirty']){
          resolve()
          return;
        }
        console.log('uploading file: ' + file)

        var filepath = atom.project.getPaths()[0] + '/data-items/' + filename;
        var urlString = cred.baseUrl + "dynapp-server/rest/groups/" + cred.group + "/apps/" + cred.app + "/data-items/" + filename
        var  headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Category': file['cat'],

          };

        if (filename.indexOf('.css') != -1) {
          headers['Content-Type'] = 'text/css'
        } else if (filename.indexOf('.html') != -1) {
          headers['Content-Type'] = 'text/html'
        } else if (filename.indexOf('.js') != -1) {
          headers['Content-Type'] = 'text/javascript'
        } else {
          return;
        }

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

        function callback(error, response, body) {
          if(response.statusCode != 204){
            atom.notifications.addWarning("Kunde inte spara alla filer. Kolla dina uppgifter i dynappconfig.json", null)
          }
          resolve()
        }
        request(options, callback);
      });
}

module.exports.uploadFile = uploadFile

// download a specific file
var downloadFile = function(file) {
  return new Promise(function(resolve,reject){
    var cred = getCred()

    filepath = atom.project.getPaths()[0]

    var options = {
      url: cred.baseUrl + "dynapp-server/rest/groups/" +cred.group + "/apps/" + cred.app + "/data-items/" + file,
      auth: {
        user: cred.username,
        password: cred.password
      }
    }

    request(options, function(err, res, body) {
      if (err) {
        console.dir(err)
        reject()
        return
      }
      console.log(file)
      resolve()
      if (file.indexOf('.json') == -1) {
        fs.writeFile(filepath + '/data-items/' + file, body, 'binary', function(err) {});
      } else {
        try{
          var obj = JSON.parse(body)
          fs.writeFile(filepath + '/data-items/' + file, JSON.stringify(obj, null, 4));
        }
        catch(e){
          fs.writeFile(filepath + '/data-items/' + file, body, 'binary', function(err) {});
        }

      }
    })
  })
}

module.exports.downloadFile = downloadFile
