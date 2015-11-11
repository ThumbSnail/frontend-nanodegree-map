//Order of all this stuff...
/*
 -basic map can fire right away  (can stick the initMap as a callback on the google script)
 -wiki / localStorage data grab == can fire right away

 -**creating the map markers == google script must be loaded AND wiki/localStorage must be done
  -then place the map markers / create the infoWindow
   --^Really, the list shouldn't be clickable until the map markers are created (AND placed)

 -calls to weather data upon click.


//interesting, has you create deferreds:
http://stackoverflow.com/questions/15594567/how-to-use-jquery-when-done
*/

//  !!!! TODO:  That bug on a local machine is bad:  where it fires off 25 get requests to file://wiki-image-site
//really slows things down.  (or is it when it tries to save to local storage?)  Hopefully it won't do that on github pages... (since it's http:)
	//^Wow, no slowdown on mac.  What's up with my pc?  ....so, is this even an issue?

// !!!! TODO:  Need to test what happens with no localStorage AND no internet/firewall blocks wiki.
  //jsonp doesn't work with .fail right?  So a .fail() after the .done() of getParksData won't
  //ever trigger?  Is that correct?
  // TODO:  Better error handling in general

// !!!! TODO:  add comments to some of the code functions

// !!!! TODO:  any fix for that graphical glitch where google maps shows the infoWindow but
   //then recenters and makes the screen flash?

var model;
var viewModel;
var mapView;


//hmmm... is doc.ready even needed anymore?  Test that I guess
$(document).ready(function() {
	mapView = new MapView();
	mapView.init();
	model = new Model();  //Yes, keep all three of these separate
	viewModel = new ViewModel();
	if (localStorage.getItem('arrParks')) {  //?but this could actually be a function of the viewModel
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

	self.loadParksData = function() {
		self.arrParks = JSON.parse(localStorage.getItem('arrParks'));
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

	self.NONE = 0;
	self.PHOTO = 1;
	self.FACT = 2;
	self.BOTH = 3;

	function Park(name, img, desc, coords, id) {
		this.name = name;
		this.img = img;
		this.desc = desc;
		this.coords = coords;
		this.id = id;
		this.details = self.NONE;

		if (img !== '' && desc !== '') {
			this.details = self.BOTH;
		}
		else {
			if (desc !== '') {
				this.details = self.FACT;
			}
			else if (img !== '') {
				this.details = self.PHOTO;
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
		for (var i = 0; i < numParks; i++) {
			var park = new Park(arrNames[i], arrImages[i], arrDescs[i], arrCoords[i], i);

			self.arrParks.push(park);
		}

		/*  Save this data into localStorage
		 *  Help/Sources:
		 *  http://stackoverflow.com/questions/3357553/how-to-store-an-array-in-localstorage
		*/

		localStorage.setItem('arrParks', JSON.stringify(self.arrParks));


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
					if (url) {
						url = 'http:' + url;
					}
					else {
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
};

function ViewModel() {
	var self = this;

	self.parkList = ko.observableArray();
	self.currentPark = ko.observable();
	self.arrMarkers = [];
	self.activeMarkerIndex = -1;

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
		return self.currentPark().details > model.NONE;
	};

	self.init = function() {
		self.parkList(model.arrParks);
		createMapMarkers();
		placeMapMarkers();
		setupMarkerFeedback();
		self.setCurrentPark(self.parkList()[0]);
		ko.applyBindings(viewModel);
	};

	function createMapMarkers() {
		var len = self.parkList().length;

		for (var i = 0; i < len; i++) {
			var park = self.parkList()[i];

			var marker = new google.maps.Marker({
			    position: park.coords,
			    title: park.name,
			});
			marker.id = i;

			//TODO:  marker.detailLevel = details;  //probably not needed anymore

			var icon = 'http://maps.google.com/mapfiles/ms/micons/red.png';  //none
			switch(park.details) {
				case model.BOTH:
					icon = 'http://maps.google.com/mapfiles/ms/micons/green-dot.png';  //both
					break;
				case model.FACT:
					icon = 'http://maps.google.com/mapfiles/kml/pal3/icon36.png';  //info
					break;
				case model.PHOTO:
					icon = 'http://maps.google.com/mapfiles/ms/micons/camera.png';  //pic
					break;
			}

			//via: http://stackoverflow.com/questions/7095574/google-maps-api-3-custom-marker-color-for-default-dot-marker
			marker.setIcon(icon);

			self.arrMarkers.push(marker);
		}
	}

	function placeMapMarkers() {
		var len = self.arrMarkers.length;
		for (var i = 0; i < len; i++) {
			self.arrMarkers[i].setMap(mapView.gMap);
		}
	}

	//adapted from:  https://developers.google.com/maps/documentation/javascript/markers
	function setupMarkerFeedback() {
		var len = self.arrMarkers.length;
		for (var i = 0; i < len; i++) {
			self.arrMarkers[i].addListener('click', function() {
				clickMarker(this.id);
			});
		}
	}

	function clickMarker(id) {
		var marker = self.arrMarkers[id];

		if (marker.getAnimation()) {  //then you've clicked the same marker
			marker.setAnimation(null);
			mapView.closeInfoWindow();
			self.activeMarkerIndex = -1;
		}
		else {
			marker.setAnimation(google.maps.Animation.BOUNCE);
			self.setCurrentPark(self.parkList()[marker.id]);
			mapView.infoWindow.open(mapView.gMap, marker);
			if (self.activeMarkerIndex > -1) {  //a previous marker is still bouncing
				self.arrMarkers[self.activeMarkerIndex].setAnimation(null);
			}
			self.activeMarkerIndex = marker.id;
		}
	}

	self.setCurrentPark = function(park) {
		self.currentPark(park);
	};

	self.mimicMarkerClick = function(park) {
		clickMarker(park.id);
	};
}

function MapView() {
	var self = this;

	self.gMap = '';
	self.infoWindow = '';
	self.knockoutDiv = $('.knockout-infowindow')[0];

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
		viewModel.arrMarkers[viewModel.activeMarkerIndex].setAnimation(null);
		viewModel.activeMarkerIndex = -1;
		$('.hidden').append(self.knockoutDiv);
		self.infoWindow.close();
	}
}



/* http://stackoverflow.com/questions/15317796/knockout-loses-bindings-when-google-maps-api-v3-info-window-is-closed
   ^For explaining the oddities of Knockout with Google Map's infoWindow
*/