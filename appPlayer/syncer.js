var Syncer = function() {
  return {
    init: function(api, url, token) {
      alert(api);
      alert(url);
      alert(token);
    },
    push: function(e) {
      alert(e.key);
      alert(e.newValue);
    }
  };
};
