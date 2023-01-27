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

var map;

const EXTENT = [-Math.PI * 6378137, Math.PI * 6378137];

const WMS_LAYERNAME = "ch.swisstopo.amtliches-gebaeudeadressverzeichnis";

function xyzToBounds(x, y, z) {
    const tileSize = EXTENT[1] * 2 / Math.pow(2, z);
    const minx = EXTENT[0] + x * tileSize;
    const maxx = EXTENT[0] + (x + 1) * tileSize;
    // remember y origin starts at top
    const miny = EXTENT[1] - (y + 1) * tileSize;
    const maxy = EXTENT[1] - y * tileSize;
    return [minx, miny, maxx, maxy];
}

const getTileUrl = (coordinates, zoom) => {
    return (
        "https://wms.geo.admin.ch/?LANG=en" +
        "&REQUEST=GetMap&SERVICE=WMS&VERSION=1.3.0" +
        "&LAYERS=" + WMS_LAYERNAME +
        "&FORMAT=image/png" +
        "&CRS=EPSG:3857&WIDTH=256&HEIGHT=256" +
        "&BBOX=" +
        xyzToBounds(coordinates.x, coordinates.y, zoom).join(",")
    );
};


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
    submitButton.addEventListener("click", () => sendPlace());

    try {
        var params = new URLSearchParams(window.location.search);

        debugMode = params.get('debug');
        processInstanceId = params.get('processInstanceId');
        propertyId = params.get('propertyId');
        latitude = params.get('lat');
        longitude = params.get('lng');

        if (latitude === null || latitude === "" || longitude === null || longitude === "") {
            //We center on Fribourg without a marker
            latitude = 46.8019884;
            longitude = 7.1512056;
            zoom = 18;
        } else {
            markerRequested = true; //we will add a marker further down in this code
            latitude = parseFloat(latitude);
            longitude = parseFloat(longitude);
            zoom = 16;
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
        'postal_code',
    ];

    const getFormInputElement = (component) => document.getElementById(component + '-input');



    var BASE_URL = "https://wmts.geo.admin.ch";

    var layer = "ch.kantone.cadastralwebmap-farbe";
    var format = "png";
    var url =
        BASE_URL +
        "/1.0.0/" +
        layer +
        "/default/current/3857/{z}/{x}/{y}." +
        format;

    //Define OSM map type pointing at the OpenStreetMap tile server

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
                layer +
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
                "/1.0.0/ch.swisstopo.swissimage/default/current/3857/" +
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
        getTileUrl: getTileUrl,
        name: "Adresses",
        credit: "swisstopo",
        alt: "Gebäude",
        minZoom: 0,
        maxZoom: 19,
        opacity: 0.8
    });


    //ch.swisstopo.amtliches-gebaeudeadressverzeichnis


    map = new google.maps.Map(document.getElementById("gmp-map"), {
        zoom: CONFIGURATION.mapOptions.zoom,
        center: { lat: CONFIGURATION.mapOptions.center.lat, lng: CONFIGURATION.mapOptions.center.lng },
        fullscreenControl: CONFIGURATION.mapOptions.fullscreenControl,
        zoomControl: CONFIGURATION.mapOptions.zoomControl,
        streetViewControl: CONFIGURATION.mapOptions.streetViewControl,
        mapTypeControlOptions: {
            mapTypeIds: ["Cadastre", "Orthophoto", "Adresses"],
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

    map.overlayMapTypes.insertAt(1, GebauedekarteType);

    geocoder = new google.maps.Geocoder();

    map.addListener("click", (e) => {
        //getPlace({ location: e.latLng });
        getPlaceGeoAdmin(e);
    });

    const marker = new google.maps.Marker({ map: map, draggable: false });
    if (markerRequested) {
        let latlng = new google.maps.LatLng(latitude, longitude);
        //marker.setPosition(latlng);
        //marker.setVisible(true);

        getPlace({ location: latlng });

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
        getFormInputElement('location').value = getAddressComp('street_number') + ' '
            + getAddressComp('route');
        for (const component of componentForm) {
            // Location field is handled separately above as it has different logic.
            if (component !== 'location') {
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


    async function sendPlace() {
        if (place === null) {
            alert('Recherchez une adresse');
        } else {
            try {
                const res = await fetch('https://bcf-mortgage-dev.appway.com/api/GoogleMaps/geocode/v1/' + processInstanceId + '/' + propertyId, {
                    method: 'POST',
                    body: place, // string or object
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

    async function getPlaceGeoAdmin(request) {
        const res = await fetch('https://api3.geo.admin.ch/rest/services/api/MapServer/identify?sr=4326&geometry=' 
        + request.latLng.lng() + ',' + request.latLng.lat() 
        + '&mapExtent=8.225000043,46.815000098,8.226323416,46.815890570&imageDisplay=100,100,100&tolerance=10'
        + '&geometryFormat=geojson&geometryType=esriGeometryPoint&lang=fr&returnGeometry=false' 
        + '&layers=all:ch.swisstopo.amtliches-gebaeudeadressverzeichnis', {
            method: 'GET'
        });

        //https://api3.geo.admin.ch/rest/services/api/MapServer/identify?geometryFormat=geojson&geometryType=esriGeometryPoint&lang=fr&layers=all:ch.swisstopo.amtliches-gebaeudeadressverzeichnis&returnGeometry=false&sr=4326&mapExtent=8.225000043,46.815000098,8.226323416,46.815890570&imageDisplay=100,100,100&tolerance=100&lang=fr&geometry=7.08228,46.62277
        
       console.log(request.latLng);
       var obj = JSON.parse(res);
       console.log(obj);
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
}

window.init = init;