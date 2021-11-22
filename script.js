"use strict";

/**** PACKAGES ****/
const config = require('config');
const axios = require('axios').default;
const fastCsv = require('fast-csv');
const fs = require('fs-extra');
const path = require('path');

const KEYCLOAK = config.get('keycloak-provider');
const KEYCLOAK_FULL_ADR = KEYCLOAK.protocol + '://' + KEYCLOAK.host + ':' + KEYCLOAK.port;

const keycloakAPI = axios.create({
    baseURL: KEYCLOAK_FULL_ADR
});


/**** VARIABLES ****/
var keycloak_access_token = undefined;
var csvData = [];
/**** FUNCTIONS ****/
function keycloakLogin() {
    let params = new URLSearchParams();
    params.append('grant_type', KEYCLOAK.accessType.grant_type);
    params.append('client_id', KEYCLOAK.accessType.client_id);
    params.append('username', KEYCLOAK.accessType.username);
    params.append('password', KEYCLOAK.accessType.password);

    return keycloakAPI.post('/auth/realms/' + KEYCLOAK.realm + '/protocol/openid-connect/token', params, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
}

function init() {
    keycloakLogin()
        .then(res => {
            console.log("===================TOKEN===================");
            console.log("Access Token KEYCLOAK: ", res.data.access_token);
            console.log("======================================");
            keycloak_access_token = res.data.access_token;
            fs.createReadStream(path.resolve(__dirname, './resource/target', 'parse.csv'))
                .pipe(fastCsv.parse({ headers: true }))
                .on('error', error => console.error(error))
                .on('data', row => {
                    csvData.push(row);
                })
                .on('end', rowCount => {
                    //console.log(csvData)
                    processDataParsed(csvData);
                });
        }).catch(err => {
            console.log(err);
        });
}

function processDataParsed(rows) {
    var promises = [];
    var importedUsers = [];
    let headerProcessData = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keycloak_access_token}`
    };

    for (let i = 0; i < rows.length; i++) {
        let row = rows[i];
        promises.push(
            keycloakAPI.post('/auth/admin/realms/' + KEYCLOAK.realm + '/users', row, {headers:headerProcessData})
                .then(() => {
                    importedUsers.push(row);
                })
        );
    }

    Promise.all(promises).then(() => {
        console.log("===================IMPORTED USERS===================");
        console.log(importedUsers)
        console.log("===================");
    }).catch(err => {
        console.log(`Errore durante l'import dei dati ${err.config.data} con causale ${err.response.data.errorMessage}`);
    })
}

/********* MAIN *********/
init();