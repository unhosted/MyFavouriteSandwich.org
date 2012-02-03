
define(['./ajax'], function(ajax) {
    function normalizeKey(key) {
      var i = 0;
      while(i < key.length && key[i] =='u') {
       i++;
      }
      if((i < key.length) && (key[i] == '_')) {
        key = 'u'+key;
      }
      return key;
    }
    function doCall(method, key, value, token, cb, deadLine) {
      var ajaxObj = {
        url: key,
        method: method,
        success: cb
      }
      ajaxObj.headers= {Authorization: 'Bearer '+token};
      ajaxObj.fields={withCredentials: 'true'};
      if(method!='GET') {
        ajaxObj.data=value;
      }
      ajax.ajax(ajaxObj);
    }
    function get(storageAddress, token, key, cb) {
      doCall('GET', storageAddress+normalizeKey(key), null, token, function(str) {
        var obj = JSON.parse(str);
        localStorage.setItem('_shadowCouchRev_'+key, obj._rev);
        cb(obj.value);
      }, deadLine);
    }
    function put(storageAddress, token, key, value, cb) {
      var revision = localStorage.getItem('_shadowCouchRev_'+key);
      var obj = {
        value: value
      };
      if(revision) {
        obj._rev = revision;
      }
      doCall('PUT', storageAddress+normalizeKey(key), JSON.stringify(obj), token, function(str) {
        var obj = JSON.parse(str);
        if(obj.rev) {
          localStorage.setItem('_shadowCouchRev_'+key, obj.rev);
        }
        cb();
      }, deadLine);
    }
    function delete(storageAddress, token, key, cb) {
      doCall('DELETE', storageAddress+normalizeKey(key), null, token, cb);
    }
    return {
      init: init,
      get: get,
      put: put,
      delete: delete
    }
});
