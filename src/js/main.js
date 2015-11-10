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
//really slows things down.  Hopefully it won't do that on github pages... (since it's http:)

// !!!! TODO:  Need to test what happens with no localStorage AND no internet/firewall blocks wiki.
  //jsonp doesn't work with .fail right?  So a .fail() after the .done() of getParksData won't
  //ever trigger?  Is that correct?
  // TODO:  Better error handling in general

// !!!! TODO:  add comments to some of the code functions

// !!!! TODO:  any fix for that graphical glitch where google maps shows the infoWindow but
   //then recenters and makes the screen flash?

var gMap;
var infoWindow;
var model;
var viewModel;
var activeMarkerIndex = -1;

//hmmm... is doc.ready even needed anymore?  Test that I guess
$(document).ready(function() {
	initMap(); //TODO:  I guess you could wrap this in a mapView or something
	model = new Model();  //Yes, keep all three of these separate
	viewModel = new ViewModel();
	if (localStorage.getItem('arrParks')) {  //but this could actually be a function of the viewModel
		model.loadParksData();
		viewModel.init();
	}
	else {
		model.getParksData().done(viewModel.init());
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

	function Park(name, img, desc, coords, id) {
		this.name = name;
		this.img = img;
		this.desc = desc;
		this.coords = coords;
		this.id = id;
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
	self.arrMarkers = [];

	self.init = function() {
		self.parkList(model.arrParks);
		createMapMarkers();
		placeMapMarkers();
		setupMarkerFeedback();
		ko.applyBindings(viewModel);
	};

	function createMapMarkers() {
		var len = self.parkList().length;
		for (var i = 0; i < len; i++) {
			var marker = new google.maps.Marker({
			    position: self.parkList()[i].coords,
			    title: self.parkList()[i].name
			});

			marker.id = i;

			self.arrMarkers.push(marker);
		}
	}

	function placeMapMarkers() {
		var len = self.arrMarkers.length;
		for (var i = 0; i < len; i++) {
			self.arrMarkers[i].setMap(gMap);
		}
	}

	//adapted from:  https://developers.google.com/maps/documentation/javascript/markers
	function setupMarkerFeedback() {
		var len = self.arrMarkers.length;
		for (var i = 0; i < len; i++) {
			self.arrMarkers[i].addListener('click', function() {
				if (this.getAnimation()) {  //then you've clicked the same marker
					this.setAnimation(null);
					infoWindow.close();
					activeMarkerIndex = -1;
				}
				else {
					this.setAnimation(google.maps.Animation.BOUNCE);
					infoWindow.setContent(getDataForInfoWindow(this.id));
					infoWindow.open(gMap, this);
					if (activeMarkerIndex > -1) {  //a previous marker is still bouncing
						self.arrMarkers[activeMarkerIndex].setAnimation(null);
					}
					activeMarkerIndex = this.id;
				}
			});
		}
	}

	// TODO:  change this to utilize Knockout.  (Well, actually, maybe this whole thing would
		//go inside the infoWindow creation.  You'll data-bind stuff in there and then clicking
		//will instead update the 'currentPark' or 'activePark' or whatever)

	function getDataForInfoWindow(index) {
		var title = '<h1 class="info-title"><a href="https://en.wikipedia.org/wiki/'
			+ self.parkList()[index].name + ' State Park" target="_blank">'
			+ self.parkList()[index].name + '</a></h1>';
		var img = self.parkList()[index].img ? '<div class="info"><img class="info-img" src="'
			+ self.parkList()[index].img + '"></div>' : '';
		var desc = self.parkList()[index].desc ? '<p>' + self.parkList()[index].desc + '</p>' : '';
		var wikiEnd = 'via <a href="https://en.wikipedia.org/wiki/'
			+ 'List_of_Indiana_state_parks" target="_blank">Wikipedia</a></p>';
		var attrWeather = '<p class="attribution">Weather data via OpenWeatherMap</p>';

		var wikiStart = '';
		if (img && desc) {
			wikiStart = '<p class="attribution">Photo and fact ';
		}
		else {
			if (img) {
				wikiStart = '<p class="attribution">Photo ';
			}
			else if (desc) {
				wikiStart = '<p class="attribution">Fact ';
			}
		}

		if (!wikiStart) {
			wikiEnd = '';
		}


		var HTML = title + img + desc + wikiStart + wikiEnd + attrWeather;

		return HTML;
	}

	self.mimicMarkerClick = function() {
		console.log("You clicked me.");
	}
}


function initMap() {
	gMap = new google.maps.Map(document.getElementById('map'), {
		center: {lat: 39.768491, lng: -86.157679},		//center of Indiana
		zoom: 7											//zoom: less 0 -- 18 more
	});

	infoWindow = new google.maps.InfoWindow();  //just one so that only one can be open at a time
	google.maps.event.addListener(infoWindow,'closeclick', function() {
		viewModel.arrMarkers[activeMarkerIndex].setAnimation(null);
		activeMarkerIndex = -1;
	});
}