/**
 * Project: Multi-Decadal Urban Heat Island (UHI) & Surface Warming Pipeline
 * Platform: Google Earth Engine (JavaScript API)
 * Study Area: Visakhapatnam Urban Corridor (GVMC)
 */

// 1. Study Area: Clean Bounding Box (Urban Corridor)
var vizag = ee.Geometry.BBox(83.10, 17.60, 83.42, 17.85);
Map.centerObject(vizag, 12);
Map.setOptions('HYBRID');

var startDate = '2014-01-01';
var endDate = '2026-06-30';

// 2. Cloud Masking (QA_PIXEL)
function maskLandsatSR(image) {
  var qa = image.select('QA_PIXEL');
  var mask = qa.bitwiseAnd(1 << 1).eq(0)  // Dilated Cloud
    .and(qa.bitwiseAnd(1 << 2).eq(0))     // Cirrus
    .and(qa.bitwiseAnd(1 << 3).eq(0))     // Cloud
    .and(qa.bitwiseAnd(1 << 4).eq(0));    // Cloud Shadow
  return image.updateMask(mask);
}

// 3. Emissivity-Corrected LST Function
function calculateLST(image) {
  var optical = image.select(['SR_B4', 'SR_B5']).multiply(0.0000275).add(-0.2);
  var red = optical.select('SR_B4');
  var nir = optical.select('SR_B5');

  var ndvi = nir.subtract(red).divide(nir.add(red)).rename('NDVI');
  var pv = ndvi.subtract(0.15).divide(0.85 - 0.15).clamp(0, 1).pow(2).rename('Pv');
  var emissivity = pv.multiply(0.004).add(0.986).rename('Emissivity');

  var btKelvin = image.select('ST_B10').multiply(0.00341802).add(149.0);
  var lst = btKelvin.divide(
    btKelvin.multiply(10.895).divide(14380).multiply(emissivity.log()).add(1)
  ).subtract(273.15).rename('LST');

  var timeYears = ee.Date(image.get('system:time_start')).difference(ee.Date(startDate), 'year');
  var timeBand = ee.Image.constant(timeYears).rename('time').toFloat();

  // Water Mask: Removes Bay of Bengal using surface water reflection
  var landMask = ndvi.gt(0.02);

  return image.addBands([lst.updateMask(landMask), ndvi, timeBand]);
}

// 4. Ingest Collections (Peak Summer: March to June)
var l8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
  .filterBounds(vizag).filterDate(startDate, endDate)
  .filter(ee.Filter.calendarRange(3, 6, 'month')).map(maskLandsatSR);

var l9 = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2')
  .filterBounds(vizag).filterDate(startDate, endDate)
  .filter(ee.Filter.calendarRange(3, 6, 'month')).map(maskLandsatSR);

var landsatCollection = l8.merge(l9).map(calculateLST).select(['time', 'LST']);

// 5. Recent LST Median (2022-2026)
var recentLST = landsatCollection.filterDate('2022-01-01', '2026-06-30')
  .select('LST').median().clip(vizag);

// 6. Linear Trend Regression (Rate of Warming °C/year)
var trend = landsatCollection.reduce(ee.Reducer.linearFit()).clip(vizag);
var warmingRate = trend.select('scale').rename('Warming_Rate');

// 7. Visualizations
var lstPalette = ['#313695', '#4575b4', '#74add1', '#ffffbf', '#fee090', '#fdae61', '#f46d43', '#d73027'];
Map.addLayer(recentLST, {min: 28, max: 45, palette: lstPalette}, 'Recent LST (2022-2026) [°C]', true);
Map.addLayer(warmingRate, {min: -0.05, max: 0.25, palette: ['#2c7bb6', '#ffffbf', '#d7191c']}, 'Warming Rate (°C/yr)', false);

// 8. On-Screen Floating Legend
var legend = ui.Panel({style: {position: 'bottom-left', padding: '8px 15px'}});
legend.add(ui.Label({value: 'LST (°C)', style: {fontWeight: 'bold', fontSize: '14px', margin: '0 0 6px 0'}}));

var makeRow = function(color, name) {
  var colorBox = ui.Label({style: {backgroundColor: color, padding: '8px', margin: '0 6px 4px 0'}});
  var desc = ui.Label({value: name, style: {margin: '0'}});
  return ui.Panel({widgets: [colorBox, desc], layout: ui.Panel.Layout.Flow('horizontal')});
};

legend.add(makeRow('#d73027', '> 42 °C (Extreme Heat / Industrial)'));
legend.add(makeRow('#fdae61', '36 - 42 °C (Built-up / Urban Core)'));
legend.add(makeRow('#ffffbf', '32 - 36 °C (Suburban / Open Soil)'));
legend.add(makeRow('#4575b4', '< 32 °C (Vegetation / Hill Shading)'));
Map.add(legend);

// 9. Time-Series Chart Focused on Urban Core
var urbanCore = ee.Geometry.Point([83.22, 17.71]).buffer(3000); // Gajuwaka / Industrial belt
var chart = ui.Chart.image.series({
  imageCollection: landsatCollection.select('LST'),
  region: urbanCore,
  reducer: ee.Reducer.mean(),
  scale: 100,
  xProperty: 'system:time_start'
}).setOptions({
  title: 'Urban Core Summer LST Dynamics (Industrial Belt)',
  hAxis: {title: 'Year', format: 'yyyy', gridlines: {count: 7}},
  vAxis: {title: 'LST (°C)'},
  lineWidth: 2,
  pointSize: 4,
  colors: ['#d73027'],
  interpolateNulls: true
});

print(chart);
