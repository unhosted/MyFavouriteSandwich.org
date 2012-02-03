(function() {
  var i, hashParts = window.location.hash.split('&');
  for(i in hashParts) {
    if(hashParts[i].length >1 && hashParts[i][0] == '#') {
      hashParts[i] = hashParts[i].substring(1);
    }
    var kv = hashParts[i].split('=');
    if (kv.length == 2 && kv[0] == 'access_token') {
      localStorage.remoteStorageAccessToken = kv[1];
      window.close();
    }
  }
})();
