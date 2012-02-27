var Syncer = function() {
  var clients = {};
  var indexKey;
  function init(setStorageInfo, setCategories, setToken, setIndexKey, cb) {
    indexKey = setIndexKey || '_syncer';
    if(!localStorage[indexKey]) {
      localStorage[indexKey] = JSON.stringify({});
    }
    require(['http://unhosted.org/remoteStorage-0.4.3.js'], function(remoteStorage) {
      for(var i in setCategories) {
        clients[setCategories[i]] = remoteStorage.createClient(setStorageInfo, setCategories[i], setToken);
      }
      sync(cb);
    });
  }
  function sync(cb) {
    if(!clients.length) {
      cb();
      return;
    }
    for(var i in clients) {
      clients[i].get(indexKey, function(err, data) {
        if((!err) && data) {
          var remoteIndex = JSON.parse(data);
          var localIndex = JSON.parse(localStorage[clients[i]+'$'+indexKey]);
          var key;
          for(key in remoteIndex) {
            if(!localIndex[key] || localIndex[key] < remoteIndex[key]) {
              clients[i].get(key, function(err, data) {
                localIndex = JSON.parse(localStorage[clients[i]+'$'+indexKey]);
                localIndex[key] = remoteIndex[key];
                localStorage[clients[i]+'$'+indexKey] = JSON.stringify(localIndex);
                localStorage[clients[i]+'$'+key] = data;
              });
            }
          }
          for(key in localIndex) {
            if(!remoteIndex[key] || remoteIndex[key] < localIndex[key]) {
              clients[i].put(key, localStorage[clients[i]+'$'+key], function(err, data) {
              });
            }
          }
          cb();//not really finished here yet actually
        }
      });
    }
  }
  function push(e, cb) {
    var parts = e.key.split('$');
    if((parts.length != 2) || (parts[0] == indexKey)) {
      return;
    }
    var now = new Date().getTime();
    var index = JSON.parse(localStorage[parts[0]+'$'+indexKey]);
    index[parts[1]] = now;
    localStorage[parts[0]+'$'+indexKey] = JSON.stringify(index);
    if(clients[parts[0]]) {
      clients[parts[0]].put(indexKey, localStorage[parts[0]+'$'+indexKey], function(err, data) {
        client.put(parts[1], e.newValue, function(err, data) {
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
