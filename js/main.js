function ViewModel(){var e=this;e.parkList=ko.observableArray(),e.currentPark=ko.observable(),e.isListViewActive=ko.observable(!1),e.categorySearch=ko.observable(),e.strSearch=ko.observable(""),e.isDoneLoading=ko.observable(!1),e.emptyPark={name:"",img:"",desc:"",coords:{lat:"",lng:""},id:-1,details:-1,weatherTemp:ko.observable(""),weatherIcon:ko.observable("")},e.buildModel=function(){localStorage.getItem("totalParks")?(model.loadParksData(),e.init(!0)):model.getParksData().done(function(){e.init(!1)})},e.toggleListView=function(){e.isListViewActive(!e.isListViewActive())},e.filterParks=ko.computed(function(){var a=parseInt(e.categorySearch()),r=new RegExp(e.strSearch(),"i");return e.isDoneLoading()&&(localStorage.setItem("currentCategory",a),localStorage.setItem("currentSearch",e.strSearch())),ko.utils.arrayFilter(e.parkList(),function(t){var o;o=a===ALL?!0:t.details===a;var n=t.name.search(r)>=0,i=o&&n;return e.isDoneLoading()&&e.getCurrentParkId()===t.id&&!i&&googleMapView.closeInfoWindow(),googleMapView.displayMarker(t.id,i),e.getCurrentParkId()===t.id&&i&&googleMapView.resumeMarkerBounce(),i})}),e.wikiSourceStart=ko.pureComputed(function(){var a="";switch(e.currentPark().details){case BOTH:a="Photo and fact via ";break;case FACT:a="Fact via ";break;case PHOTO:a="Photo via "}return a}),e.shouldDisplayLink=function(){return e.currentPark().details>NONE},e.init=function(a){if(e.parkList(model.arrParks),googleMapView.setUpMarkers(e.parkList()),e.currentPark(e.emptyPark),ko.applyBindings(viewModel),a){e.categorySearch(localStorage.getItem("currentCategory")),e.strSearch(localStorage.getItem("currentSearch"));var r=localStorage.getItem("currentParkId");r>-1&&e.mimicMarkerClick(e.parkList()[r])}e.isDoneLoading(!0)},e.setCurrentPark=function(a){0>a?e.currentPark(e.emptyPark):e.currentPark(e.parkList()[a]),localStorage.setItem("currentParkId",a)},e.getCurrentParkId=function(){return void 0===e.currentPark()?-1:e.currentPark().id},e.mimicMarkerClick=function(e){googleMapView.clickMarker(e.id)},e.refreshWeatherData=function(e){model.getWeatherData(e)}}function GoogleMapView(){function e(){r.gMap=new google.maps.Map(document.getElementById("map"),{center:{lat:39.768491,lng:-86.157679},zoom:7})}function a(){r.infoWindow=new google.maps.InfoWindow,r.infoWindow.setContent(r.knockoutDiv),google.maps.event.addListener(r.infoWindow,"closeclick",r.closeInfoWindow)}var r=this;r.gMap="",r.infoWindow="",r.knockoutDiv=$(".knockout-infowindow")[0],r.holderDiv=$(".holder"),r.arrMarkers=[],r.init=function(){e(),a()},r.closeInfoWindow=function(){r.arrMarkers[viewModel.getCurrentParkId()].setAnimation(null),r.holderDiv.append(r.knockoutDiv),r.infoWindow.close(),viewModel.setCurrentPark(-1)},r.setUpMarkers=function(e){function a(){for(var a=0;o>a;a++){var t=e[a],n=new google.maps.Marker({position:t.coords,title:t.name});n.id=a;var i="http://maps.google.com/mapfiles/ms/micons/red.png";switch(t.details){case BOTH:i="http://maps.google.com/mapfiles/ms/micons/green-dot.png";break;case FACT:i="http://maps.google.com/mapfiles/kml/pal3/icon36.png";break;case PHOTO:i="http://maps.google.com/mapfiles/ms/micons/camera.png"}n.setIcon(i),r.arrMarkers.push(n)}}function t(){for(var e=r.arrMarkers.length,a=0;e>a;a++)r.arrMarkers[a].addListener("click",function(){r.clickMarker(this.id)})}var o=e.length;a(),t()},r.clickMarker=function(e){var a=r.arrMarkers[e];if(a.getAnimation())a.setAnimation(null),r.closeInfoWindow();else{var t=viewModel.getCurrentParkId();t>-1&&r.arrMarkers[t].setAnimation(null),a.setAnimation(google.maps.Animation.BOUNCE),viewModel.setCurrentPark(a.id),viewModel.refreshWeatherData(a.id),r.infoWindow.open(r.gMap,a)}},r.displayMarker=function(e,a){void 0!==r.arrMarkers[e]&&(a?r.arrMarkers[e].setMap(r.gMap):r.arrMarkers[e].setMap(null))},r.resumeMarkerBounce=function(){r.arrMarkers[viewModel.getCurrentParkId()].setAnimation(google.maps.Animation.BOUNCE)}}var model,viewModel,googleMapView,ALL=-1,NONE=0,PHOTO=1,FACT=2,BOTH=3;$(document).ready(function(){"undefined"==typeof google?(console.log("Unable to access Google Maps API."),alert("Unable to access Google Maps API.  Please check your internet connection and/or firewall.")):(googleMapView=new GoogleMapView,googleMapView.init(),model=new Model,viewModel=new ViewModel,viewModel.buildModel())});var Model=function(){function e(e){e.parse.text?r(e.parse.text["*"]):(console.log("Error in getting Wiki data."),alert("Unable to obtain State Parks data from Wikipedia."))}function a(e,a,r,t,o){this.name=e,this.img=a,this.desc=r,this.coords=t,this.id=o,this.details=NONE,""!==a&&""!==r?this.details=BOTH:""!==r?this.details=FACT:""!==a&&(this.details=PHOTO)}function r(e){function r(a,r){var t=$("tr td:nth-child("+a+")",$(e)),o=[];return r?t.each(function(e,a){var r=$("img",$(a)).attr("src");r||(r=""),o.push(r)}):t.each(function(e,a){o.push($(a).text())}),o}function n(e){return e.forEach(function(a,r){var t=a.search(/\(/),o=a.search(/;/),n=parseFloat(a.substr(o-6,o)),i=parseFloat(a.substr(o+1,t-1));e[r]={lat:n,lng:i}}),e}function i(e){return e.forEach(function(a,r){var t=a.search(/\[/);e[r]=a.substr(0,t)}),e}var s="//upload.wikimedia",c=new RegExp(s,"gi");e=e.replace(c,"http://upload.wikimedia");var l=r(1,!1),d=r(2,!0),g=r(3,!1),p=r(7,!1);g=n(g),p=i(p);var u=l.length;localStorage.setItem("totalParks",u);for(var k=0;u>k;k++){var m=new a(l[k],d[k],p[k],g[k],k);localStorage.setItem("park"+k,JSON.stringify(m)),m.weatherTemp=ko.observable(""),m.weatherIcon=ko.observable(""),o.arrParks.push(m);var h=new t;o.arrWeather.push(h),localStorage.setItem("weather"+k,JSON.stringify(h))}}function t(){this.temp="",this.icon="",this.timeStamp=""}var o=this;o.arrParks=[],o.arrWeather=[],o.loadParksData=function(){for(var e=localStorage.getItem("totalParks"),a=0;e>a;a++){var r=JSON.parse(localStorage.getItem("park"+a));r.weatherTemp=ko.observable(""),r.weatherIcon=ko.observable(""),o.arrParks.push(r);var t=JSON.parse(localStorage.getItem("weather"+a));o.arrWeather.push(t),r.weatherTemp(t.temp),r.weatherIcon(t.icon)}},o.getParksData=function(){var a="http://en.wikipedia.org/w/api.php?action=parse&section=1&prop=text&page=List_of_Indiana_state_parks&format=json&callback=?";return $.getJSON(a,e)},o.getWeatherData=function(e){function a(){var a=Math.round(r.coords.lat),o=Math.round(r.coords.lng),n="http://api.openweathermap.org/data/2.5/weather?lat="+a+"&lon="+o+"&units=imperial&APPID=0a305c0d2d66d7ed45c9edd57d68e80e";$.getJSON(n).done(function(a){void 0!==a.main?(t.temp=Math.round(a.main.temp),t.icon="http://openweathermap.org/img/w/"+a.weather[0].icon+".png",t.timeStamp=Date.now(),localStorage.setItem("weather"+e,JSON.stringify(t)),r.weatherTemp(t.temp),r.weatherIcon(t.icon)):console.log("OpenWeatherMap unable to find that city based on coordinates.")}).fail(function(e){console.log("Failed to get weather data from OpenWeatherMap:"),console.log(e)})}var r=o.arrParks[e],t=o.arrWeather[e];(""===t.temp||t.timeStamp-Date.now()>=36e5)&&a()}};