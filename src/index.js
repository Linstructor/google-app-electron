/*
 * !
 * google-drive-manager
 * Copyright(c) 2018 - 2018 Tristan Morisot <tristan.morisot@viacesi.fr>
 * MIT Licensed
 */

const fs = require('fs').promises;
const {google, GoogleApis} = require('googleapis');
const EventEmitter = require('events');



class AppEmitter extends EventEmitter {
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

    this.SCOPES = ['https://www.googleapis.com/auth/drive'];

    this.log = {
      i: msg => {if(this.appOptions.debug) console.log(msg)},
      e: (msg, err = {}) => {if(this.appOptions.debug) console.error(msg, err)},
    };
  }

  /**
   * Create an OAuth2 client with the given credentials
   * @param {Object} credentials The authorization client credentials.
   */
  initOAuth2Client(credentials) {
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    this.oauthClient = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  }

  /**
   * Read the token file
   * @param tokenFile path
   * @return {Promise<Buffer>}
   */
  getTokenFile(tokenFile){
    this.log.i('Check if there is already an user token');
    return fs.readFile(tokenFile);
  }

  /**
   * Create Oauth2 confirmation url
   * @return Promise<String> Url to get Google user's token
   */
  getAccessToken() {
    return new Promise(resolve => {
      resolve(this.oauthClient.generateAuthUrl({
        access_type: 'offline',
        scope: this.SCOPES,
      }))
    });
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

  /**
   * Store token file
   * @param tokenFile
   * @param token
   * @return {Promise<void | Error>}
   */
  writeToken(tokenFile, token) {
    this.log.i('Token file created');
    return fs.writeFile(tokenFile, JSON.stringify(token));
  }

  /**
   * Get credentials information
   * @param credentialsFile File where Google Oauth APU is stored
   * @returns {Promise<Object | Error>}
   */
  loadCredentials(credentialsFile, ){
    this.log.i('Load google credentials');
    return fs.readFile(credentialsFile);
  }

  init() {
    this.loadCredentials(this.appOptions.credentialsFile)
      .then(credentials => {
        this.initOAuth2Client(JSON.parse(credentials));
        this.getTokenFile(this.appOptions.tokenFile)
          .then(token => {
            this.oauthClient.setCredentials(JSON.parse(token));
            this.emit(this.events.READY);
          })
          .catch(err => {
            if (err) {
              this.log.i('No user token found');
              this.getAccessToken().then((url) => this.emit(this.events.AUTH_REQUEST, url));
            }
          });
      })
      .catch(err => {throw new Error('Error loading credentials: ' + err.message)});

    this.on(this.events.VALID_CODE, (code) => {
      this.validateCode(code).then((token) => {
        this.writeToken(this.appOptions.tokenFile, token)
          .then(() => this.emit(this.events.READY))
          .catch(err => {throw err;})
      });
    });
  }
}

/**
 * Get drive manager with the given options
 * @param options
 * @return {AppEmitter}
 */
module.exports = (options) => {
  return new AppEmitter(options);
};