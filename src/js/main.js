//Order of all this stuff...
/*
 -basic map can fire right away  (can stick the initMap as a callback on the google script)
 -wiki / localStorage data grab == can fire right away

 -**creating the map markers == google script must be loaded AND wiki/localStorage must be done
  -then place the map markers / create the infoWindow
   --^Really, the list shouldn't be clickable until the map markers are created (AND placed)

 -calls to weather data upon click.

*/
// !!!! TODO:  Need to test what happens with no localStorage AND no internet/firewall blocks wiki.
  //jsonp doesn't work with .fail right?  So a .fail() after the .done() of getParksData won't
  //ever trigger?  Is that correct?
  // TODO:  Better error handling in general

// !!!! TODO:  add comments to some of the code functions

// !!!! TODO:  any fix for that graphical glitch where google maps shows the infoWindow but
   //then recenters and makes the screen flash?

var model;
var viewModel;
var googleMapView;

/* Constants */
var ALL = -1;
var NONE = 0;
var PHOTO = 1;
var FACT = 2;
var BOTH = 3;

//hmmm... is doc.ready even needed anymore?  Test that I guess
$(document).ready(function() {
	googleMapView = new GoogleMapView();
	googleMapView.init();
	model = new Model();  //Yes, keep all three of these separate
	viewModel = new ViewModel();
	if (localStorage.getItem('totalParks')) {  //?but this could actually be a function of the viewModel
		model.loadParksData();
		viewModel.init();
	}
	else {
		model.getParksData().done(viewModel.init);
	}
});

var Model = function() {
	var self = this;

	self.arrParks = [];
	self.arrWeather = [];

	self.loadParksData = function() {
		var len = localStorage.getItem('totalParks');
		for (var i = 0; i < len; i++) {
			var park = JSON.parse(localStorage.getItem('park' + i));

			park.weatherTemp = ko.observable('');
			park.weatherIcon = ko.observable('');

			self.arrParks.push(park);

			var weather = JSON.parse(localStorage.getItem('weather' + i));
			self.arrWeather.push(weather);

			park.weatherTemp(weather.temp);
			park.weatherIcon(weather.icon);
		}
	};

	/*  function getParksData
	 *
	 *  Returns the getJSON call so that its jQuery deferred object gets returned.
	 *  This is because the ViewModel is dependent upon the Wikipedia data and thus
	 *  can only proceed once the GET request is done.
	 *
	 *  Help/Source:
	 *  http://stackoverflow.com/questions/14220321/how-to-return-the-response-from-an-asynchronous-call
	*/

	self.getParksData = function() {
		var wikiLink = 'http://en.wikipedia.org/w/api.php?action=parse&section=1&prop=text'
		+ '&page=List_of_Indiana_state_parks&format=json&callback=?';

		return $.getJSON(wikiLink, wikiCallback);
	};

	function wikiCallback(data) {
		if (data.parse.text) {
			parseData(data.parse.text['*']);
		}
		else {  // TODO:  Better handling
			console.log("Error in getting Wiki data.");
		}	
	};

	/*
	 *  Park is the class used for storing individual park data
	*/

	function Park(name, img, desc, coords, id) {
		this.name = name;
		this.img = img;
		this.desc = desc;
		this.coords = coords;
		this.id = id;
		this.details = NONE;

		if (img !== '' && desc !== '') {
			this.details = BOTH;
		}
		else {
			if (desc !== '') {
				this.details = FACT;
			}
			else if (img !== '') {
				this.details = PHOTO;
			}
		}
	}

	/*
	 *  Weather is the class used for storing weather data into localStorage
	*/

	function Weather() {
		this.temp = '';
		this.icon = '';
		this.timeStamp = '';
	}

	/*  function parseData
	 *
	 *  The data retrieved from Wikipedia is a horrible string of HTML.  This function
	 *  sifts through it and grabs the pertinent information.  It turns it into Park
	 *  objects, stores them all in the arrParks array, and saves them into localStorage.
	*/

	function parseData(wikiHTML) {
		/* These three lines of code are really only important for the case where you're
		 * running this app from files on a local machine.  Wikipedia's links do not contain
		 * 'http:'.  Thus, as jQuery parses the string into DOM elements, the browser fires
		 * off many GET requests to file:///upload.wikimedia.etc, which don't exist.  This
		 * greatly slowed down the loading on my pc.
		*/
		var problemStr = '//upload.wikimedia';
		var regExp = new RegExp(problemStr, 'gi');
		wikiHTML = wikiHTML.replace(regExp, 'http://upload.wikimedia');

		/* Grab the data in the desired columns from the table on the Wiki page */
		var arrNames = tableColumnToArray(1, false);
		var arrImages = tableColumnToArray(2, true);
		var arrCoords = tableColumnToArray(3, false);
		var arrDescs = tableColumnToArray(7, false);

		/* Further extract and clean up that data */
		arrCoords = extractCoords(arrCoords);
		arrDescs = trimDescs(arrDescs);

		/* Create the Model with this parks data */
		var numParks = arrNames.length;
		localStorage.setItem('totalParks', numParks);
		for (var i = 0; i < numParks; i++) {
			var park = new Park(arrNames[i], arrImages[i], arrDescs[i], arrCoords[i], i);

			localStorage.setItem('park' + i, JSON.stringify(park));

			//Do this here so that a lot of unnecessary data isn't saved into localStorage:
			park.weatherTemp = ko.observable('');
			park.weatherIcon = ko.observable('');
			self.arrParks.push(park);

			//Used to actually save the weather data into localStorage without the extra KO stuff:
			var weather = new Weather();
			self.arrWeather.push(weather);
			localStorage.setItem('weather' + i, JSON.stringify(weather));
		}


		/*  function tableColumnToArray(colIndex, containsImages)
		 *
		 *  The data obtained from the wikipedia API is a massive, messy string of HTML.
		 *  This function grabs a column from the <table> in that string
		 *  and separates the data of each of its cells into an array.
		 *
		 *  Parameters:
		 *    colIndex starts at ONE, not ZERO
		 *    containsImages is a bool.  If true, it grabs the src attribute instead of text
		 *
		 *  Returns an array of the data from each cell
		 *
		 *  Help/Sources:
		 *  http://stackoverflow.com/questions/9551230/jquery-selectors-on-a-html-string
		 *  http://stackoverflow.com/questions/4336674/can-i-use-jquery-selectors-on-an-html-string-that-is-not-attached-to-the-dom
		 *  http://stackoverflow.com/questions/8375625/jquery-select-table-column
		*/

		function tableColumnToArray(colIndex, containsImages) {
			var column = $('tr td:nth-child(' + colIndex + ')', $(wikiHTML));
			var arr = [];

			if (containsImages) {
				column.each(function(index, cell) {
					var url = $('img', $(cell)).attr('src');
					if (!url) {
						url = '';
					}
					arr.push(url);
				});
			}
			else {
				column.each(function(index, cell) {
					arr.push($(cell).text());
				});
			}

			return arr;
		}

		/*  function extractCoords(array)
		 *
		 *  The coordinates obtained from the table are stuck in a messy string like:
		 *  'lots-of-text 38.33#; -86.23# (county)'
		 *  This function strips out the important numbers and splits them into separate
		 *  latitude and longitude values
		 *
		 *  Returns an array now filled with objects containing latitude and longitude
		*/

		function extractCoords(array) {
			array.forEach(function(string, index) {
				var parenIndex = string.search(/\(/);
				var semiColonIndex = string.search(/;/);

				var latitude = parseFloat(string.substr(semiColonIndex - 6, semiColonIndex));
				var longitude = parseFloat(string.substr(semiColonIndex + 1, parenIndex - 1));

				array[index] = {
					lat: latitude,
					lng: longitude
				};
			});

			return array;
		}

		/*  function trimDescs(array)
		 *
		 *  The descriptions obtained from the table contain a footnote reference at the end:
		 *  'description-text[24]'
		 *  This function strips out that [footnote]
		 *
		 *  Returns an array with just the text descriptions
		*/

		function trimDescs(array) {
			array.forEach(function(string, index) {
				var bracketIndex = string.search(/\[/);

				array[index] = string.substr(0, bracketIndex);
			});

			return array;
		}
	}

	self.getWeatherData = function(parkId) {
		var park = self.arrParks[parkId];
		var weather = self.arrWeather[parkId];

		if (weather.temp === '' || weather.timeStamp - Date.now() >= 3600000) {
			retrieveWeatherData();
		}

		function retrieveWeatherData() {
			//OpenWeatherMap appears to struggle finding cities with non-integer coordinates
			var lat = Math.round(park.coords.lat);
			var lng = Math.round(park.coords.lng);

			var weatherLink = 'http://api.openweathermap.org/data/2.5/weather?lat='
				+ lat + '&lon=' + lng + '&units=imperial&APPID='
				+ '0a305c0d2d66d7ed45c9edd57d68e80e';

				console.log(weatherLink);

			$.getJSON(weatherLink).done(function(data) {
				console.log('weather data: ');
				console.log(data);
				if (data.main !== undefined) {
					weather.temp = Math.round(data.main.temp);
					weather.icon = 'http://openweathermap.org/img/w/' + data.weather[0].icon
						+ '.png';
					weather.timeStamp = Date.now();
					
					localStorage.setItem('weather' + parkId, JSON.stringify(weather));

					//And load it into the park:
					park.weatherTemp(weather.temp);
					park.weatherIcon(weather.icon);
				}
				else {
					console.log('OpenWeatherMap unable to find that city based on coordinates');
				}
			})
			.fail(function(data) {
				console.log('Failed to get weather data');
				console.log(data);
			});
		}
	};
};

function ViewModel() {
	var self = this;

	self.parkList = ko.observableArray();
	self.currentPark = ko.observable();
	self.categorySearch = ko.observable();
	self.strSearch = ko.observable();

	self.thing = ko.observable('Come on');

	//vWeird:  why does this get called twice in the beginning?  (i guess when first parsed and then parsed after data?)
	  //**Didn't this seem slow to show up?)
	//this was helpful:  http://stackoverflow.com/questions/29557938/removing-map-pin-with-search
	self.filterParks = ko.computed(function() {
		var category = parseInt(self.categorySearch());
		var nameRegExp = new RegExp(self.strSearch(), 'i');

		return ko.utils.arrayFilter(self.parkList(), function(park) {
			var categoryMatch; 
			if (category === ALL) {
				categoryMatch = true;
			}
			else {
				categoryMatch = park.details === category;
			}

			var nameMatch = park.name.search(nameRegExp) >= 0;

			var display = categoryMatch && nameMatch;

			googleMapView.displayMarker(park.id, display);

			return display;
		});
	});

	self.wikiSourceStart = ko.pureComputed(function() {
		var wikiStart = '';

		switch (self.currentPark().details) {
			case model.BOTH:
				wikiStart = 'Photo and fact via ';
				break;
			case model.FACT:
				wikiStart = 'Fact via ';
				break;
			case model.PHOTO:
				wikiStart = 'Photo via ';
				break;
		}

		return wikiStart;
	});

	self.shouldDisplayLink = function() {
		return self.currentPark().details > NONE;
	};

	self.init = function() {
		self.parkList(model.arrParks);
		googleMapView.setUpMarkers(self.parkList());
		self.setCurrentPark(0);
		ko.applyBindings(viewModel);
	};

	self.setCurrentPark = function(parkId) {
		self.currentPark(self.parkList()[parkId]);
	};

	self.mimicMarkerClick = function(park) {
		googleMapView.clickMarker(park.id);
	};

	self.refreshWeatherData = function(parkId) {
		model.getWeatherData(parkId);
	};
}

function GoogleMapView() {
	var self = this;

	self.gMap = '';
	self.infoWindow = '';
	self.knockoutDiv = $('.knockout-infowindow')[0];
	self.holderDiv = $('.holder');
	self.arrMarkers = [];
	self.activeMarkerIndex = -1;  //could this somehow be linked to the currentPark?

	self.init = function() {
		initMap();
		initInfoWindow();
	}

	function initMap() {
		self.gMap = new google.maps.Map(document.getElementById('map'), {
			center: {lat: 39.768491, lng: -86.157679},		//center of Indiana
			zoom: 7											//zoom: less 0 -- 18 more
		});
	}

	function initInfoWindow() {
		self.infoWindow = new google.maps.InfoWindow();
		self.infoWindow.setContent(self.knockoutDiv);

		google.maps.event.addListener(self.infoWindow,'closeclick', self.closeInfoWindow);
	}

	self.closeInfoWindow = function() {
		self.arrMarkers[self.activeMarkerIndex].setAnimation(null);
		self.activeMarkerIndex = -1;
		self.holderDiv.append(self.knockoutDiv);
		self.infoWindow.close();
	}

	self.setUpMarkers = function(parkDataArray) {
		var len = parkDataArray.length;
		createMapMarkers();
		setupMarkerFeedback();

		function createMapMarkers() {
			for (var i = 0; i < len; i++) {
				var park = parkDataArray[i];

				var marker = new google.maps.Marker({
				    position: park.coords,
				    title: park.name,
				});
				marker.id = i;

				var icon = 'http://maps.google.com/mapfiles/ms/micons/red.png';  //none
				switch(park.details) {
					case BOTH:
						icon = 'http://maps.google.com/mapfiles/ms/micons/green-dot.png';  //both
						break;
					case FACT:
						icon = 'http://maps.google.com/mapfiles/kml/pal3/icon36.png';  //info
						break;
					case PHOTO:
						icon = 'http://maps.google.com/mapfiles/ms/micons/camera.png';  //pic
						break;
				}

				//via: http://stackoverflow.com/questions/7095574/google-maps-api-3-custom-marker-color-for-default-dot-marker
				marker.setIcon(icon);

				self.arrMarkers.push(marker);
			}
		}

		//adapted from:  https://developers.google.com/maps/documentation/javascript/markers
		function setupMarkerFeedback() {
			var len = self.arrMarkers.length;
			for (var i = 0; i < len; i++) {
				self.arrMarkers[i].addListener('click', function() {
					self.clickMarker(this.id);
				});
			}
		}
	};	

	self.clickMarker = function(id) {
		var marker = self.arrMarkers[id];

		if (marker.getAnimation()) {  //then you've clicked the same marker
			marker.setAnimation(null);
			self.closeInfoWindow();
			self.activeMarkerIndex = -1;
		}
		else {
			marker.setAnimation(google.maps.Animation.BOUNCE);
			viewModel.setCurrentPark(marker.id);
			viewModel.refreshWeatherData(marker.id);
			self.infoWindow.open(self.gMap, marker);
			if (self.activeMarkerIndex > -1) {  //a previous marker is still bouncing
				self.arrMarkers[self.activeMarkerIndex].setAnimation(null);
			}
			self.activeMarkerIndex = marker.id;
		}
	}

	self.displayMarker = function(id, display) {
		if (self.arrMarkers[id] !== undefined) {
			display ? self.arrMarkers[id].setMap(self.gMap) : self.arrMarkers[id].setMap(null);
		}
	}
}



/* http://stackoverflow.com/questions/15317796/knockout-loses-bindings-when-google-maps-api-v3-info-window-is-closed
   ^For explaining the oddities of Knockout with Google Map's infoWindow
*/