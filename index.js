const fs = require('fs');
const {google} = require('googleapis');
const eventsPkg = require('events');

let oauthClient = null;

const emitter = new eventsPkg.EventEmitter();

let options = {};

const log = {
  i: msg => {if(options.debug) console.log(msg)},
  e: (msg, err = {}) => {if(options.debug) console.error(msg, err)},
};

const events = {
  READY: 'auth-loaded',
  AUTH_REQUEST: 'auth-request',
};

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/drive'];
const TOKEN_PATH = 'token.json';

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 */
function authorize(credentials) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  oauthClient = new google.auth.OAuth2(
    client_id, client_secret, redirect_uris[0]);
  log.i('Check if there is already an user token');
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) {
      log.i('No user token found');
      return getAccessToken(callback);
    }
    oauthClient.setCredentials(JSON.parse(token));
    emitter.emit(events.READY);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(callback) {
  const authUrl = oauthClient.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  return emitter.emit(events.AUTH_REQUEST, authUrl);
}

function validateCode(code) {
  oauthClient.getToken(code, (err, token) => {
    if (err) return console.error('Error retrieving access token', err);
    oauthClient.setCredentials(token);
    // Store the token to disk for later program executions
    fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
      if (err) console.error(err);
      console.log('Token stored to', TOKEN_PATH);
      emitter.emit(events.READY);
    });
  });
}

module.exports = (options = {}) => {
  this.options = options;
  log.i('Load google credentials');
  fs.readFile('credentials.json', (err, content) => {
    if (err) return log.e('Error loading client secret file:', err);
    authorize(JSON.parse(content));
  });
  return {
    on: emitter.on,
    once: emitter.once,
    listeners: emitter.listeners,
    removeListener: emitter.removeListener,
    validateCode: validateCode,
    events: events
  }
};