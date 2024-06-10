/*
Date:
https://prezenta.roaep.ro/{ALEGERI}/data/json/sicpv/pv/pv_{JUDET}_{prov|part|final}.json
*/
const { exec } = require('child_process');
const { debug } = require('console');
const { mkdir, mkdirSync, fstat, existsSync } = require('fs');

const args = process.argv.slice(2);
const alegeri = {
    "locale2020": "locale27092020",
    "locale2024": "locale09062024",
    "europarlamentare2024": "europarlamentare09062024"
}
//const judete = ["is"];
const judete = ["ab", "ar", "ag", "bc", "bh", "bn", "bt", "br", "bv", "bz", "cl", "cs", "cj", "ct", "cv", "db", "dj", "gl", "gr", "gj", "hr", "hd", "il", "is", "if", "mm", "mh", "b", "ms", "nt", "ot", "ph", "sj", "sm", "sb", "sv", "tr", "tm", "tl", "vl", "vs", "vn"];
//args[0] = "parlamentareCD2020";
args[1] = "prov";
if (args.length < 1 || !alegeri[args[0]]) return console.log(`Format: node prezenta.js [${Object.keys(alegeri).map(key => `${key}`).join('|')}] [prov|part|final]`);

String.prototype.clear = function () {
    return this
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/(MUNICIPIUL|ORAS) ?/ig, '')
        .replace(/\. /ig, '.')
        .replace(/ - /ig, '-')
        ;
}
function sortByValues(obj, key) {
    let candidatesArray = Object.values(obj);
    candidatesArray.sort((a, b) => b[key] - a[key]);
    return candidatesArray;
}
function processResults(alegeriName, type) {
    if (!existsSync('./data/alegeri/raw')) mkdirSync('./data/alegeri/raw');
    let rezultate = {};
    exec(`curl --output-dir ./data/alegeri/raw -O "https://prezenta.roaep.ro/${alegeriName}/data/json/sicpv/pv/pv_{${judete.join(',')}}_${type}.json"`, (error) => {
        if (error) {
            console.error(`Error: ${error.message}`);
            return;
        }
        console.log("Processing...");
        for (const judet1 of judete) {
            let judet = judet1.clear();
            rezultate[judet] = {};
            let json = [];
            try {
                json = require(`./data/alegeri/raw/pv_${judet}_${type}.json`);
            } catch (_) { 
                console.log(`No data for ${judet}`);
                continue; }
            let table = [];
                table = Object.values(json.stages[args[1].toUpperCase()].scopes.PRCNCT.categories.P.table);
            for (const row of table) {
                let localitate = row.uat_name.clear();
                if (judet == "SR") {
                    if (!countryCodes.hasOwnProperty(localitate)) continue;
                    localitate = countryCodes[localitate];
                }
                let votes = [...row.votes];

                if (!rezultate[judet].hasOwnProperty(localitate)) {
                    rezultate[judet][localitate] = { votes: {} };
                }
                for (const partid of votes) {
                    if (rezultate[judet][localitate].votes.hasOwnProperty(partid.candidate)) {
                        rezultate[judet][localitate].votes[partid.candidate].votes += Number(partid.votes);
                    }
                    else
                        rezultate[judet][localitate].votes[partid.candidate] = {
                            name: partid.candidate,
                            party: partid.party ?? "INDEPENDENT",
                            votes: Number(partid.votes)
                        };
                }
            }
        }

        require('fs').writeFileSync(`./data/alegeri/rezultate_${alegeriName}.json`, JSON.stringify(rezultate));
        exec(`rm -rf ./data/alegeri/raw`);
        console.log("Done");


    });
}
processResults(alegeri[args[0]], args[1]);
let countryCodes = require('./data/map/countries.json');