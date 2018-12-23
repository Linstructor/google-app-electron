/*!
 * google-drive-manager
 * Copyright(c) 2018 - 2018 Tristan Morisot <tristan.morisot@viacesi.fr>
 * MIT Licensed
 */
const assert = require('assert');
const path = require('path');
describe('Google drive manager', () => {
  describe('should generate a token URL', function () {
    it('Url should not be nul', function (done) {
      const manager = require('../src/index')({credentialsFile: path.resolve(__dirname+'/../credentials.json'), tokenFile: '../token.json'});
      manager.emitter.on(manager.events.AUTH_REQUEST, (url) => {
        if (url === '' || url === null || url === undefined) return done(new Error('Empty url'));
        return done();
      })
    });
  });
  describe('should ', function () {
  });
});
