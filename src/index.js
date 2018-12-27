/*
 * !
 * google-drive-manager
 * Copyright(c) 2018 - 2018 Tristan Morisot <tristan.morisot@viacesi.fr>
 * MIT Licensed
 */

const fs = require('fs').promises;
const {google, GoogleApis} = require('googleapis');
const EventEmitter = require('events');


let log = null;

const SCOPES = ['https://www.googleapis.com/auth/drive'];

/**
 * Drive manager
 */
class DriveManager extends EventEmitter {
  constructor(options) {
    super();
    if (options.tokenFile === undefined || options.tokenFile === '') throw new Error('No token file in options');
    if (options.credentialsFile === undefined || options.credentialsFile === '') throw new Error('No credentials file in options');

    this.appOptions = options;

    /** @type GoogleApis*/
    this.oauthClient = null;

    this.events = {
      READY: 'auth-loaded',
      AUTH_REQUEST: 'auth-request',
      VALID_CODE: 'valid-code'
    };

    this.on(this.events.READY, () => initDrive(this.drive, this.oauthClient));

    this.drive = null;
  }

  /**
   * Get token from the code return by google
   * @param code
   * @return {Promise<token|Error>}
   */
  validateCode(code) {
    return new Promise((resolve, reject) => {
      this.oauthClient.getToken(code)
        .then(res => {
          this.oauthClient.setCredentials(res.tokens);
          return resolve(res.tokens);
        })
        .catch(err => reject(err));
    });
  }
}

/**
 * Init drive object
 */
function initDrive(drive, oauthClient) {
  drive = google.drive({version: 'v3', auth: oauthClient});
}

/**
 * Create an OAuth2 client with the given credentials
 * @param {Object} credentials The authorization client credentials.
 * @param oauthClient
 */
function initOAuth2Client(credentials) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  return new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
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
function getAccessToken(oauthClient) {
  return new Promise(resolve => {
    resolve(oauthClient.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    }))
  });
}

/**
 * Store token file
 * @param tokenFile
 * @param token
 * @return {Promise<void | Error>}
 */
function writeToken(tokenFile, token) {
  log.i('Token file created');
  return fs.writeFile(tokenFile, JSON.stringify(token));
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
 * Get drive manager with the given options
 * @param options
 * @return {DriveManager}
 */
module.exports = (options) => {
  const manager = new DriveManager(options);
  log = {
    i: msg => {if(options.debug) console.log(msg)},
    e: (msg, err = {}) => {if(options.debug) console.error(msg, err)},
  };
  loadCredentials(options.credentialsFile)
    .then(credentials => {
      manager.oauthClient = initOAuth2Client(JSON.parse(credentials));
      getTokenFile(options.tokenFile)
        .then(token => {
          manager.oauthClient.setCredentials(JSON.parse(token));
          manager.drive = google.drive({version: 'v3', auth: manager.oauthClient});
          manager.emit(manager.events.READY);
        })
        .catch(err => {
          if (err) {
            log.i('No user token found');
            getAccessToken(manager.oauthClient).then((url) => manager.emit(manager.events.AUTH_REQUEST, url));
          }
        });
    })
    .catch(err => {throw new Error('Error loading credentials: ' + err.message)});

  manager.on(manager.events.VALID_CODE, (code) => {
    manager.validateCode(code).then((token) => {
      writeToken(manager.appOptions.tokenFile, token)
        .then(() => {
          manager.drive = google.drive({version: 'v3', auth: manager.oauthClient});
          manager.emit(manager.events.READY);
        })
        .catch(err => {throw err;})
    });
  });
  return manager;
};