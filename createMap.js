let map = L.map('map', {
    zoomSnap: 0,
    zomDelta: 5,
    wheelPxPerZoomLevel: 140,
}).setView([45.9628666, 25.2081763], 7.4);
let lightTile = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
    id: 'cartoDB/light-v9',
    tileSize: 512,
    zoomOffset: -1
});
let darkTile = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
    id: 'cartoDB/dark-v9',
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

let memFetch = async (alegeri) => {

    if (!window.hasOwnProperty('rezultateAlegeri')) window.rezultateAlegeri = {};
    if (window.rezultateAlegeri[alegeri] !== undefined) return window.rezultateAlegeri[alegeri];

    let response = await fetch(`data/alegeri/rezultate_${alegeri}.json`);
    let data = await response.json();

    window.rezultateAlegeri[alegeri] = data;
    return data;
}
function loadResults(alegeri) {
    window.results = {};
    window.statsJudete = {};
    document.querySelector('#loading').style.display = "flex";
    document.querySelector('#rezultate').style.display = "flex";
    const emptyData = {
        castigator: { party: "N/A", votes: 0, name: "N/A" },
        totalVoturi: 0,
        votes: [{ party: "N/A", votes: 0, name: "N/A" }],
    };
    let compareAlegeri = false;
    if (alegeri == "primariNoi") {
        alegeri = "locale09062024P";
        compareAlegeri = true;
    }
    memFetch(alegeri)
        .then(data => {
            getCommunes().then(async communes => {

                if (geoJSON) geoJSON.removeFrom(map);
                if (conturGeoJSON) conturGeoJSON.removeFrom(map);
                let compData = []
                if (compareAlegeri) {
                    compData = await memFetch("locale27092020P");
                }
                geoJSON = await L.geoJSON(communes, {
                    style: function (feature) {
                        let county = feature.properties.county.clear();
                        let name = feature.properties.name.clear();
                        let countyCode = window.countiesCodes[county];

                        let fillColor = "#333333";
                        let weight = 0.3;
                        let fillOpacity = 1;
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
                        if (!window.statsJudete.hasOwnProperty(county)) window.statsJudete[county] = {};
                        if (data.hasOwnProperty(countyCode)) {
                            if (data[countyCode].hasOwnProperty(name)) {
                                let votes = sortByValues(data[countyCode][name].votes, 'votes');
                                let index = 0;
                                if (votes.length > 1 && document.querySelector('#toggleLocul2').checked == true) index = 1;
                                fillColor = getPartyColor(votes[index].party);
                                if (!window.results.hasOwnProperty(votes[index].party)) window.results[votes[index].party] = { name: votes[index].party, UAT: 0, votes: 0 };
                                window.results[votes[index].party].UAT++;
                                feature.properties.data = {
                                    totalVoturi: votes.reduce((a, b) => a + b.votes, 0),
                                }
                                feature.properties.data.votes = votes.map(v => {
                                    // window.results[votes[index].party].votes += v.votes;
                                    v.percentage = (v.votes / feature.properties.data.totalVoturi * 100).toFixed(2);
                                    v.procent = v.votes / feature.properties.data.totalVoturi;
                                    return v;
                                });
                                for (const vote of votes) {
                                    if (!window.statsJudete[county].hasOwnProperty(vote.party)) window.statsJudete[county][vote.party] = { name: vote.party, votes: 0, totalVotes: 0, UAT: 0 };
                                    window.statsJudete[county][vote.party].votes += vote.votes;

                                    if (!window.results.hasOwnProperty(vote.party)) window.results[vote.party] = { name: vote.party, UAT: 0, votes: 0 };
                                    window.results[vote.party].votes += vote.votes;
                                }
                                if (feature.properties.data.votes.length == 0) feature.properties.data.votes = [{ party: "N/A", votes: 0, name: "N/A" }];
                                else {
                                    window.statsJudete[county][votes[index].party].UAT++;
                                }

                                // Process if "PARTIDUL REÎNNOIM PROIECTUL EUROPEAN AL ROMÂNIEI" has at least one vote
                                let hasVotesForSpecificParty = votes.some(vote => vote.party === "PARTIDUL REÎNNOIM PROIECTUL EUROPEAN AL ROMÂNIEI");
                                if (hasVotesForSpecificParty) {
                                    return {
                                        fillColor: fillColor,
                                        weight: weight,
                                        color: "#000000",
                                        fillOpacity: fillOpacity
                                    }
                                }
                            } else {
                                feature.properties.data = { ...emptyData };
                            }
                        } else {
                            feature.properties.data = { ...emptyData };
                        }

                        return {
                            fillColor: "#FFFFFF",
                            weight: 0,
                            color: "#000000",
                            fillOpacity: 0
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
                addSVGLayer();
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
    } catch (e) {
        console.log(feature.properties);
    }
    for (let votes of feature.properties.data.votes) {
        let fillColor = getPartyColor(votes.party);
        popupContent += `
            <p>
            <span class="bar" style=""><b style="width:${votes.percentage}%"></b></span>
            <span class="color" style="background-color:${fillColor}"></span>
            ${votes.party == votes.name ?
                `<span class="nume">${votes.party}<br>${votes.votes?.toLocaleString()} Voturi - ${votes.percentage}%</span>` :
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
}

function addSVGLayer() {
    const svgLayer = L.svg();
    svgLayer.addTo(map);
    
    d3.select("#map").select("svg").append("g").attr("id", "svg-layer");

    map.on("zoomend", updateSVG);
    map.on("moveend", updateSVG);

    updateSVG();
}

function getColorForPercentage(percentage) {
    if (percentage <= 1) {
        return "red";
    } else if (percentage <= 5) {
        return "green";
    } else {
        return "blue";
    }
}

function updateSVG() {
    const svg = d3.select("#svg-layer");
    svg.selectAll("*").remove();

    const bounds = map.getBounds();
    const topLeft = map.latLngToLayerPoint(bounds.getNorthWest());
    const bottomRight = map.latLngToLayerPoint(bounds.getSouthEast());

    svg.attr("width", bottomRight.x - topLeft.x)
       .attr("height", bottomRight.y - topLeft.y)
       .style("left", `${topLeft.x}px`)
       .style("top", `${topLeft.y}px`);

    geoJSON.eachLayer(function(layer) {
        const center = layer.getBounds().getCenter();
        const layerPoint = map.latLngToLayerPoint(center);

        if (layer.feature.properties.data) {
            const specificParty = layer.feature.properties.data.votes.find(vote => vote.party === "PARTIDUL REÎNNOIM PROIECTUL EUROPEAN AL ROMÂNIEI");
            if (specificParty) {
                const percentage = parseFloat(specificParty.percentage);
                const color = getColorForPercentage(percentage);

                svg.append("text")
                   .attr("x", layerPoint.x - topLeft.x)
                   .attr("y", layerPoint.y - topLeft.y)
                   .attr("class", "svg-text")
                   .text(`${percentage}%`)
                   .style("font-size", "12px")
                   .style("fill", color)
                   .append("title")
                   .text(`${percentage}%`);
            }
        }
    });
}

String.prototype.clip = function (n) { return this.length < n ? this : this.substring(0, n - 3) + '...' };
function setTable(county = "") {

    let table = document.querySelector('#table');
    table.innerHTML = `    `;

    let count = 0;

    let results = []
    if (county == "") results = sortByValues(window.results, 'UAT');
    else results = sortByValues(window.statsJudete[county], 'UAT');
    //sum all votes
    let sum = results.reduce((a, b) => a + b.votes, 0);
    let totalUATs = results.reduce((a, b) => a + b.UAT, 0);
    for (let party of results) {
        // Display only the specified party in the table
        if (party.name === "PARTIDUL REÎNNOIM PROIECTUL EUROPEAN AL ROMÂNIEI") {
            count++;
            if (count > 12) break;

            table.innerHTML += `<div>
                        <p class="color" style="background-color:${getPartyColor(party.name)}">
            <input class="iparty" onclick="selectParty('${party.name}')" type="checkbox" value="${party.name}"
            ${window.partideAlese.includes(party.name) ? "checked" : ""}
            ${!window.partideAlese.includes(party.name) && window.partideAlese.length >= 2 ? "disabled" : ""}
             ></p>
            <p>
            <span><abbr title="${party.name}">${party.name.clip(30)}</abbr></span>
            <span>${party.UAT.toLocaleString()} UAT ${county != "" ? `(${(party.UAT / totalUATs * 100).toFixed(2)}%)` : ''} - ${party.votes.toLocaleString()} voturi (${(party.votes / sum * 100).toFixed(2)}%)</span>
            </p>
            </div>`;
        }
    }
    table.insertAdjacentHTML('beforeend', `<div class="custom-select"><select id="countiesSelect" onchange="setTable(this.value)"><option value="">Alege Judet</option></select></div>`);
    let aJudete = [];
    for (let iCounty in window.statsJudete) {
        let totalUATs = 0;
        let totalVotes = 0;
        for (let party in window.statsJudete[iCounty]) {
            totalUATs += window.statsJudete[iCounty][party].UAT;
            totalVotes += window.statsJudete[iCounty][party].votes;
        }
        aJudete.push({ name: iCounty == "SR" ? "Strainatate" : iCounty, UAT: totalUATs, votes: totalVotes });
    }
    aJudete.sort((a, b) => b.votes - a.votes);
    for (let party of aJudete) {
        document.querySelector('#countiesSelect').innerHTML += `<option value="${party.name}" ${party.name == county ? "selected" : ""}>${party.name}: ${party.votes.toLocaleString()} (${party.UAT.toLocaleString()})</option>`
    }
}
