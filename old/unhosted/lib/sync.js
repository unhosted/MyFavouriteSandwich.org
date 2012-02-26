define((function() {
  function sync(client, indexKey, cb) {
    if(!localStorage[indexKey]) {
      localStorage[indexKey] = JSON.stringify({});
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
  function push(client, key, newValue, indexKey cb) {
    if(key == indexKey) {
      return;
    }
    if(!localStorage[indexKey]) {
      //logged out
      return;
    }
    var now = new Date().getTime();
    var index = JSON.parse(localStorage[indexKey]);
    index[key] = now;
    localStorage[indexKey] = JSON.stringify(index);
    if(client) {
      client.put(indexKey, localStorage[indexKey], function(err, data) {
        client.put(key, newValue, function(err, data) {
          cb();
        });
      });
    } 
  }
  return {
    sync: sync, 
    push: push
  };
})());
