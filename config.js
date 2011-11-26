exports.config = {
  backends: { statics: 80 },
  redirect: {
    "myfavouritesandwich.nodejitsu.com": "myfavouritesandwich.org"
  },
  domainsDir: 'statics/'
};
