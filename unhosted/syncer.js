var syncer = (function() {
  var indexCache = {};
  var indexKey;
  var orsc=function(obj){console.log('ready state changed to:');console.log(obj);};
  //localStorage keys used by this lib:
  //_unhosted$userAddress
  //_unhosted$categories
  //_unhosted$storageInfo
  //_unhosted$bearerToken
  
  //_unhosted$pushInterval
  //_unhosted$pullInterval
  
  //_unhosted$lastPushStartTime
  //_unhosted$lastPullStartTime
  
  //_unhosted$lastPushEndTime
  //_unhosted$lastPullEndTime
 
  //for each [category]:
  //_unhosted$index:[category]

  function connect(userAddress, categories, pushInterval, pullInterval, dialogPath) {
    if(localStorage['_unhosted$bearerToken']) {
      console.log('err: already connected');
      return;
    }
    if(typeof(dialogPath) === 'undefined') {
      dialogPath = '/unhosted/dialog.html';
    }
    if(typeof(pullInterval) === 'undefined') {
      pullInterval = 60;
    }
    if(typeof(pushInterval) === 'undefined') {
      pushInterval = 6;
    }
    if(pullInterval<pushInterval) {
      console.log('err: pullInterval should be greater than or equal to pushInterval. Set both to 0 to disable timed sync altogether');
      return;
    }
    localStorage['_unhosted$userAddress'] = userAddress;
    localStorage['_unhosted$categories'] = JSON.stringify(categories);
    localStorage['_unhosted$pushInterval'] = pushInterval;
    localStorage['_unhosted$pullInterval'] = pullInterval;
    window.open(dialogPath);
    window.addEventListener('storage', function(event) {
      if(event.key=='_unhosted$bearerToken' && event.newValue) {
        if(pushInterval) {
          setInterval(work, pushInterval*1000);//will first trigger a pull if it's time for that
        }
        orsc({
          connected: true
        });
      }
      if(event.key=='_unhosted$dialogResult' && event.newValue) {
        try {
          console.log(JSON.parse(event.newValue));
        } catch(e) {
          console.log('unparseable dialog result');
        }
      }
    }, false);
    //TODO: deal with dialog failures
  }
  function disconnect() {
    localStorage.clear();
    orsc({
      connected: false
    });
  }
  function getLocalIndex(category) {
    if(indexCache[category]) {//this is necessary because localStorage contents is not updated instantly on write
      return indexCache[category];
    }
    var str = localStorage[indexKey+'_index_'+category];
    if(str) {
      try {
        indexCache[category] = JSON.parse(str);
        return indexCache[category];
      } catch (e) {
      }
    }
    //build up index from scratch:
    indexCache[category] = {};
    for(var i = 0; i < localStorage.length; i++) {
      var keyParts = localStorage.key(i).split('$');
      if(keyParts.length == 2 && keyParts[0] == category) {
        indexCache[category][keyParts[1]] = 0;
      }
    }
    localStorage[indexKey+'_index_'+category] = JSON.stringify(indexCache[category]);
    return indexCache[category];
  }
  function updateLocalIndex(category, key) {
    getLocalIndex(category);//prime indexCache
    indexCache[category][key] = new Date().getTime();
    localStorage[indexKey+'_index_'+category] = JSON.stringify(indexCache[category]);
  }
  function pull(cb) {
    console.log('pull');
    var categories, storageInfo, bearerToken;
    try {
      categories=JSON.parse(localStorage['_unhosted$categories']);
      storageInfo=JSON.parse(localStorage['_unhosted$storageInfo']);
      bearerToken=localStorage['_unhosted$bearerToken'];
    } catch(e) {
    }
    if(categories && storageInfo && bearerToken) {
      for(var i=0; i<categories.length; i++) {
        var client=remoteStorage.createClient(storageInfo, categories[i], bearerToken);
        client.get(indexKey, function(err, data) {
          if((!err) && data) {
            var remoteIndex = JSON.parse(data);
            var localIndex = getLocalIndex(category);
            JSON.parse(localStorage[clients[category]+'$'+indexKey]);
            var key;
            for(key in remoteIndex) {
              if(!localIndex[key] || localIndex[key] < remoteIndex[key]) {
                client.get(key, function(err, data) {
                  updateLocalIndex(category, key);
                  localStorage[category+'$'+key] = data;
                });
              }
            }
            var putIndex = false;
            for(key in localIndex) {
              if(!remoteIndex[key] || remoteIndex[key] < localIndex[key]) {
                putIndex = true;
                client.put(key, localStorage[category+'$'+key], function(err, data) {
                });
              }
            }
            //todo: deal with upload failures
            client.put(indexKey, JSON.stringify(localIndex), function(err, data) {
            });
          }
        });
      }
    }
    cb();//not really finished here yet actually
  }
  function push(category, item, cb) {
    console.log('push '+category+'$'+item);
    if(category != '_unhosted') {
      var index = updateLocalIndex(category, item);
      var storageInfo, bearerToken;
      try {
        storageInfo=JSON.parse(localStorage['_unhosted$storageInfo']);
        bearerToken=localStorage['_unhosted$bearerToken'];
      } catch(e) {
      }
      if(storageInfo && bearerToken) {
        var client = remoteStorage.createClient(storageInfo, category, bearerToken);
        client.put(indexKey, JSON.stringify(getLocalIndex(category)), function(err, data) {
          client.put(item, localStorage[category+'$'+item], function(err, data) {
          });
        });
      }
    }
    cb();//not really finished here yet actually
  }
  function maybePull(now, cb) {
    if(localStorage['_unhosted$pullInterval']) {
      if(!localStorage['_unhosted$lastPullStartTime'] //never pulled yet
        || parseInt(localStorage['_unhosted$lastPullStartTime']) + localStorage['_unhosted$pullInterval']*1000 < now) {//time to pull
        localStorage['_unhosted$lastPullStartTime']=now;
        pull(cb);
      } else {
        cb();
      }
    } else {
      cb();
    }
  }
  function onLoad() {
    require(['./unhosted/remoteStorage'], function(drop) {
      remoteStorage=drop;
      if(localStorage['_unhosted$pushInterval']) {
        work();
        setInterval(work, localStorage['_unhosted$pushInterval']*1000);
      }
    });
  }
  function work() {
    var now = new Date().getTime();
    maybePull(now, function() {
    });
  }
  function onReadyStateChange(cb) {
    orsc=cb;
    orsc({
      connected: (localStorage['_unhosted$bearerToken'] != null)
    });
  }
  function getUserAddress() {
    return localStorage['_unhosted$userAddress'];
  }
  function setItem(category, item, value, cb) {
    localStorage[category+'$'+item]=value;
    pushItem(category, item, cb);
  }
  onLoad();
  return {
    connect            : connect,//(userAddress, categories, pullInterval=60, dialog='/unhosted/dialog.html'), also forces a first pull & push and starts timers
    disconnect         : disconnect,//(), also forces a last push and stops timers
    setItem            : setItem,//() for instance when the user explicitly hits 'go offline'
    pull               : pull,//() for instance when the user explicitly hits 'refresh view'
    onReadyStateChange : onReadyStateChange,
    getUserAddress     : getUserAddress
  };
  //to catch the sync state, look for frame messages starting with '_unhosted:'
})();

// remote data structure:
// index
// favSandwich:timestamp
// 

// we can't tell when a key has changed, and don't want to keep sha's of them. so the user should connect(), disconnect(), and then
// getItem, setItem, removeItem, length, key on remoteStorage instead of on localStorage
// fixItem to make sure it never gets expulsed from cache and is always prefetched.
// or fetchItems and then synchronous getItem
// adn then flushItems.
//
// or have localStorage, synced, and remote.
// connect userAddress, pullInterval, scopes, cb(err) will load cache according to cache list
// disconnect cb(err) will remove cache and flush through any pending writes.
// 
// getItem key, cb //adds the item to the cache and to the cache list.
// setItem key, value, cb(err) //cache with writethrough
// removeItem key, value, cb(err) //remove from remote and, if present, also from cache
//
// length - will give the remote length
// key - int -> key on remote
// cached - int -> boolean
//
// flushItem category$item, cb(err) //remove only from cache and cache list
// storeItem category$item, value, cb(err) only store remotely, don't add to cache or cache list
// fetchItem [user@host/]category$item, cb(err, data)
//
