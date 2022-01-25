const etobicokeBounds = new maplibregl.LngLatBounds(
  [-79.650, 43.580],
  [-79.465, 43.765]
)

const basemapStyle = 'https://api.maptiler.com/maps/pastel/style.json?key=fXc4knA6xdFWVhZVbmqa';
const mapInitCenter = [-79.55, 43.67];
const mapInitZoom = 10;

// Initialize both maps (left and right)
const mapL = new maplibregl.Map({
  container: 'map-l',
  style: basemapStyle,
  center: mapInitCenter,
  zoom: mapInitZoom,
  attributionControl: false,
});


const mapR = new maplibregl.Map({
  container: 'map-r',
  style: basemapStyle,
  center: mapInitCenter,
  zoom: mapInitZoom,
});

syncMaps(mapL, mapR);

// Both maps show the same data, but use different layer controls
[mapL, mapR].forEach(function(map) {

  map.on('load', function () {

    // Determine which map, left or right, we're working on
    const isLeftMap = map.getContainer().id === 'map-l';
    const mapSuffix = isLeftMap ? '-l' : '-r';

    // Determine the appropriate select elements in DOM
    const yearDropdown = document.getElementById('census-year-dropdown' + mapSuffix);
    const varDropdown = document.getElementById('census-variable-dropdown' + mapSuffix);
      
    // Generate a list of all census years from `metadata.js`
    Object.keys(metadata).forEach(function(year) {
      yearDropdown[yearDropdown.options.length] = new Option(year, year)
    });

    // Add individual geojson sources + layers for each census year
    Object.keys(metadata).forEach(function(year) {
      
      // Add source
      map.addSource(year, {
        'type': 'geojson',
        'data': './geojson/' + year + '.geojson',
        'attribution': '<a href="https://www.picturedigits.com">Picturedigits</a>'
      });

      // Add polygon layer
      map.addLayer({
        'id': year,
        'type': 'fill',
        'source': year,
        'layout': {
          'visibility': 'none'
        },
        'paint': {
          'fill-color': 'gray',
          'fill-opacity': 0.95,
          'fill-outline-color': 'white'
        }
      })

      // Add labels
      map.addLayer({
        'id': year + '-labels',
        'type': 'symbol',
        'source': year,
        'minzoom': 9,
        'layout': {
          'visibility': 'none',
          'text-field': '',
          'text-size': 10,
        },
        'paint': {
          'text-color': '#000000',
          'text-halo-color': 'rgba(255,255,255,0.5)',
          'text-halo-width': 2
        }
      });

    });


    // On census year change, reload polygons
    yearDropdown.addEventListener('change', function() {

      // Hide all polygons & layers
      Object.keys(metadata).forEach(function(y) {
        map.setLayoutProperty(y, 'visibility', 'none');
        map.setLayoutProperty(y + '-labels', 'visibility', 'none');
      });

      var year = yearDropdown.value;

      // Update list of variables for the particular census year
      varDropdown.options.length = 0;
      Object.keys(metadata[year]).forEach(function(v) {
        varDropdown[varDropdown.options.length] = new Option(v, v)
      });

      // Show choropleth & labels for the year
      map.setLayoutProperty(year, 'visibility', 'visible');
      map.setLayoutProperty(year + '-labels', 'visibility', 'visible');

      // By default, showing first variable
      varDropdown.selectedIndex = 0;
      varDropdown.dispatchEvent(new Event('change'));
    });


    // On variable change, update existing polygons with new color scheme and labels
    varDropdown.addEventListener('change', function() {

      const year = yearDropdown.value;
      const variable = varDropdown.value;

      // Update choropleth
      map.setPaintProperty(
        year,
        'fill-color',
        [
          'case',
          ['!=', ['get', variable], null],
          [
            'interpolate',
            ['linear'],
            ['to-number', ['get', variable]],
            parseFloat(metadata[year][variable]['min']),
            ['to-color', '#fcfbfd'],
            parseFloat(metadata[year][variable]['max']),
            ['to-color', '#3f007d']
          ],
          '#dddddd'
        ]
      );

      // Update labels
      map.setLayoutProperty(
        year + '-labels',
        'text-field',
        [
          'format',
          ['get', 'ct'],
          {
            'text-font': ['literal', ['DIN Offc Pro Italic', 'Arial Unicode MS Regular']],
            'font-scale': 0.9,
          },
          '\n',
          {},
          [
            'case',
            ['!=', ['get', variable], null],
            ['get', variable],
            '—'
          ],
          
          {
            'font-scale': 1.1
          }
        ]
      )

    });

    // Initialize both maps with 1951, first variable
    yearDropdown.dispatchEvent(new Event('change'));

    // Only fit Etobicoke bounds in one map (they're synced)
    if (isLeftMap) {
      mapL.fitBounds( etobicokeBounds, { padding: 10 } );
    }

  });

})