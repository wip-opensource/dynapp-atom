const request = require('request-promise-native');
const config = require('./config');
const urljoin = require('url-join');
const mime = require('mime-types');

const _headers = {
  'User-Agent': 'dynapp-atom'
};

const _auth = {
  user: config.username,
  pass: config.password
}

function _baseUrl() {
  return urljoin(config.baseUrl, 'dynapp-server/rest/groups/', config.group, '/apps/', config.app, '/data-items/');
}

function _modifyDataItem(dataItem, body, method) {
  return request({
    url: urljoin(_baseUrl(), dataItem),
    method: method,
    headers: Object.assign({
      'Content-Type': mime.lookup(dataItem) || '',
      'X-Category': '2'
    }, _headers),
    body: body,
    auth: _auth
  });
}

function updateDataItem(dataItem, body) {
  return _modifyDataItem(dataItem, body, 'PUT');
}

function createDataItem(dataItem, body) {
  return _modifyDataItem(dataItem, body, 'POST');
}

function deleteDataItem(dataItem) {
  return request({
    url: urljoin(_baseUrl(), dataItem),
    method: 'DELETE',
    headers: _headers,
    auth: _auth
  });
}

function downloadApp() {
  return request({
    url: urljoin(_baseUrl(), dataItem),
    headers: Object.assign({
      'Accept': 'application/zip'
    }, _headers),
    auth: _auth
  });
}

module.exports = {
  getDataItems,
  updateDataItem,
  createDataItem
}
