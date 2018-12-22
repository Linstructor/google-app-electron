const fs = require('fs').promises;
const {google} = require('googleapis');
const EventEmitter = require('events');
class AppEmitter extends EventEmitter {}

const emitter = new AppEmitter();
let oauthClient = null;
let appOptions = {};

const log = {
  i: msg => {if(appOptions.debug) console.log(msg)},
  e: (msg, err = {}) => {if(appOptions.debug) console.error(msg, err)},
};

const events = {
  READY: 'auth-loaded',
  AUTH_REQUEST: 'auth-request',
};

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/drive'];

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
  fs.readFile(appOptions.tokenFile)
    .then(token => {
      oauthClient.setCredentials(JSON.parse(token));
      emitter.emit(events.READY);
    })
    .catch(err => {
      if (err) {
        log.i('No user token found');
        return getAccessToken();
      }
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 */
function getAccessToken() {
  const authUrl = oauthClient.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  return emitter.emit(events.AUTH_REQUEST, authUrl);
}

function validateCode(code) {
  oauthClient.getToken(code, (err, token) => {
    if (err) return log.e('Error retrieving access token', err);
    oauthClient.setCredentials(token);

    fs.writeFile(appOptions.tokenFile, JSON.stringify(token))
      .then(() => {
        log.i('Token stored to', appOptions.tokenFile);
        emitter.emit(events.READY);
      })
      .catch(err => {throw err;});
  });
}

function manageOptions(options) {
  if (options.tokenFile === undefined || options.tokenFile === '') throw new Error('No token file in options');
  if (options.credentialsFile === undefined || options.credentialsFile === '') throw new Error('No credentials file in options');
  appOptions = options;
}

function loadCredentials(crendentialsFile){
  log.i('Load google credentials');
  fs.readFile(crendentialsFile)
    .then(result => authorize(JSON.parse(result)))
    .catch(err => log.e('Error loading client secret file:', err));
  return {
    driveEmitter: emitter,
    events
  };

};