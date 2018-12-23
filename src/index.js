/*
 * !
 * google-drive-manager
 * Copyright(c) 2018 - 2018 Tristan Morisot <tristan.morisot@viacesi.fr>
 * MIT Licensed
 */

const fs = require('fs').promises;
const {google, GoogleApis} = require('googleapis');
const EventEmitter = require('events');
class AppEmitter extends EventEmitter {}

const emitter = new AppEmitter();

/** @type GoogleApis*/
let oauthClient = null;

/** @type Object*/
let appOptions = {};

const log = {
  i: msg => {if(appOptions.debug) console.log(msg)},
  e: (msg, err = {}) => {if(appOptions.debug) console.error(msg, err)},
};

const events = {
  READY: 'auth-loaded',
  AUTH_REQUEST: 'auth-request',
  VALID_CODE: 'valid-code'
};

const SCOPES = ['https://www.googleapis.com/auth/drive'];

/**
 * Create an OAuth2 client with the given credentials
 * @param {Object} credentials The authorization client credentials.
 */
function initOAuth2Client(credentials) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  oauthClient = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
}

/**
 * Read the token file
 * @param tokenFile path
 * @return {Promise<Buffer>}
 */
function getTokenFile(tokenFile){
  log.i('Check if there is already an user token');
  return fs.readFile(tokenFile);
}

/**
 * Create Oauth2 confirmation url
 * @return Promise<String> Url to get Google user's token
 */
function getAccessToken() {
  return new Promise(resolve => {
    resolve(oauthClient.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    }))
  });
}

/**
 * Get token from the code return by google
 * @param code
 * @return {Promise<token|Error>}
 */
function validateCode(code) {
  return new Promise((resolve, reject) => {
    oauthClient.getToken(code)
      .then(token => {
        oauthClient.setCredentials(token);
        return resolve(token);
      })
      .catch(err => reject(err));
  });
}

/**
 * Store token file
 * @param tokenFile
 * @param token
 * @return {Promise<void | Error>}
 */
function writeToken(tokenFile, token) {
  return fs.writeFile(tokenFile, JSON.stringify(token));
}

/**
 * Check and init options in the module
 * @param options
 */
function manageOptions(options) {
  if (options.tokenFile === undefined || options.tokenFile === '') throw new Error('No token file in options');
  if (options.credentialsFile === undefined || options.credentialsFile === '') throw new Error('No credentials file in options');
  appOptions = options;
}

/**
 * Get credentials information
 * @param credentialsFile File where Google Oauth APU is stored
 * @returns {Promise<Object | Error>}
 */
function loadCredentials(credentialsFile, ){
  log.i('Load google credentials');
  return fs.readFile(credentialsFile);
}

/**
 * Init google drive API and manager objects
 * @param options
 * @param options.tokenFile File which contains user token or the file where the token should be stored
 * @param options.credentialsFile File which contains Google Oauth API informations
 * @returns {{driveEmitter: AppEmitter, events: {Object}}}
 */
module.exports = (options) => {
  manageOptions(options);

  loadCredentials(options.credentialsFile)
    .then(crendentials => {
      initOAuth2Client(JSON.parse(crendentials));
      getTokenFile(options.tokenFile)
        .then(token => {
          oauthClient.setCredentials(JSON.parse(token));
          emitter.emit(events.READY);
        })
        .catch(err => {
          if (err) {
            log.i('No user token found');
            getAccessToken().then((url) => emitter.emit(events.AUTH_REQUEST, url));
          }
        });
    })
    .catch(err => {throw new Error('Error loading credentials')});

  emitter.on(events.VALID_CODE, (code) => {
    validateCode(code).then((token) => {
      writeToken(appOptions.tokenFile, token)
        .then(() => emitter.emit(events.READY))
        .catch(err => {throw err;})
    });

  });

  return {
    driveEmitter: emitter,
    events
  };

};