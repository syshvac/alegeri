let map = L.map('map', {
    zoomSnap: 0,
    zomDelta: 5,
    wheelPxPerZoomLevel: 140,
}).setView([45.9628666, 25.2081763], 7.4);
let lightTile = L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoiZmFyc2UiLCJhIjoiY2tnM3JnOHJtMGRnNzMzcDQ2a3dldHpyYiJ9.cdOn_RRX1YoMWUmoR6i36A', {
    maxZoom: 18,
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
        '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
        'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    id: 'mapbox/light-v9',
    tileSize: 512,
    zoomOffset: -1
});
let darkTile = L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoiZmFyc2UiLCJhIjoiY2tnM3JnOHJtMGRnNzMzcDQ2a3dldHpyYiJ9.cdOn_RRX1YoMWUmoR6i36A', {
    maxZoom: 18,
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
        '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
        'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    id: 'mapbox/dark-v9',
    tileSize: 512,
    zoomOffset: -1
});

lightTile.addTo(map);
let isLight = true;
document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('#darkMode')?.addEventListener('click', () => {
        if (isLight) {
            document.getElementById('darkMode').innerText = '🌙';
            isLight = false;
            darkTile.addTo(map);
            lightTile.removeFrom(map);
        } else {
            document.getElementById('darkMode').innerText = '🔆';
            isLight = true;
            lightTile.addTo(map);
            darkTile.removeFrom(map);
        }
    });
});

window.Commune = null;
window.conturJudete = null;
let getCommunes = async () => {
    if (!window.Commune) {
        const f = await fetch('data/map/comune.geojson');
        const j = await f.json();
        const jf = await fetch('data/map/ro_judete_polilinie.json');
        const jj = await jf.json();
        window.Commune = j;
        window.conturJudete = jj;
        return window.Commune;
    } else return window.Commune;
}

function sortByValues(obj, key) {
    let candidatesArray = Object.values(obj);
    candidatesArray.sort((a, b) => b[key] - a[key]);
    return candidatesArray;
}
String.prototype.clear = function () {
    return this.replace(/î/g, 'a')
        .replace(/Î/g, 'I')
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/(MUNICIPIUL|ORAS) ?/ig, '')
        .replace(/\. /ig, '.')
        .replace(/ - /ig, '-')
        ;
}
let geoJSON = null;
let conturGeoJSON = null;

function loadResults(alegeri) {
    window.results = {};
    document.querySelector('#loading').style.display = "flex";
    document.querySelector('#rezultate').style.display = "flex";
    const emptyData = {
        castigator: { party: "N/A", votes: 0, name: "N/A" },
        totalVoturi: 0,
        votes: [{ party: "N/A", votes: 0, name: "N/A" }],
    };
    let compareAlegeri = false;
    if (alegeri == "primariNoi") {
        alegeri = "locale09062024";
        compareAlegeri = true;
    }
    fetch(`data/alegeri/rezultate_${alegeri}.json`)
        .then(response => response.json())
        .then(data => {
            getCommunes().then(async communes => {

                if (geoJSON) geoJSON.removeFrom(map);
                if (conturGeoJSON) conturGeoJSON.removeFrom(map);
                let compData = []
                if (compareAlegeri) {
                    compData = await (await fetch(`data/alegeri/rezultate_locale27092020.json`)).json();
                }
                geoJSON = await L.geoJSON(communes, {
                    style: function (feature) {
                        let county = feature.properties.county.clear();
                        let name = feature.properties.name.clear();
                        let countyCode = window.countiesCodes[county];

                        let fillColor = "#333333";
                        let weight = 0.3;
                        let fillOpacity = 0; // Set default to 0

                        if (county == "SR") {
                            countyCode = county;
                            if (alegeri.includes("locale")) {
                                fillOpacity = 0;
                                weight = 0.0;
                            }
                            if (name == "ROU") {
                                fillOpacity = 0;
                                weight = 0.0;
                            }
                        }
                        if (data.hasOwnProperty(countyCode)) {
                            if (data[countyCode].hasOwnProperty(name)) {
                                let votes = sortByValues(data[countyCode][name].votes, 'votes');
                                let specifiedParty = votes.find(vote => vote.party === "PARTIDUL REÎNNOIM PROIECTUL EUROPEAN AL ROMÂNIEI");
                                
                                if (specifiedParty) {
                                    fillOpacity = 1;
                                    fillColor = getPartyColor(specifiedParty.party);
                                    if (!window.results.hasOwnProperty(specifiedParty.party)) window.results[specifiedParty.party] = { name: specifiedParty.party, UAT: 0, votes: 0 };
                                    window.results[specifiedParty.party].UAT++;
                                    feature.properties.data = {
                                        totalVoturi: votes.reduce((a, b) => a + b.votes, 0),
                                    }
                                    feature.properties.data.votes = votes.map(v => {
                                        v.percentage = (v.votes / feature.properties.data.totalVoturi * 100).toFixed(2);
                                        v.procent = v.votes / feature.properties.data.totalVoturi;
                                        return v;
                                    });
                                    for (const vote of votes) {
                                        if (!window.results.hasOwnProperty(vote.party)) window.results[vote.party] = { name: vote.party, UAT: 0, votes: 0 };
                                        window.results[vote.party].votes += vote.votes;
                                    }
                                    if (feature.properties.data.votes.length == 0) feature.properties.data.votes = [{ party: "N/A", votes: 0, name: "N/A" }];
                                } else {
                                    feature.properties.data = { ...emptyData };
                                }
                            } else {
                                feature.properties.data = { ...emptyData };
                            }
                        } else {
                            feature.properties.data = { ...emptyData };
                        }

                        return {
                            fillColor: fillColor,
                            weight: weight,
                            color: "#000000",
                            fillOpacity: fillOpacity
                        }
                    },
                    onEachFeature: onEachFeatureResults,
                });
                geoJSON.addTo(map);

                const geoJSONLayer = L.geoJSON(window.conturJudete, {
                    style: (e) => {
                        return {
                            fillColor: "#ff0000",
                            fillOpacity: 1,
                            weight: 2,
                            color: "#474646"
                        }
                    }
                });
                geoJSONLayer.addTo(map);
                document.querySelector('#loading').style.display = "none";
                setTable();
            })
        })
        .catch(error => {
            console.error('Error:', error);
            document.querySelector('#loading').style.display = "none";
            document.querySelector('#table').innerHTML = 'Inca nu exista date!';
        });
}

function onEachFeatureResults(feature, layer) {
    if (layer.options?.fillOpacity == 0) return;
    let popupContent = '';
    try {
        popupContent = `
<h1>${feature.properties.county == "SR" ? `Diaspora: ${window.countries[feature.properties.name]}` : `${feature.properties.county}: ${feature.properties.name}`}</h1>
<h3>Castigator: ${feature.properties.data?.votes[0].name ?? 'N/A'}</h3>
<h3>Partid: ${feature.properties.data?.votes[0].party ?? 'N/A'}</h3>
<h3>Total voturi: ${feature.properties.data?.totalVoturi.toLocaleString() ?? 'N/A'}</h3>
${feature.properties.data.hasOwnProperty('fostPrimar') ? `<h3>Fost primar: ${feature.properties.data.fostPrimar}</h3>` : ''}
<div class="votes">`;

        // Adding percentage for the specified party
        let specifiedParty = feature.properties.data.votes.find(vote => vote.party === "PARTIDUL REÎNNOIM PROIECTUL EUROPEAN AL ROMÂNIEI");
        if (specifiedParty) {
            popupContent += `<h3>PARTIDUL REÎNNOIM PROIECTUL EUROPEAN AL ROMÂNIEI: ${specifiedParty.percentage}%</h3>`;
        }

    } catch (e) {
        console.log(feature.properties);
    }
    for (let votes of feature.properties.data.votes) {
        let fillColor = getPartyColor(votes.party);
        popupContent += `
        <p >
        <span class="bar" style=""><b style="width:${votes.percentage}%"></b></span>
        <span class="color" style="background-color:${fillColor}"></span>
        ${votes.party == votes.name ? 
            `<span class="nume">${votes.party}<br>${votes.votes?.toLocaleString()} Voturi - ${votes.percentage}%</span>`: 
            `<span class="nume">${votes.party}<br>${votes.name}: ${votes.votes.toLocaleString()} - ${votes.percentage}%</span>`}
        
        </p>`
    }
    popupContent += '</div>';
    var popup = L.popup({
        maxWidth: 700,
        maxHeight: 800
    })
        .setContent(popupContent);
    layer.bindPopup(popup);

    // Add the percentage as a label on the map
    let specifiedParty = feature.properties.data.votes.find(vote => vote.party === "PARTIDUL REÎNNOIM PROIECTUL EUROPEAN AL ROMÂNIEI");
    if (specifiedParty) {
        let percentage = specifiedParty.percentage;
        let label = L.tooltip({
            permanent: true,
            direction: 'center',
            className: 'percentage-label'
        })
        .setContent(percentage + '%')
        .setLatLng(layer.getBounds().getCenter());
        layer.bindTooltip(label);
    }
}
String.prototype.clip = function (n) { return this.length < n ? this : this.substring(0, n - 3) + '...' };
function setTable() {

    let table = document.querySelector('#table');
    table.innerHTML = `    `;

    let count = 0;
    let results = sortByValues(window.results, 'UAT');
    //sum all votes
    let sum = results.reduce((a, b) => a + b.votes, 0);
    for (let party of results) {
        count++;
        if (count > 8) return;

        table.innerHTML += `<div>
        <p class="color" style="background-color:${getPartyColor(party.name)}">
        <input class="iparty" onclick="selectParty('${party.name}')" type="checkbox" value="${party.name}"
        ${window.partideAlese.includes(party.name) ? "checked" : ""}
        ${!window.partideAlese.includes(party.name) && window.partideAlese.length >= 2 ? "disabled" : ""}
         ></p>
        <p>
        <span><abbr title="${party.name}">${party.name.clip(30)}</abbr></span>
        <span>${party.UAT.toLocaleString()} UAT - ${party.votes.toLocaleString()} voturi (${(party.votes / sum * 100).toFixed(2)}%)</span>
        </p>
        </div>`;
    }
}
