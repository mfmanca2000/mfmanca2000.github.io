let map;
let marker;
let geocoder;
let responseDiv;
let response;
let processInstanceId;
let latitude;
let longitude;
let zoom;
let markerRequested;


function initMap() {
  try {
    var params = new URLSearchParams(window.location.search);

    processInstanceId = params.get('processInstanceId');
    latitude = params.get('lat');
    longitude = params.get('lng');

    if(latitude === null || latitude === "" || longitude === null || longitude === ""){
      //We center on Fribourg without a marker
      latitude = 46.807714;  
      longitude = 7.1031315;  
      zoom = 10;
    } else {
      markerRequested = true; //we will add a marker further down in this code
      latitude = parseFloat(latitude);
      longitude = parseFloat(longitude);
      zoom = 15;
    }    
  }
  catch(e){
    alert("Init failed: " + e);
  }

  map = new google.maps.Map(document.getElementById("map"), {
    zoom: zoom,
    center: { lat: latitude, lng: longitude },
    mapTypeControl: false,
    scaleControl: true
  });
  geocoder = new google.maps.Geocoder();

  const inputText = document.createElement("input");

  inputText.type = "text";
  inputText.placeholder = "Enter a location";

  const submitButton = document.createElement("input");

  submitButton.type = "button";
  submitButton.value = "Search";
  submitButton.classList.add("button", "button-primary");

  const clearButton = document.createElement("input");

  clearButton.type = "button";
  clearButton.value = "Clear";
  clearButton.classList.add("button", "button-secondary");
  response = document.createElement("pre");
  response.id = "response";
  response.innerText = "";
  responseDiv = document.createElement("div");
  responseDiv.id = "response-container";
  responseDiv.appendChild(response);

  //const instructionsElement = document.createElement("p");
  //instructionsElement.id = "instructions";
  //instructionsElement.innerHTML = "<strong>Instructions</strong>: Saisissez une adresse dans le champ ci-dessus ou cliquez sur la carte";

  map.controls[google.maps.ControlPosition.TOP_LEFT].push(inputText);
  map.controls[google.maps.ControlPosition.TOP_LEFT].push(submitButton);
  map.controls[google.maps.ControlPosition.TOP_LEFT].push(clearButton);
  //map.controls[google.maps.ControlPosition.LEFT_TOP].push(instructionsElement);
  map.controls[google.maps.ControlPosition.LEFT_TOP].push(responseDiv);
  marker = new google.maps.Marker({
    map,
  });

  

  map.addListener("click", (e) => {
    geocode({ location: e.latLng });
  });
  submitButton.addEventListener("click", () =>
    geocode({ address: inputText.value })
  );
  clearButton.addEventListener("click", () => {
    clear();
  });

  if (markerRequested) {
    let latlng = new google.maps.LatLng(latitude,longitude);
    marker.setPosition(latlng);    
  } else {
    clear();
  }
}

function clear() {
  marker.setMap(null);
  responseDiv.style.display = "none";
}

function geocode(request) {
  clear();
  geocoder
    .geocode(request)
    .then(async (result) => {
      const { results } = result;

      map.setCenter(results[0].geometry.location);
      marker.setPosition(results[0].geometry.location);
      marker.setMap(map);
      responseDiv.style.display = "block";
      response.innerText = JSON.stringify(result, null, 2);

      /*
      var xhr = new XMLHttpRequest();
      xhr.onload = function() {        
        console.log(this.responseText);        
      }
      xhr.open("POST", 'https://bcf-mortgage-dev.appway.com/api/GoogleMaps/geocode/v1/' + processInstanceId, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('X-CSRF-Token','WebAPI');
      xhr.setRequestHeader('User-Agent','AppwayClient');
      xhr.send(results[0]);
      */

      
      const res = await fetch('https://bcf-mortgage-dev.appway.com/api/GoogleMaps/geocode/v1/' + processInstanceId, {
         method: 'POST',
         body: results[0], // string or object
         headers: {            
            'Content-Type': 'application/json',
            'X-CSRF-Token': 'WebAPI',
            'User-Agent': 'AppwayClient',
         }
      });      

      return results;
    })
    .catch((e) => {
      alert("Geocode was not successful for the following reason: " + e);
    });
}

window.initMap = initMap;