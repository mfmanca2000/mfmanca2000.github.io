var map;

String.prototype.format = function() {
  var formatted = this;
  for (var i = 0; i < arguments.length; i++) {
    var regexp = new RegExp("\\{" + i + "\\}", "gi");
    formatted = formatted.replace(regexp, arguments[i]);
  }
  return formatted;
};


function init() {
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
    getTileUrl: function(coord, zoom) {
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
    getTileUrl: function(coord, zoom) {
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

  map = new google.maps.Map(document.getElementById("map"), {
    zoom: 16,
    center: new google.maps.LatLng(46.94, 7.45),
    mapTypeControlOptions: {
      mapTypeIds: ["Cadastre", "Orthophoto"],
      style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR
    }
  });

  map.mapTypes.set("Cadastre", CadastrekarteType);
  map.setMapTypeId("Cadastre");

  map.mapTypes.set("Orthophoto", OrthophotoType);
}