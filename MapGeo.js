let processInstanceId;
let propertyId;
let latitude;
let longitude;
let zoom;
let markerRequested;
let place;
let geocoder;
let response;
let responseDiv;
let debugMode;
let language;
let environment;

var map;

//object used to recreate the structure that the Appway WebAPI is waiting for.
var fakeResults = JSON.parse('{"results": [{"address_components":[{"long_name":"302","short_name":"302","types":["street_number"]},{"long_name":"Route Yverdon-les-Bains","short_name":"Rte Yverdon-les-Bains","types":["route"]},{"long_name":"Cheyres-Châbles","short_name":"Cheyres-Châbles","types":["locality","political"]},{"long_name":"Svizzera","short_name":"CH","types":["country","political"]},{"long_name":"1468","short_name":"1468","types":["postal_code"]}],"formatted_address":"Rte Yverdon-les-Bains 302, 1468 Cheyres, Svizzera","geometry":{"location":{"lat":46.8175536,"lng":6.789963299999999}},"types":["street_address"]}]}');

const EXTENT = [-Math.PI * 6378137, Math.PI * 6378137];

var BASE_URL = "https://wmts.geo.admin.ch";
//const WMS_LAYERNAME = "ch.swisstopo.amtliches-gebaeudeadressverzeichnis";
const WMS_LAYERNAME_ADDRESSES = "ch.bfs.gebaeude_wohnungs_register";
const WMS_LAYERNAME_CADASTRE_INFO = "ch.swisstopo-vd.stand-oerebkataster";
const LAYERNAME_CADASTRE_MAP = "ch.kantone.cadastralwebmap-farbe";
const LAYERNAME_SWISSTOP_IMAGE = "ch.swisstopo.swissimage";

function xyzToBounds(x, y, z) {
    const tileSize = EXTENT[1] * 2 / Math.pow(2, z);
    const minx = EXTENT[0] + x * tileSize;
    const maxx = EXTENT[0] + (x + 1) * tileSize;
    // remember y origin starts at top
    const miny = EXTENT[1] - (y + 1) * tileSize;
    const maxy = EXTENT[1] - y * tileSize;
    return [minx, miny, maxx, maxy];
}

const getTileUrlAddresses = (coordinates, zoom) => {
    return (
        "https://wms.geo.admin.ch/?LANG=en" +
        "&REQUEST=GetMap&SERVICE=WMS&VERSION=1.3.0" +
        "&LAYERS=" + WMS_LAYERNAME_ADDRESSES +
        "&FORMAT=image/png" +
        "&CRS=EPSG:3857&WIDTH=256&HEIGHT=256" +
        "&BBOX=" +
        xyzToBounds(coordinates.x, coordinates.y, zoom).join(",")
    );
};

const getTileUrlCadastreInfo = (coordinates, zoom) => {
    return (
        "https://wms.geo.admin.ch/?LANG=en" +
        "&REQUEST=GetMap&SERVICE=WMS&VERSION=1.3.0" +
        "&LAYERS=" + WMS_LAYERNAME_CADASTRE_INFO +
        "&FORMAT=image/png" +
        "&CRS=EPSG:3857&WIDTH=256&HEIGHT=256" +
        "&BBOX=" +
        xyzToBounds(coordinates.x, coordinates.y, zoom).join(",")
    );
}


String.prototype.format = function () {
    var formatted = this;
    for (var i = 0; i < arguments.length; i++) {
        var regexp = new RegExp("\\{" + i + "\\}", "gi");
        formatted = formatted.replace(regexp, arguments[i]);
    }
    return formatted;
};


function init() {
    const submitButton = document.getElementById('send-address');
    const cancelButton = document.getElementById('cancel');    
    submitButton.addEventListener("click", () => sendPlace(place));    
    cancelButton.addEventListener("click", () => sendPlace(null));

    try {
        var params = new URLSearchParams(window.location.search);
        
        processInstanceId = params.get('processInstanceId');
        propertyId = params.get('propertyId');
        latitude = params.get('lat');
        longitude = params.get('lng');
        language = params.get("language");
        environment = params.get("env");
        if (environment == 'CLOUD' || environment == 'DEV') {
            debugMode = true;
        }

        if (latitude === null || latitude === "" || longitude === null || longitude === "") {
            //We center on Fribourg without a marker
            latitude = 46.8019884;
            longitude = 7.1512056;
            zoom = 18;
            submitButton.disabled = true;
        } else {
            markerRequested = true; //we will add a marker further down in this code
            latitude = parseFloat(latitude);
            longitude = parseFloat(longitude);
            zoom = 16;
            submitButton.disabled = false;
        }

        if (language == 'de') {
            document.getElementById('send-address').innerHTML = 'Auswählen';
            document.getElementById('cancel').innerHTML = 'Abbrechen';
        }
    }
    catch (e) {
        alert("Init failed: " + e);
    }

    const CONFIGURATION = {
        "ctaTitle": "Checkout",
        "mapOptions": { "center": { "lat": latitude, "lng": longitude }, "fullscreenControl": true, "mapTypeControl": false, "streetViewControl": false, "zoom": zoom, "zoomControl": true, "maxZoom": 22, "mapId": "" },
        "mapsApiKey": "AIzaSyBuPoEZqFu87V862JPR0J3NaX7zi8ldSPE",
        "capabilities": { "addressAutocompleteControl": true, "mapDisplayControl": true, "ctaControl": true }
    };
    const componentForm = [
        'location',
        'locality',
        'administrative_area_level_1',
        'country',
        'registry',
        'postal_code',
    ];

    const getFormInputElement = (component) => document.getElementById(component + '-input');

    var CadastrekarteType = new google.maps.ImageMapType({
        maxZoom: 19,
        minZoom: 7,
        name: "Cadastre",
        tileSize: new google.maps.Size(256, 256),
        credit: "swisstopo",
        getTileUrl: function (coord, zoom) {
            return (
                BASE_URL +
                "/1.0.0/" +
                LAYERNAME_CADASTRE_MAP +
                "/default/current/3857/" +
                zoom +
                "/" +
                coord.x +
                "/" +
                coord.y +
                ".png"
            );
        }
    });

    var OrthophotoType = new google.maps.ImageMapType({
        maxZoom: 20,
        minZoom: 7,
        name: "Orthophoto",
        tileSize: new google.maps.Size(256, 256),
        credit: "swisstopo",
        getTileUrl: function (coord, zoom) {
            return (
                BASE_URL +
                "/1.0.0/" +
                LAYERNAME_SWISSTOP_IMAGE +
                "/default/current/3857/" +
                zoom +
                "/" +
                coord.x +
                "/" +
                coord.y +
                ".jpeg"
            );
        }
    });

    /* Custom WMS layer  */
    const GebauedekarteType = new google.maps.ImageMapType({
        getTileUrl: getTileUrlAddresses,
        name: "Adresses",
        credit: "swisstopo",
        alt: "Gebäude",
        minZoom: 0,
        maxZoom: 21,
        opacity: 0.8
    });

    const CadastreInfoType = new google.maps.ImageMapType({
        getTileUrl: getTileUrlCadastreInfo,
        name: "InfoCadastre",
        credit: "swisstopo",
        alt: "InfoCadastre",
        minZoom: 0,
        maxZoom: 21,
        opacity: 0.8
    });

    map = new google.maps.Map(document.getElementById("gmp-map"), {
        zoom: CONFIGURATION.mapOptions.zoom,
        center: { lat: CONFIGURATION.mapOptions.center.lat, lng: CONFIGURATION.mapOptions.center.lng },
        fullscreenControl: CONFIGURATION.mapOptions.fullscreenControl,
        zoomControl: CONFIGURATION.mapOptions.zoomControl,
        streetViewControl: CONFIGURATION.mapOptions.streetViewControl,
        mapTypeControlOptions: {
            //mapTypeIds: ["Cadastre", "Orthophoto", "Adresses"],
            mapTypeIds: ["Cadastre", "Orthophoto"],
            style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR
        }
    });

    if (debugMode == 'true') {
        response = document.createElement("pre");
        response.id = "response";
        response.innerText = "";
        responseDiv = document.createElement("div");
        responseDiv.id = "response-container";
        responseDiv.appendChild(response);

        map.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(responseDiv);
    }


    map.mapTypes.set("Cadastre", CadastrekarteType);
    map.setMapTypeId("Cadastre");
    map.mapTypes.set("Orthophoto", OrthophotoType);
    map.mapTypes.set("Adresses", GebauedekarteType);

    //map.overlayMapTypes.insertAt(1, CadastreInfoType);
    //map.overlayMapTypes.insertAt(1, GebauedekarteType);
    map.overlayMapTypes.push(null); //we reserve a place for the addresses layer

    geocoder = new google.maps.Geocoder();

    map.addListener("click", (e) => {
        //getPlace({ location: e.latLng });
        getPlaceGeoAdmin(e);
    });

    map.addListener('zoom_changed', function () {
        if (map.getZoom() >= 17) {
            map.overlayMapTypes.setAt(1, GebauedekarteType);
        } else {
            map.overlayMapTypes.setAt(1, null);
        }
    });

    const marker = new google.maps.Marker({ map: map, draggable: false });
    if (markerRequested) {
        let latlng = new google.maps.LatLng(latitude, longitude);

        //getPlace({ location: latlng });
        getPlaceGeoAdmin({ latLng: latlng });

    }


    const autocompleteInput = getFormInputElement('location');

    const autocomplete = new google.maps.places.Autocomplete(autocompleteInput, {
        fields: ["address_components", "geometry", "name"],
        types: ["address"],
    });

    autocomplete.addListener('place_changed', function () {
        marker.setVisible(false);
        place = autocomplete.getPlace();
        if (!place.geometry) {
            // User entered the name of a Place that was not suggested and
            // pressed the Enter key, or the Place Details request failed.
            window.alert('No details available for input: \'' + place.name + '\'');
            return;
        }
        renderAddress(place);
        fillInAddress(place);
        submitButton.disabled = false;

        if (debugMode == 'true') {
            responseDiv.style.display = "block";
            response.innerText = 'ProcessID: ' + processInstanceId + '\n\n';
            response.innerText = response.innerText + 'PropertyID: ' + propertyId + '\n\n';
            response.innerText = response.innerText + JSON.stringify(place, null, 2);
        }
    });

    function fillInAddress(place) {  // optional parameter
        const addressNameFormat = {
            'street_number': 'short_name',
            'route': 'long_name',
            'locality': 'long_name',
            'administrative_area_level_1': 'short_name',
            'country': 'long_name',
            'postal_code': 'short_name',
        };
        const getAddressComp = function (type) {
            for (const component of place.address_components) {
                if (component.types[0] === type) {
                    return component[addressNameFormat[type]];
                }
            }
            return '';
        };
        getFormInputElement('location').value = getAddressComp('street_number') + ' ' + getAddressComp('route');
        for (const component of componentForm) {
            // Location and registry fields are handled separately as they have different logic.
            if (component !== 'location' && component !== 'registry') {
                getFormInputElement(component).value = getAddressComp(component);
            }
        }
    }

    function renderAddress(place) {
        //map.setCenter(place.geometry.location);
        map.panTo(place.geometry.location);
        marker.setPosition(place.geometry.location);
        marker.setVisible(true);
    }

    function getPlace(request) {
        geocoder
            .geocode(request)
            .then(async (result) => {
                const { results } = result;

                renderAddress(results[0]);
                fillInAddress(results[0]);

                if (debugMode == 'true') {
                    responseDiv.style.display = "block";
                    response.innerText = 'ProcessID: ' + processInstanceId + '\n\n';
                    response.innerText = response.innerText + 'PropertyID: ' + propertyId + '\n\n';
                    response.innerText = response.innerText + JSON.stringify(result, null, 2);
                }
                //alert(JSON.stringify(result, null, 2));
            })
            .catch((e) => {
                alert("Geocode was not successful for the following reason: " + e);
            });
    }



    async function sendPlace(body) {        

        var serverAddr;
        if (environment == 'CLOUD') {
            serverAddr = 'https://bcf-mortgage-dev.appway.com';
        } else if (environment == 'DEV') {
            serverAddr = 'https://onboardingd.frcorp.ch';
        } else if (environment == 'TEST') {
            serverAddr = 'https://onboardingt.frcorp.ch';
        } else if (environment == 'PROD') {
            serverAddr = 'https://onboarding.frcorp.ch';
        }


        //the Cancel button sends a null parameter
        if (body === null) {
            try {
                const res = await fetch(serverAddr + '/api/GoogleMaps/geocode/v1/' + processInstanceId + '/' + propertyId, {
                    method: 'POST',
                    body: '{ "results": []}', // string or object
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': 'WebAPI',
                        'User-Agent': 'AppwayClient',
                    },
                });
            }
            catch (e) {
                alert('An error occurred:' + e)
            }
        } else {
            try {
                const res = await fetch(serverAddr + '/api/GoogleMaps/geocode/v1/' + processInstanceId + '/' + propertyId, {
                    method: 'POST',
                    body: JSON.stringify(body), // string or object
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': 'WebAPI',
                        'User-Agent': 'AppwayClient',
                    },
                });
            }
            catch (e) {
                alert('An error occurred:' + e)
            }
            finally {
                //window.close();
            }
        }
    }


    function getAllInfoGeoAdmin(info, latLng) {
        if (info.results.length > 0) {
            console.log(JSON.stringify(info));
            submitButton.disabled = false;
            fillInAddressGeoAdmin(info);
            renderAddressGeoAdmin(latLng);
            setFakeResults(info, latLng);
        } else {
            marker.setVisible(false);
            submitButton.disabled = true;
            emptyAddressGeoAdmin();
            emptyDebugResponse();
        }
    }

    function emptyAddressGeoAdmin() {
        document.getElementById('location-input').value = '';
        document.getElementById('locality-input').value = '';
        document.getElementById('postal_code-input').value = '';

        place = null; //this is for the Button Sélectionner
    }


    function emptyDebugResponse() {
        if (debugMode == 'true') {
            responseDiv.style.display = "block";
            response.innerText = 'ProcessID: ' + processInstanceId + '\n\n';
            response.innerText = response.innerText + 'PropertyID: ' + propertyId + '\n\n';
        }
    }


    function setFakeResults(info, latLng) {
        for (const component of fakeResults.results[0].address_components) {
            if (component.types[0] === 'route') {
                component.long_name = info.results[0].properties.stn_label;
                component.short_name = info.results[0].properties.stn_label;
            }
            if (component.types[0] === 'street_number') {
                component.long_name = info.results[0].properties.adr_number;
                component.short_name = info.results[0].properties.adr_number;
            }
            if (component.types[0] === 'locality') {
                component.long_name = info.results[0].properties.com_name;
                component.short_name = info.results[0].properties.com_name;
            }
            if (component.types[0] === 'postal_code') {
                component.long_name = info.results[0].properties.zip_label.slice(0, 4);
                component.short_name = info.results[0].properties.zip_label.slice(0, 4);
            }

        }
        fakeResults.results[0].formatted_address = info.results[0].properties.stn_label + ' ' + info.results[0].properties.adr_number + ', ' + info.results[0].properties.zip_label;
        fakeResults.results[0].geometry.location.lat = latLng.lat();
        fakeResults.results[0].geometry.location.lng = latLng.lng();
        fakeResults.results[0].name = info.results[0].properties.stn_label + ' ' + info.results[0].properties.adr_number;

        if (debugMode == 'true') {
            responseDiv.style.display = "block";
            response.innerText = 'ProcessID: ' + processInstanceId + '\n\n';
            response.innerText = response.innerText + 'PropertyID: ' + propertyId + '\n\n';
            response.innerText = response.innerText + JSON.stringify(fakeResults, null, 2);
        }
    }


    function fillInAddressGeoAdmin(info) {

        document.getElementById('location-input').value = info.results[0].properties.adr_number + ' ' + info.results[0].properties.stn_label;
        document.getElementById('locality-input').value = info.results[0].properties.com_name;
        document.getElementById('postal_code-input').value = info.results[0].properties.zip_label.slice(0, 4);

        place = fakeResults; //this is for the Button Sélectionner
    }

    function renderAddressGeoAdmin(latLng) {
        let googleLatLng = new google.maps.LatLng(latLng.lat(), latLng.lng());
        map.panTo(googleLatLng);
        marker.setPosition(googleLatLng);
        marker.setVisible(true);
    }

    function getPolygonGeoAdmin(info, lv95east, lv95north) {
        if (info.results.length > 0) {
            console.log(JSON.stringify(info));
            renderTerrainGeoAdmin(info);
            document.getElementById('registry-input').value = info.results[0].properties.number;
            fakeResults.results[0].registryNumber = info.results[0].properties.number;
            if (debugMode == 'true') {
                responseDiv.style.display = "block";
                response.innerText = 'ProcessID: ' + processInstanceId + '\n\n';
                response.innerText = response.innerText + 'PropertyID: ' + propertyId + '\n\n';
                response.innerText = response.innerText + JSON.stringify(fakeResults, null, 2);
            }
        }
    }

    var terrainCoords = [];
    var terrainPolygon;

    function convertEachVertex(item, index, arr) {
        let wgs84 = Swisstopo.CHtoWGS(item[0] - 2000000, item[1] - 1000000);
        terrainCoords.push({ lat: wgs84[1], lng: wgs84[0] });
    }

    function renderTerrainGeoAdmin(info) {
        if (terrainPolygon) {
            terrainPolygon.setMap();
        }
        terrainCoords = [];
        //console.log(JSON.stringify(info.results[0].geometry.coordinates));
        const vertexes = info.results[0].geometry.coordinates[0];
        vertexes.forEach(convertEachVertex);
        //console.log(JSON.stringify(terrainCoords));

        /*
        const terrainCoords = [
            { lat: 25.774, lng: -80.19 },
            { lat: 18.466, lng: -66.118 },
            { lat: 32.321, lng: -64.757 },
            { lat: 25.774, lng: -80.19 },
        ];
        */

        // Construct the polygon.
        terrainPolygon = new google.maps.Polygon({
            paths: terrainCoords,
            strokeColor: "#000000",
            strokeOpacity: 0.8,
            strokeWeight: 4,
            fillColor: "#FFFF00",
            fillOpacity: 0.6,
        });
        terrainPolygon.addListener("click", (e) => {
            getPlaceGeoAdmin(e);
        });
        terrainPolygon.setMap(map);

    }



    function getPlaceGeoAdmin(request) {
        //https://api3.geo.admin.ch/rest/services/api/MapServer/identify?geometryFormat=geojson&geometryType=esriGeometryPoint&lang=fr&layers=all:ch.swisstopo.amtliches-gebaeudeadressverzeichnis&returnGeometry=false&sr=4326&mapExtent=8.225000043,46.815000098,8.226323416,46.815890570&imageDisplay=100,100,100&tolerance=100&lang=fr&geometry=7.08228,46.62277

        fetch('https://api3.geo.admin.ch/rest/services/api/MapServer/identify?sr=4326&geometry='
            + request.latLng.lng() + ',' + request.latLng.lat()
            + '&mapExtent=8.225000043,46.815000098,8.226323416,46.815890570&imageDisplay=100,100,100&tolerance=10'
            + '&geometryFormat=geojson&geometryType=esriGeometryPoint&lang=fr&returnGeometry=true'
            + '&layers=all:ch.swisstopo.amtliches-gebaeudeadressverzeichnis', {
            method: 'GET'
        })
            .then(response => response.json())
            .then(response => getAllInfoGeoAdmin(response, request.latLng));

        var coordsCH = Swisstopo.WGStoCH(request.latLng.lat(), request.latLng.lng()); // coords = [y, x]

        //https://api3.geo.admin.ch/rest/services/api/MapServer/identify?sr=2056&geometry=2572415.599,1163563.696&mapExtent=2572606.3210881464,1163490.8046886274,2572747.266889792,1163575.6778068822&imageDisplay=1199,722,96&tolerance=10&geometryFormat=geojson&geometryType=esriGeometryPoint&lang=fr&returnGeometry=true&layers=all:ch.swisstopo-vd.stand-oerebkataster
        fetch('https://api3.geo.admin.ch/rest/services/api/MapServer/identify?sr=2056&geometry='
            + (coordsCH[0] + 2000000.0) + ',' + (coordsCH[1] + 1000000.0)
            + '&mapExtent=2572606.3210881464,1163490.8046886274,2572747.266889792,1163575.6778068822&imageDisplay=1199,722,96&tolerance=10'
            + '&geometryFormat=geojson&geometryType=esriGeometryPoint&lang=fr&returnGeometry=true'
            + '&layers=all:ch.swisstopo-vd.stand-oerebkataster', {
            method: 'GET'
        })
            .then(response => response.json())
            .then(response => getPolygonGeoAdmin(response, coordsCH[0], coordsCH[1]));

    }    
}

window.init = init;