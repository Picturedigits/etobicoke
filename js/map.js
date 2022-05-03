const etobicokeBounds = new maplibregl.LngLatBounds(
  [-79.650, 43.580],
  [-79.465, 43.765]
)

const maxBounds = [
  [-79.8, 43.45],
  [-79.3, 43.85]
]

const basemapStyle = 'https://api.maptiler.com/maps/pastel/style.json?key=fXc4knA6xdFWVhZVbmqa';
const mapInitCenter = [-79.55, 43.67];
const mapInitZoom = 10;

/* Min and max colors for choropleth, from colorbrewer2.org */
const fillColors = [
  '#efedf5',
  '#3f007d'
];

// Initialize both maps (left and right)
const mapL = new maplibregl.Map({
  container: 'map-l',
  style: basemapStyle,
  center: mapInitCenter,
  zoom: mapInitZoom,
  attributionControl: false,
  maxBounds: maxBounds
});


const mapR = new maplibregl.Map({
  container: 'map-r',
  style: basemapStyle,
  center: mapInitCenter,
  zoom: mapInitZoom,
  maxBounds: maxBounds
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
    const overlayDropdown = document.getElementById('overlay-dropdown' + mapSuffix);
    const overlayDropdownNice = NiceSelect.bind(overlayDropdown, {placeholder: 'Off'});

    // Generate a list of all census years from `metadata.js`
    Object.keys(metadata).forEach(function(year) {
      yearDropdown[yearDropdown.options.length] = new Option(year, year);
    });
    NiceSelect.bind(yearDropdown, { placeholder: yearDropdown[0].value} );

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
          'text-size': 11,
        },
        'paint': {
          'text-color': '#000000',
          'text-halo-color': 'rgba(255,255,255,0.8)',
          'text-halo-width': 2
        }
      });

      // Add overlays if exist
      if ( overlays[year] && overlays[year].length > 0 ) {

        for (var i in overlays[year]) {

          const overlay = overlays[year][i];

          // Add overlay source
          map.addSource(overlay.name, {
            'type': 'geojson',
            'data': overlay.data
          });

          // Add overlay boundaries
          map.addLayer({
            'id': overlay.name,
            'type': 'line',
            'source': overlay.name,
            'layout': {
              'visibility': 'none'
            },
            'paint': {
              'line-width': 2,
              'line-color': 'rgb(0, 0, 0)',
              'line-opacity': 0.6
            }
          });

          // Add overlay labels
          map.addLayer({
            'id': overlay.name + '-labels',
            'type': 'symbol',
            'source': overlay.name,
            'minzoom': 9,
            'layout': {
              'visibility': 'none',
              'text-field': ['get', 'name'],
              'text-size': 9,
            },
            'paint': {
              'text-color': 'rgba(0,0,0,1)',
              'text-halo-color': 'rgba(255,255,255,0.9)',
              'text-halo-width': 2,
              'text-opacity': 1
            }
          });

        }

      }

    });

    const varDropdownNice = NiceSelect.bind(varDropdown, {searchable: true});

    // On census year change, reload polygons & overlays
    yearDropdown.addEventListener('change', function() {

      // Hide all polygons & layers
      Object.keys(metadata).forEach(function(y) {
        map.setLayoutProperty(y, 'visibility', 'none');
        map.setLayoutProperty(y + '-labels', 'visibility', 'none');

        // Hide overlays
        if ( overlays[y] ) {
          overlays[y].forEach(function(overlay) {
            map.setLayoutProperty(overlay.name, 'visibility', 'none');
            map.setLayoutProperty(overlay.name + '-labels', 'visibility', 'none');
          });
        }
        
      });

      var year = yearDropdown.value;

      // Update list of variables for the particular census year
      varDropdown.options.length = 0;
      Object.keys(metadata[year]).forEach(function(v) {
        varDropdown[varDropdown.options.length] = new Option(v, v);
      });
      varDropdown[varDropdown.options.length] = new Option('Off', '');

      // Update list of overlays for the particular census year
      overlayDropdown.options.length = 0;
      if (overlays[year] && overlays[year].length > 0 ) {
        overlayDropdown.parentNode.style.display = 'block';

        overlayDropdown[0] = new Option('Off', '');
        Object.keys(overlays[year]).forEach(function(i) {
          let o = overlays[year][i];
          let l = overlayDropdown.options.length;
          overlayDropdown[l] = new Option(o.displayName, o.name);
        });
        overlayDropdownNice.update();
      } else {
        overlayDropdown.parentNode.style.display = 'none';
      }

      // Show choropleth & labels for the year
      map.setLayoutProperty(year, 'visibility', 'visible');
      map.setLayoutProperty(year + '-labels', 'visibility', 'visible');

      // By default, showing first variable
      varDropdown.selectedIndex = 0;
      varDropdownNice.placeholder = varDropdown[0].value;

      varDropdown.dispatchEvent(new Event('change'));
      varDropdownNice.update();
    });


    // On overlay change, add/remove boundaries
    overlayDropdown.addEventListener('change', function() {

      const overlayName = overlayDropdown.value;
      const year = yearDropdown.value;

      // Hide existing overlays from selected year
      if (overlays[year] && overlays[year].length > 0) {
        overlays[year].forEach(function(overlay) {
          map.setLayoutProperty(overlay.name, 'visibility', 'none');
          map.setLayoutProperty(overlay.name + '-labels', 'visibility', 'none');
        })
      }

      // Add new overlay
      if (overlayName !== '') {
        map.setLayoutProperty(overlayName, 'visibility', 'visible');
        map.setLayoutProperty(overlayName + '-labels', 'visibility', 'visible');
      }

    })


    // On variable change, update existing polygons with new color scheme and labels
    varDropdown.addEventListener('change', function() {

      const year = yearDropdown.value;
      const variable = varDropdown.value;

      if ( variable !== '' ) {

        // Update min/max, median, and # NA values
        document.getElementById('stats-minmax' + mapSuffix).innerHTML = 
          parseFloat(metadata[year][variable]['min']).toLocaleString()
          + ' &rarr; ' + parseFloat(metadata[year][variable]['max']).toLocaleString();

        document.getElementById('stats-median' + mapSuffix).innerHTML = '<i>Q<sub>2</sub></i> '
          + parseFloat(metadata[year][variable]['median']).toLocaleString();

        document.getElementById('stats-na' + mapSuffix).innerHTML = 
          ' &#8709; ' + metadata[year][variable]['na'];

      }


      // Update choropleth
      map.setPaintProperty(
        year,
        'fill-color',
        variable === '' ? 'rgba(0,0,0,0.3)' : [
          'case',
          ['!=', ['get', variable], null],
          [
            'interpolate',
            ['linear'],
            ['to-number', ['get', variable]],
            parseFloat(metadata[year][variable]['min']),
            ['to-color', fillColors[0]],
            parseFloat(metadata[year][variable]['max']),
            ['to-color', fillColors[1]]
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
            ['number-format', ['get', variable], {'locale': 'en-US'}],
            variable === '' ? '' : '—'
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
