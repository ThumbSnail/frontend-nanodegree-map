/* Globals */
var model;
var viewModel;
var googleMapView;

/* Constants */
var ALL = -1;
var NONE = 0;
var PHOTO = 1;
var FACT = 2;
var BOTH = 3;

$(document).ready(function() {
	if (typeof google === 'undefined') {
		console.log('Unable to access Google Maps API.');
		alert('Unable to access Google Maps API.  Please check your internet connection'
			+ ' and/or firewall.');
	}
	else {
		googleMapView = new GoogleMapView();
		googleMapView.init();
		model = new Model();
		viewModel = new ViewModel();
		viewModel.buildModel();
	}
});

var Model = function() {
	var self = this;

	self.arrParks = [];
	self.arrWeather = [];

	/*  function loadParksData
	 *
	 *  Loads any saved park and weather data from localStorage
	*/

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

	/*  function wikiCallback
	 *
	 *  Determines what to do with the Wikipedia data.  Handles error if unobtainable
	*/

	function wikiCallback(data) {
		if (data.parse.text) {
			parseData(data.parse.text['*']);
		}
		else {
			console.log('Error in getting Wiki data.');
			alert('Unable to obtain State Parks data from Wikipedia.');
		}	
	}

	/*
	 *  Class park is used for storing individual park data
	 *
	 *  The parameter coords takes an object like {lat: 33, lng: 80}
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
		 * greatly slowed down the loading on my pc as it searched for all of these files.
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

			//Add these properties here so that unnecessary data isn't saved into localStorage
			park.weatherTemp = ko.observable('');
			park.weatherIcon = ko.observable('');
			self.arrParks.push(park);

			//Keep the storage of weather data separate
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

	/*
	 *  Weather is the class used for storing weather data into localStorage
	*/

	function Weather() {
		this.temp = '';
		this.icon = '';
		this.timeStamp = '';
	}

	/*  function getWeatherData
	 *
	 *  If the model does not have any weather data for the selected park, it issues a
	 *  GET request to OpenWeatherMap.org.  The model uses this data for at least an hour
	 *  to comply with OpenWeatherMap's desire to limit requests.  Beyond an hour, it will
	 *  fetch updated information.
	*/

	self.getWeatherData = function(parkId) {
		var park = self.arrParks[parkId];
		var weather = self.arrWeather[parkId];

		if (weather.temp === '' || weather.timeStamp - Date.now() >= 3600000) {
			retrieveWeatherData();
		}

		/*  function retrieveWeatherData
		 *
		 *  Makes the actual GET request.  Saves and loads the data into the Park objects
		 *  if successful.  Handles errors otherwise.
		*/

		function retrieveWeatherData() {
			//OpenWeatherMap struggles finding cities with non-integer coordinates:
			var lat = Math.round(park.coords.lat);
			var lng = Math.round(park.coords.lng);

			var weatherLink = 'http://api.openweathermap.org/data/2.5/weather?lat='
				+ lat + '&lon=' + lng + '&units=imperial&APPID='
				+ '0a305c0d2d66d7ed45c9edd57d68e80e';

			$.getJSON(weatherLink).done(function(data) {
				if (data.main !== undefined) {
					weather.temp = Math.round(data.main.temp);
					weather.icon = 'http://openweathermap.org/img/w/' + data.weather[0].icon
						+ '.png';
					weather.timeStamp = Date.now();
					
					localStorage.setItem('weather' + parkId, JSON.stringify(weather));

					park.weatherTemp(weather.temp);
					park.weatherIcon(weather.icon);
				}
				else {
					console.log('OpenWeatherMap unable to find that city based on coordinates.');
				}
			})
			.fail(function(data) {
				console.log('Failed to get weather data from OpenWeatherMap:');
				console.log(data);
			});
		}
	};
};

function ViewModel() {
	var self = this;

	self.parkList = ko.observableArray();
	self.currentPark = ko.observable();
	self.isListViewActive = ko.observable(false);
	self.categorySearch = ko.observable(0);
	self.strSearch = ko.observable('');
	self.isDoneLoading = ko.observable(false);

	self.emptyPark = {
		name: '',
		img: '',
		desc: '',
		coords: {
			lat: '',
			lng: ''
		},
		id: -1,
		details: -1,
		weatherTemp: ko.observable(''),
		weatherIcon: ko.observable('')
	};

	/*  function buildModel
	 *
	 *  Tells the model to either load parks data from local storage or fetch it from
	 *  Wikipedia.  Then proceeds with initialization.
	*/

	self.buildModel = function() {
		if (localStorage.getItem('totalParks')) {
			model.loadParksData();
			self.init(true);
		}
		else {
			model.getParksData().done(function() {
				self.init(false);
			});
		}
	};

	/*  function toggleListView
	 *
	 *  On smaller devices, the List View is a slide-in/out menu.  When the menu button is
	 *  pressed, this handles toggling it.
	*/

	self.toggleListView = function() {
		self.isListViewActive(!self.isListViewActive());
	};

	/*  function filterParks
	 *
	 *  Filters the list of parks in the List View (as well as the markers on the map) based
	 *  on the selected Details category (dropdown field) and the string in the search field.
	 *
	 *  Help/Sources:
	 *  http://stackoverflow.com/questions/29557938/removing-map-pin-with-search
	*/

	self.filterParks = ko.computed(function() {
		var category = parseInt(self.categorySearch());
		var nameRegExp = new RegExp(self.strSearch(), 'i');

		/*  In order to correctly load the saved state of the application's last use, prevent
		 *  Knockout from overwriting localStorage too early!
		*/
		if (self.isDoneLoading()) {
			localStorage.setItem('currentCategory', category);
			localStorage.setItem('currentSearch', self.strSearch());
		}

		/*  If the park's name AND details category match the user input, include the park
		 *  in the list.
		*/
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

			/*  This handles the case where the infoWindow is open and then the user inputs
			 *  a value that filters out the park/marker attached to this infoWindow, thereby
			 *  causing the bindings to be lost because the infoWindow was not closed with a
			 *  closeclick.
			*/
			if (self.isDoneLoading() && self.getCurrentParkId() === park.id && !display) {
				googleMapView.closeInfoWindow();
			}

			googleMapView.displayMarker(park.id, display);

			if (self.getCurrentParkId() === park.id && display) {
				googleMapView.resumeMarkerBounce();
			}

			return display;
		});
	});

	/*  function wikiSourceStart
	 *
	 *  When attribution the parks data to Wikipedia, selects the phrase that reflects the
	 *  amount of detail provided by the Wikipedia link.
	*/

	self.wikiSourceStart = ko.pureComputed(function() {
		var wikiStart = '';

		switch (self.currentPark().details) {
			case BOTH:
				wikiStart = 'Photo and fact via ';
				break;
			case FACT:
				wikiStart = 'Fact via ';
				break;
			case PHOTO:
				wikiStart = 'Photo via ';
				break;
		}

		return wikiStart;
	});

	/*  function shouldDisplayLink
	 *
	 *  Credits Wikipedia provided that it actually gave useful data.
	*/

	self.shouldDisplayLink = function() {
		return self.currentPark().details > NONE;
	};

	/*  function init
	 *
	 *  After all the parks data has been loaded or retrieved, the ViewModel takes this data
	 *  and sets up all the views by connecting the parks to the listView and to the markers
	 *  on the Google map.
	 *
	 *  isLoadingFromStorage is a bool that determines whether or not to load the last saved
	 *  state of the application.  If true, it recreates the last state of the application by
	 *  filling in the saved user input and, if a park was selected, 'clicking' the related
	 *  marker to animate it and open the attached infoWindow.
	*/

	self.init = function(isLoadingFromStorage) {
		self.parkList(model.arrParks);
		googleMapView.setUpMarkers(self.parkList());
		self.currentPark(self.emptyPark);
		ko.applyBindings(viewModel);

		if (isLoadingFromStorage) {
			self.categorySearch(localStorage.getItem('currentCategory'));
			self.strSearch(localStorage.getItem('currentSearch'));
			var storageId = localStorage.getItem('currentParkId');
			if ( storageId > -1) {
				self.mimicMarkerClick(self.parkList()[storageId]);
			}
		}
		self.isDoneLoading(true);
	};

	/*  function setCurrentPark
	 *
	 *  Selects (and saves) the chosen park based on the provided Id number
	 *
	 *  When the parameter parkId is -1, an empty/blank park is selected.
	*/

	self.setCurrentPark = function(parkId) {
		if (parkId < 0) {
			self.currentPark(self.emptyPark);
		}
		else {
			self.currentPark(self.parkList()[parkId]);
		}

		localStorage.setItem('currentParkId', parkId);
	};

	/*  function getCurrentParkId
	 *
	 *  Returns the Id attached to the currently selected park
	*/

	self.getCurrentParkId = function() {
		if (self.currentPark() === undefined) {
			return -1;
		}
		return self.currentPark().id;
	};

	/*  function mimicMarkerClick
	 *
	 *  Clicking on a park in the listView is equivalent to clicking a marker on the map
	*/

	self.mimicMarkerClick = function(park) {
		googleMapView.clickMarker(park.id);
	};

	/*  function refreshWeatherData
	 *
	 *  Tells the model to grab (possibly updated) weather data for the chosen park
	*/

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

	/*  function init
	 *
	 *  Initializes the Google Map and the single infoWindow
	*/

	self.init = function() {
		initMap();
		initInfoWindow();
	};

	/*  function initMap
	 *
	 *  Creates a Google Map centered over Indiana
	*/

	function initMap() {
		self.gMap = new google.maps.Map(document.getElementById('map'), {
			center: {lat: 39.768491, lng: -86.157679},		//center of Indiana
			zoom: 7											//zoom: less 0 -- 18 more
		});
	}

	/*  initInfoWindow
	 *
	 *  Creates the infoWindow, sets its content to the div containing the knockout data-binds,
	 *  and tells it how to handle close events.
	*/

	function initInfoWindow() {
		self.infoWindow = new google.maps.InfoWindow();
		self.infoWindow.setContent(self.knockoutDiv);

		google.maps.event.addListener(self.infoWindow,'closeclick', self.closeInfoWindow);
	}

	/*  function closeInfoWindow
	 *
	 *  Closes an open infoWindow.  This act would typical causes Knockout to loses its 
	 *  bindings since the infoWindow would destroy its DOM element upon being closed.  To
	 *  work around this, the DOM element currently attached to the infoWindow is placed back
	 *  into a hidden div in index.html.  Knockout is now continually happy.
	 *
	 *  Help/Sources:
	 *  http://stackoverflow.com/questions/15317796/knockout-loses-bindings-when-google
	 *  -maps-api-v3-info-window-is-closed
	*/

	self.closeInfoWindow = function() {
		self.arrMarkers[viewModel.getCurrentParkId()].setAnimation(null);
		self.holderDiv.append(self.knockoutDiv);
		self.infoWindow.close();
		viewModel.setCurrentPark(-1);
	};

	/*  function setUpMarkers
	 *
	 *  Creates all the markers based on the passed in parks array and also tells them how
	 *  to handle clicks.
	*/

	self.setUpMarkers = function(parkDataArray) {
		var len = parkDataArray.length;
		createMapMarkers();
		setupMarkerFeedback();

		/*  function createMapMarkers
		 *
		 *  Creates a map marker for each park.  It also chooses an image for the marker based
		 *  on the amount of details (photo, fact, both, none) available for the park.
		 *
		 *  Help/sources:
		 *  http://stackoverflow.com/questions/7095574/google-maps-api-3-custom-marker-color-for-default-dot-marker
		*/

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
						icon = 'http://maps.google.com/mapfiles/ms/micons/green-dot.png';
						break;
					case FACT:
						icon = 'http://maps.google.com/mapfiles/kml/pal3/icon36.png';
						break;
					case PHOTO:
						icon = 'http://maps.google.com/mapfiles/ms/micons/camera.png';
						break;
				}

				marker.setIcon(icon);

				self.arrMarkers.push(marker);
			}
		}

		/*  function setupMarkerFeedback
		 *
		 *  Tells the markers how to handle clicks.
		*/

		function setupMarkerFeedback() {
			var len = self.arrMarkers.length;
			for (var i = 0; i < len; i++) {
				self.arrMarkers[i].addListener('click', function() {
					self.clickMarker(this.id);
				});
			}
		}
	};

	/*  function clickMarker
	 *
	 *  Toggles marker animation.  Opens/closes the connected infoWindow.  Updates the
	 *  connected park.
	*/

	self.clickMarker = function(id) {
		var marker = self.arrMarkers[id];

		if (marker.getAnimation()) {  //then you've clicked the same marker
			marker.setAnimation(null);
			self.closeInfoWindow();
		}
		else {
			/* Handle the old, bouncing marker, if any */
			var currentParkId = viewModel.getCurrentParkId();
			if (currentParkId > -1) {
				self.arrMarkers[currentParkId].setAnimation(null);
			}
			/* Handle the new marker and thus the newly selected park */
			marker.setAnimation(google.maps.Animation.BOUNCE);
			viewModel.setCurrentPark(marker.id);
			viewModel.refreshWeatherData(marker.id);
			
			self.infoWindow.open(self.gMap, marker);
		}
	};

	/*  function displayMarker
	 *
	 *  Hides or shows a marker.  Used by the viewModel when it filters the list of parks.
	 *
	 *  Takes the id of the park/marker and a bool to display it or not.
	*/

	self.displayMarker = function(id, display) {
		if (self.arrMarkers[id] !== undefined) {
			display ? self.arrMarkers[id].setMap(self.gMap) : self.arrMarkers[id].setMap(null);
		}
	};

	/*  function resumeMarkerBounce
	 *
	 *  The filter function in the viewModel can kill the animation on an active marker.
	 *  This resumes the animation to give the user consistent feedback.
	*/

	self.resumeMarkerBounce = function() {
		self.arrMarkers[viewModel.getCurrentParkId()].setAnimation(google.maps.Animation.BOUNCE);
	};
}
