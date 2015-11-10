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

//That bug on a local machine is bad:  where it fires off 25 get requests to file://wiki-image-site
//really slows things down.  Hopefully it won't do that on github pages... (since it's http:)

// !!!! TODO:  Need to test what happens with no localStorage AND no internet/firewall blocks wiki.
  //jsonp doesn't work with .fail right?  So a .fail() after the .done() of getParksData won't
  //ever trigger?  Is that correct?

var gMap;
var arrParks = [];
var arrMarkers = [];  //or should these markers be added as a property of the Park object?
var activeMarkerIndex = -1;
var infoWindow;

$(document).ready(function() {
	//initMap();
	if (localStorage.getItem('arrParks')) {
		arrParks = JSON.parse(localStorage.getItem('arrParks'));
		//createMapMarkers();
		//placeMapMarkers();
		//setupMarkerFeedback();
		initViewModel();
	}
	else {
		getParksData().done(createMapMarkers, placeMapMarkers, setupMarkerFeedback,
			initViewModel);
	}
});


function initMap() {
	gMap = new google.maps.Map(document.getElementById('map'), {
		center: {lat: 39.768491, lng: -86.157679},		//center of Indiana
		zoom: 7											//zoom: less 0 -- 18 more
	});

	infoWindow = new google.maps.InfoWindow();  //just one so that only one can be open at a time
	google.maps.event.addListener(infoWindow,'closeclick', function() {
		arrMarkers[activeMarkerIndex].setAnimation(null);
		activeMarkerIndex = -1;
	});
}

function getParksData() {
	var wikiLink = 'http://en.wikipedia.org/w/api.php?action=parse&section=1&prop=text'
	+ '&page=List_of_Indiana_state_parks&format=json&callback=?';

	return $.getJSON(wikiLink, wikiCallback);
}

function wikiCallback(data) {
	if (data.parse.text) {
		parseData(data.parse.text['*']);
	}
	else {  // TODO:  Better handling
		console.log("Error in getting Wiki data.");
	}	
}

var Park = function(name, img, desc, coords, id) {
	this.name = name;
	this.img = img;
	this.desc = desc;
	this.coords = coords;
	this.id = id;
};

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

		arrParks.push(park);
	}

	/*  Save this data into localStorage
	 *  Help/Sources:
	 *  http://stackoverflow.com/questions/3357553/how-to-store-an-array-in-localstorage
	*/

	localStorage.setItem('arrParks', JSON.stringify(arrParks));


	/*  function tableColumnToArray(colIndex, containsImages)
	 *
	 *  The data obtained from the wikipedia API is a massive, messy string of HTML.
	 *  This function grabs a column from the table in that string
	 *  and separates the data of each of that column's cells into an array.
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


function createMapMarkers() {
	var len = arrParks.length;
	for (var i = 0; i < len; i++) {
		var marker = new google.maps.Marker({
		    position: arrParks[i].coords,
		    title: arrParks[i].name
		});

		marker.id = i;

		arrMarkers.push(marker);
	}
}

function placeMapMarkers() {
	var len = arrMarkers.length;
	for (var i = 0; i < len; i++) {
		arrMarkers[i].setMap(gMap);
	}
}

// TODO:  I feel like only one marker should animate at a time.  I suppose a solution
//is to give each marker an index/id.  When clicked, update the activeMarkerIndex.
//then, disable that 

//huh, could you use $(arrMarker[i]).trigger('click') for when a list-view item is clicked?
  //yeah and you can maybe use jQuery's .index() to grab the value needed for i
  //https://api.jquery.com/index/

  //well, I think you're at the spot where you need to do knockoutjs

//adapted from:  https://developers.google.com/maps/documentation/javascript/markers
function setupMarkerFeedback() {
	var len = arrMarkers.length;
	for (var i = 0; i < len; i++) {
		arrMarkers[i].addListener('click', function() {
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
					arrMarkers[activeMarkerIndex].setAnimation(null);
				}
				activeMarkerIndex = this.id;
			}
		});
	}
}

function getDataForInfoWindow(index) {
	var title = '<h1 class="info-title"><a href="https://en.wikipedia.org/wiki/'
		+ arrParks[index].name + ' State Park" target="_blank">' + arrParks[index].name
		+ '</a></h1>';
	var img = arrParks[index].img ? '<div class="info"><img class="info-img" src="'
		+ arrParks[index].img + '"></div>' : '';
	var desc = arrParks[index].desc ? '<p>' + arrParks[index].desc + '</p>' : '';
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

function ViewModel() {
	var self = this;

	self.parkList = ko.observableArray(arrParks);

	self.mimicMarkerClick = function() {
		console.log("You clicked me.");
	}
}

function initViewModel() {
	ko.applyBindings(new ViewModel());
}