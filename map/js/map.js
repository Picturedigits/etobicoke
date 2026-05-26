const etobicokeBounds = new maplibregl.LngLatBounds(
  [-79.650, 43.580],
  [-79.465, 43.765]
)

const maxBounds = [ [-81.0, 42.45], [-78.0, 44.85 ]];

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
    const showMetroCheckbox = document.getElementById('show-metro' + mapSuffix);
    const overlayDropdownNice = NiceSelect.bind(overlayDropdown, {placeholder: 'Off'});

    // Generate a list of all census years from `metadata.js`
    Object.keys(metadata).forEach(function(year) {
      yearDropdown[yearDropdown.options.length] = new Option(year, year);
    });
    NiceSelect.bind(yearDropdown, { placeholder: yearDropdown[0].value} );

    // Track which overlay sources/layers have been registered to avoid duplicates
    // across years that share the same overlay (async fetches make map.getLayer unreliable)
    const registeredOverlays = new Set();

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

          if (registeredOverlays.has(overlay.name)) continue;
          registeredOverlays.add(overlay.name);

          // Add overlay source
          map.addSource(overlay.name, {
            'type': 'geojson',
            'data': overlay.data
          });

          if (overlay.type === 'point') {

            // Load category icons then add symbol layer
            fetch(overlay.data)
              .then(function(r) { return r.json(); })
              .then(function(geojson) {
                const categories = [...new Set(
                  geojson.features.map(function(f) { return f.properties.category; }).filter(Boolean)
                )];
                return Promise.all(categories.map(function(cat) {
                  return new Promise(function(resolve) {
                    map.loadImage('./img/' + cat + '.png', function(err, image) {
                      if (!err && image && !map.hasImage(cat)) map.addImage(cat, image);
                      resolve();
                    });
                  });
                }));
              })
              .then(function() {
                map.addLayer({
                  'id': overlay.name,
                  'type': 'symbol',
                  'source': overlay.name,
                  'layout': {
                    'visibility': 'none',
                    'icon-image': ['get', 'category'],
                    'icon-size': 0.1875,
                    'icon-allow-overlap': true,
                    'text-field': ['get', 'name'],
                    'text-size': 9,
                    'text-offset': [0, 1.5],
                    'text-anchor': 'top',
                    'text-optional': true,
                  },
                  'paint': {
                    'text-color': 'rgba(0,0,0,1)',
                    'text-halo-color': 'rgba(255,255,255,0.9)',
                    'text-halo-width': 2,
                    'text-opacity': 1
                  }
                });

                // Dummy labels layer so visibility toggling works without changes elsewhere
                map.addLayer({
                  'id': overlay.name + '-labels',
                  'type': 'symbol',
                  'source': overlay.name,
                  'layout': { 'visibility': 'none' }
                });

                const tooltip = new maplibregl.Popup({ closeButton: false, closeOnClick: false });

                map.on('mouseenter', overlay.name, function(e) {
                  map.getCanvas().style.cursor = 'pointer';
                  const props = e.features[0].properties;
                  const html = '<b>' + props.name + '</b>'
                    + (props.text ? '<br>' + props.text : '');
                  tooltip.setLngLat(e.features[0].geometry.coordinates)
                    .setHTML(html)
                    .addTo(map);
                });

                map.on('mouseleave', overlay.name, function() {
                  map.getCanvas().style.cursor = '';
                  tooltip.remove();
                });
              });

          } else {

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
                'line-opacity': 0.9
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
            if (map.getLayer(overlay.name)) map.setLayoutProperty(overlay.name, 'visibility', 'none');
            if (map.getLayer(overlay.name + '-labels')) map.setLayoutProperty(overlay.name + '-labels', 'visibility', 'none');
          });
        }

      });

      // Hide metro stats
      document.getElementById('metro-stats-wrapper' + mapSuffix).classList.add('dn');

      var year = yearDropdown.value;

      // Update list of variables for the particular census year
      varDropdown.options.length = 0;
      Object.keys(metadata[year]).forEach(function(v) {
        varDropdown[varDropdown.options.length] = new Option(v, v);
      });
      varDropdown[varDropdown.options.length] = new Option('Off', '');

      // Update list of overlays for the particular census year, reset to Off
      overlayDropdown.options.length = 0;
      const newYearOverlays = overlays[year] || [];
      if (newYearOverlays.length > 0) {
        overlayDropdown.parentNode.style.display = 'block';
        overlayDropdown[0] = new Option('Off', '');
        Object.keys(newYearOverlays).forEach(function(i) {
          let o = newYearOverlays[i];
          let l = overlayDropdown.options.length;
          overlayDropdown[l] = new Option(o.displayName, o.name);
        });
      } else {
        overlayDropdown.parentNode.style.display = 'none';
      }
      overlayDropdown.selectedIndex = 0;
      overlayDropdownNice.update();

      // Hide point legend
      const legend = document.getElementById('overlay-legend' + mapSuffix);
      legend.innerHTML = '';
      legend.classList.add('dn');

      // Hide metro by default
      map.setFilter(year, ['==', 'is_metro', false]);
      map.setFilter(year + '-labels', ['==', 'is_metro', false]);
      showMetroCheckbox.checked = false;

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
      const legend = document.getElementById('overlay-legend' + mapSuffix);

      // Hide existing overlays from selected year
      if (overlays[year] && overlays[year].length > 0) {
        overlays[year].forEach(function(overlay) {
          if (map.getLayer(overlay.name)) map.setLayoutProperty(overlay.name, 'visibility', 'none');
          if (map.getLayer(overlay.name + '-labels')) map.setLayoutProperty(overlay.name + '-labels', 'visibility', 'none');
        })
      }

      // Add new overlay
      if (overlayName !== '') {
        if (map.getLayer(overlayName)) map.setLayoutProperty(overlayName, 'visibility', 'visible');
        if (map.getLayer(overlayName + '-labels')) map.setLayoutProperty(overlayName + '-labels', 'visibility', 'visible');
      }

      // Update legend
      const overlayConfig = overlays[year] && overlays[year].find(function(o) { return o.name === overlayName; });
      if (overlayConfig && overlayConfig.type === 'point') {
        fetch(overlayConfig.data)
          .then(function(r) { return r.json(); })
          .then(function(geojson) {
            const categories = [...new Set(
              geojson.features.map(function(f) { return f.properties.category; }).filter(Boolean)
            )].sort();
            legend.innerHTML = categories.map(function(cat) {
              const label = cat.replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
              return '<div class="flex items-center mb1">'
                + '<img src="./img/' + cat + '.png" style="width:18px;height:18px;flex-shrink:0;margin-right:6px;">'
                + '<span>' + label + '</span>'
                + '</div>';
            }).join('');
            legend.classList.remove('dn');
          });
      } else {
        legend.innerHTML = '';
        legend.classList.add('dn');
      }

    })


    // On variable change, update existing polygons with new color scheme and labels
    varDropdown.addEventListener('change', function() {

      const year = yearDropdown.value;
      const variable = varDropdown.value;

      if ( variable !== '' ) {

        // Etobicoke
        let min = parseFloat(metadata[year][variable]['min'])
        let max = parseFloat(metadata[year][variable]['max'])
        let med = parseFloat(metadata[year][variable]['median'])
        let na = parseFloat(metadata[year][variable]['na'])

        // Update min/max, median, and # NA values - Etobicoke
        document.getElementById('stats-minmax' + mapSuffix).innerHTML = 
          (min === min ? min : '-').toLocaleString()
            + ' &rarr; ' + (max === max ? max : '-').toLocaleString();

        document.getElementById('stats-median' + mapSuffix).innerHTML = '<i>Q<sub>2</sub></i> '
          + (med === med ? med : '-').toLocaleString();

        document.getElementById('stats-na' + mapSuffix).innerHTML = 
          ' &#8709; ' + (na === na ? na : '-' );

        // Metro
        let min_ = parseFloat(metadata[year][variable]['min_metro'])
        let max_ = parseFloat(metadata[year][variable]['max_metro'])
        let med_ = parseFloat(metadata[year][variable]['median_metro'])
        let na_ = parseFloat(metadata[year][variable]['na_metro'])

        // Update min/max, median, and # NA values - metro
        document.getElementById('stats-metro-minmax' + mapSuffix).innerHTML = 
          (min_ === min_ ? min_ : '-').toLocaleString()
            + ' &rarr; ' + (max_ === max_ ? max_ : '-').toLocaleString();

        document.getElementById('stats-metro-median' + mapSuffix).innerHTML = '<i>Q<sub>2</sub></i> '
          + (med_ === med_ ? med_ : '-').toLocaleString();

        document.getElementById('stats-metro-na' + mapSuffix).innerHTML = 
          ' &#8709; ' + (na_ === na_ ? na_ : '-' );

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
            parseFloat(metadata[year][variable]['min_choro']),
            ['to-color', fillColors[0]],
            parseFloat(metadata[year][variable]['max_choro']),
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

    // Toggle metro visibility
    showMetroCheckbox.addEventListener('change', function(e) {

      let year = yearDropdown.value;

      if (!e.target.checked) {
        map.setFilter(year, ['==', 'is_metro', e.target.checked]);
        map.setFilter(year + '-labels', ['==', 'is_metro', e.target.checked]);

        document.getElementById('metro-stats-wrapper' + mapSuffix).classList.add('dn');
      }
      else {
        map.setFilter(year, null);
        map.setFilter(year + '-labels', null);

        document.getElementById('metro-stats-wrapper' + mapSuffix).classList.remove('dn');
      }

    });


    // Initialize both maps with 1951, first variable
    yearDropdown.dispatchEvent(new Event('change'));

    // Only fit Etobicoke bounds in one map (they're synced)
    if (isLeftMap) {
      mapL.fitBounds( etobicokeBounds, { padding: 10 } );
    }

  });

})
