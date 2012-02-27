var Syncer = function() {
  var client;
  var indexKey;
  function init(setStorageInfo, setCategory, setToken, setIndexKey, cb) {
    indexKey = setIndexKey || '_syncer';
    if(!localStorage[indexKey]) {
      localStorage[indexKey] = JSON.stringify({});
    }
    require(['http://unhosted.org/remoteStorage-0.4.3.js'], function(remoteStorage) {
      client = remoteStorage.createClient(setStorageInfo, setCategory, setToken);
      sync(cb);
    });
  }
  function sync(cb) {
    if(!client) {
      cb();
      return;
    }
    client.get(indexKey, function(err, data) {
      if((!err) && data) {
        var remoteIndex = JSON.parse(data);
        var localIndex = JSON.parse(localStorage[indexKey]);
        var key;
        for(key in remoteIndex) {
          if(!localIndex[key] || localIndex[key] < remoteIndex[key]) {
            client.get(key, function(err, data) {
              localIndex = JSON.parse(localStorage[indexKey]);
              localIndex[key] = remoteIndex[key];
              localStorage[indexKey] = JSON.stringify(localIndex);
              localStorage[key] = data;
            });
          }
        }
        for(key in localIndex) {
          if(!remoteIndex[key] || remoteIndex[key] < localIndex[key]) {
            client.put(key, localStorage[key], function(err, data) {
            });
          }
        }
        cb();//not really finished here yet actually
      }
    });
  }
  function push(e, cb) {
    if(e.key.substring(0, indexKey.length) == indexKey) {
      return;
    }
    var now = new Date().getTime();
    var index = JSON.parse(localStorage[indexKey]);
    index[e.key] = now;
    localStorage[indexKey] = JSON.stringify(index);
    if(client) {
      client.put(indexKey, localStorage[indexKey], function(err, data) {
        client.put(e.key, e.newValue, function(err, data) {
          cb();
        });
      });
    } 
  }
  return {
    sync: sync, 
    init: init,
    push: push
  };
};
