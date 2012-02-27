define(
  ['require', './lib/ajax.js', './lib/couch.js', './lib/dav.js', './lib/webfinger.js'], 
  function (require, ajax, couch, dav, webfinger) {
    var onError = function (code, msg) {
        console.log(msg);
      },
      getStorageInfo = function (userAddress, cb) {
        webfinger.getAttributes(
          userAddress, {
            allowHttpWebfinger: true,
            allowSingleOriginWebfinger: false,
            allowFakefinger: true
          }, 
          function (err, data) {
            cb(err, null);
          }, 
          function (attributes) {
            cb(0, attributes);
            var storageAddresses = {};
          }
        );
      }, 
      createOAuthAddress = function (storageInfo, categories, redirectUri) {
        var terms = [
          'redirect_uri='+encodeURIComponent(redirectUri),
          'scope='+encodeURIComponent(categories.join(',')),
          'response_type=token',
          'client_id='+encodeURIComponent(redirectUri)
        ];
        return storageInfo.auth + (storageInfo.auth.indexOf('?') === -1?'?':'&') + terms.join('&');
      },
      getDriver = function (api, cb) {
        require([api === 'CouchDB'?'./lib/couch.js':'./lib/dav.js'], cb);
      },
      createClient = function (storageInfo, category, token) {
        var storageAddress = webfinger.resolveTemplate(storageInfo.template, category);
        return {
          get: function (key, cb) {
            getDriver(storageInfo.api, function (d) {
              d.get(storageAddress, token, key, cb);
            });
          },
          put: function (key, value, cb) {
            getDriver(storageInfo.api, function (d) {
              d.put(storageAddress, token, key, value, cb);
            });
          },
          'delete': function (key, cb) {
            getDriver(storageInfo.api, function (d) {
              d['delete'](storageAddress, token, key, cb);
            });
          }
        };
      },
      receiveToken = function () {
        var params, kv;
        /**
          this needs more attention.
        **/
        if(location.hash.length > 0) { 
          params = location.hash.split('&');
          for(var i = 0, il = params.length; i < il; i++) {
            if(params[i].length && params[i][0] ==='#') {
              params[i] = params[i].substring(1);
            }
            kv = params[i].split('=');
            if(kv.length >= 2) {
              if(kv[0]==='access_token') {
                ///XXX: ok im guessing its a base64 string and you somehow adding an = sign to the end of it ok, why?
                var token = unescape(kv[1]);//unescaping is needed in chrome, otherwise you get %3D%3D at the end instead of ==
                for(var j = 2,jl = kv.length; i < jl; i++) {
                  token += '='+kv[i]; 
                }
                return token;
              }
            }
          }
        }
        return null;
      },
      onReadyStateChange = function(cb) {
        readyStateChangeHandler = cb;
        if(localStorage['_unhosted$storageInfo'] && localStorage['_unhosted$bearerToken']) {
          connected = true;
        } else {
          connected = false;
        }
        online = true;
        ready = true;
        readyStateChangeHandler(connected, online, ready);
      },
      readyStateChangeHandler = function() {},
      connected = false,
      online = false,
      ready = false,
      sync = function(userAddress, categories) {
        var libPath = '/unhosted';
        window.open(libPath+'/openDialog.html'
          +'?userAddress='+encodeURIComponent(userAddress)
          +'&categories='+encodeURIComponent(JSON.stringify(categories))
          +'&libPath='+encodeURIComponent(libPath));
        window.addEventListener('message', function(event) {
          if(event.origin == location.protocol +'//'+ location.host) {
            if(event.data.substring(0, 5) == 'conn:') {
              var data = JSON.parse(event.data.substring(5));
              localStorage['_unhosted$storageInfo'] = JSON.stringify(data.storageInfo);
              localStorage['_unhosted$bearerToken'] = data.bearerToken;
              connected = true;
              var syncFrame = document.createElement('iframe');
              syncFrame.setAttribute('style', 'border-style:none;width:1px;height:1px;');
              syncFrame.src= location.protocol+'//'+location.host+libPath+'/syncFrame.html'
                +'?api='+encodeURIComponent(data.storageInfo.api)
                +'&template='+encodeURIComponent(data.storageInfo.template)
                +'&categories='+encodeURIComponent(JSON.stringify(categories))
                +'&token='+encodeURIComponent(data.bearerToken);
              document.body.appendChild(syncFrame);
              window.addEventListener('message', function(event) {
                if((event.origin == location.protocol +'//'+ location.host) && (event.data.substring(0, 5) == 'sync:')) {
                  ready = (event.data == 'sync:ready');
                  readyStateChangeHandler(connected, online, ready);
                }
              }, false);
            }
          }
        }, false);
      },
      disconnect = function() {
        localStorage.clear();
        connected = false;
        readyStateChangeHandler(connected, online, ready);
      };
  return {
    getStorageInfo     : getStorageInfo,
    createOAuthAddress : createOAuthAddress,
    createClient       : createClient,
    receiveToken       : receiveToken,
    sync               : sync,
    disconnect         : disconnect,
    onReadyStateChange : onReadyStateChange
  };
});
