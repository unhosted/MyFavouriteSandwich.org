var syncer = (function() {
  var onReadyStateChange = function(cb) {
      readyStateChangeHandler = cb;
      if(localStorage['_unhosted$storageInfo'] && localStorage['_unhosted$bearerToken']) {
        connected = true;
      } else {
        connected = false;
      }
      online = true;
      ready = true;
      //readyStateChangeHandler(connected, online, ready);
    },
    readyStateChangeHandler = function() {},
    connected = false,
    online = false,
    ready = false,
    connect = function(userAddress, categories, cb) {
      localStorage['_unhosted$userAddress'] = userAddress;
      var libPath = '/unhosted';
      window.open(libPath+'/openDialog.html'
        +'?userAddress='+encodeURIComponent(userAddress)
        +'&categories='+encodeURIComponent(JSON.stringify(categories))
        +'&libPath='+encodeURIComponent(libPath));
      window.addEventListener('message', function(event) {
        if(event.origin == location.protocol +'//'+ location.host) {
          if(event.data.substring(0, 5) == 'conn:') {
            var data = JSON.parse(event.data.substring(5));
            cb(data.storageInfo, categories, data.bearerToken);
          }
        }
      }, false);
    },
    startSync = function(storageInfo, categories, bearerToken) {
      localStorage['_unhosted$storageInfo'] = JSON.stringify(storageInfo);
      localStorage['_unhosted$categoriesToSync'] = JSON.stringify(categories);
      localStorage['_unhosted$bearerToken'] = bearerToken;
      var libPath = '/unhosted';
      connected = true;
      var syncFrame = document.createElement('iframe');
      syncFrame.setAttribute('style', 'border-style:none;width:1px;height:1px;');
      syncFrame.src= location.protocol+'//'+location.host+libPath+'/syncFrame.html'
        +'?api='+encodeURIComponent(storageInfo.api)
        +'&template='+encodeURIComponent(storageInfo.template)
        +'&categories='+encodeURIComponent(JSON.stringify(categories))
        +'&token='+encodeURIComponent(bearerToken);
      document.body.appendChild(syncFrame);
      window.addEventListener('message', function(event) {
        if((event.origin == location.protocol +'//'+ location.host) && (event.data.substring(0, 5) == 'sync:')) {
          ready = (event.data == 'sync:ready');
          readyStateChangeHandler(connected, online, ready);
        }
      }, false);
    },
    disconnect = function() {
      localStorage.clear();
      connected = false;
      readyStateChangeHandler(connected, online, ready);
    };
  function onLoad() {
    if(localStorage['_unhosted$categoriesToSync']) {
      try {
        startSync(JSON.parse(localStorage['_unhosted$storageInfo']), JSON.parse(localStorage['_unhosted$categoriesToSync']), localStorage['_unhosted$bearerToken']);
      } catch(e) {
        console.log('could not sync categories '+localStorage['_unhosted$categoriesToSync']);
      }
    } else {
      readyStateChangeHandler(false, true, false);
    }
  }
  function getUserAddress() {
    return localStorage['_unhosted$userAddress'];
  }
  return {
    startSync          : startSync,
    connect            : connect,
    disconnect         : disconnect,
    onReadyStateChange : onReadyStateChange,
    onLoad             : onLoad,
    getUserAddress     : getUserAddress
  };
})();
