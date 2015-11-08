
//Uncomment for map
var gMap;

function initMap() {
	gMap = new google.maps.Map(document.getElementById('map'), {
		center: {lat: 39.768491, lng: -86.157679},		//center of Indiana
		zoom: 7											//zoom: less 0 -- 18 more
	});
}


var parksData;
var arrMarkers = [];  //or should these markers be added as a property of the Park object?

$('#btn-create').on('click', createMapMarkers);
$('#btn-place').on('click', placeMapMarkers);

function createMapMarkers() {
	var len = parksData.length;
	for (var i = 0; i < len; i++) {
		var marker = new google.maps.Marker({
		    position: parksData[i].coords,
		    title: parksData[i].name
		});

		arrMarkers.push(marker);
	}
}

function placeMapMarkers() {
	var len = arrMarkers.length;
	for (var i = 0; i < len; i++) {
		arrMarkers[i].setMap(gMap);
	}

	animateMarkers();
}

//adapted from:  https://developers.google.com/maps/documentation/javascript/markers
function animateMarkers() {
	var len = arrMarkers.length;
	for (var i = 0; i < len; i++) {
		arrMarkers[i].addListener('click', function() {
			if (this.getAnimation()) {
				this.setAnimation(null);
			}
			else {
				this.setAnimation(google.maps.Animation.BOUNCE);
			}
		});
	}
}

$(document).ready(function() {
	parksData = JSON.parse(localStorage.getItem('arrParks'));
	initMap();
});

/*
$(document).ready(function() {
	//Link to a Wiki page containing a table that lists all of Indiana's State Parks (and their coordinates)
	var wikiLink = 'http://en.wikipedia.org/w/api.php?action=parse&section=1&prop=text&page=List_of_Indiana_state_parks&format=json&callback=?';

	
	//$.getJSON(wikiLink, wikiCallback);
	  //since^ I'm currently saving the data in localStorage, save on API calls.


	//test retrieval of parksData in localStorage
	parksData = JSON.parse(localStorage.getItem('arrParks'));

	console.log(parksData);  //cool.  now test putting the markers on the map?

});
*/

function wikiCallback(data) {
	if (data.parse.text) {  //Success!
		var wikiHTML = data.parse.text['*'];  //Grab the HTML
		localStorage.setItem('wikiHTML', wikiHTML);  // TODO: won't be saving this; instead will be saving the model data
	}
	else {  // TODO:  Better handling
		console.log("Error in getting Wiki data.");
	}	
}

var Park = function(name, img, desc, coords) {
	this.name = name;
	this.img = img;
	this.desc = desc;
	this.coords = coords;
};

var arrParks = [];


$('#btn').on('click', function() {

	var wikiHTML = localStorage.getItem('wikiHTML');

	/* Grab the data in the desired columns from the table on the Wiki page */
	var arrNames = tableColumnToArray(1, false);
	var arrImages = tableColumnToArray(2, true);
	var arrCoords = tableColumnToArray(3, false);
	var arrDescs = tableColumnToArray(7, false);

	/* Further extract and clean up that data */
	arrCoords = extractCoords(arrCoords);
	arrDescs = trimDescs(arrDescs);

	// TODO:  Turn this into model data.
	var numParks = arrNames.length;
	for (var i = 0; i < numParks; i++) {
		var park = new Park(arrNames[i], arrImages[i], arrDescs[i], arrCoords[i]);

		arrParks.push(park);
	}

	/*  Save this data into localStorage
	 *  Help/Sources:
	 *  http://stackoverflow.com/questions/3357553/how-to-store-an-array-in-localstorage
	*/

	//huh, is this a SUPER slow action?  [seems like it takes forever...]
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
});