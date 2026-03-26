// cvegeo_cvnl = Entidad(2) + Municipio(3) + Localidad(4) + AGEB(4) + Manzana(3) = 16 dígitos
var respondentsWithKeys = geodata_v2_raw.map(function(f) {
  var cvegeo = ee.String(f.get('cvegeo_cvnl'));
  return f
    .set('ageb_key', cvegeo.slice(0, 13))
    .set('mza_key',  cvegeo.slice(0, 16));
});

// ══════════════════════════════════════════════
// ── AGEB
// ══════════════════════════════════════════════

var ageb = ageb_raw;

// frequencyHistogram hace el conteo en una sola operación vectorizada (mismo patrón que manzanas)
var agebCounts = ee.Dictionary(
  respondentsWithKeys.reduceColumns({
    selectors: ['ageb_key'],
    reducer: ee.Reducer.frequencyHistogram()
  }).get('histogram')
);

var agebCountsFC = ee.FeatureCollection(
  agebCounts.keys().map(function(key) {
    return ee.Feature(null, { 'ageb_key': key, 'total': agebCounts.get(key) });
  })
);

// factor_sum via reducer agrupado nativo — evita filtrar la colección N veces
var agebFactorGroups = ee.List(
  respondentsWithKeys.reduceColumns({
    reducer: ee.Reducer.sum().group({ groupField: 1, groupName: 'ageb_key' }),
    selectors: ['factor_cvnl', 'ageb_key']
  }).get('groups')
);

var agebFactorsFC = ee.FeatureCollection(
  agebFactorGroups.map(function(g) {
    g = ee.Dictionary(g);
    return ee.Feature(null, { 'ageb_key': g.get('ageb_key'), 'factor_sum': g.get('sum') });
  })
);

// Join 1: shapefile + conteo
var agebWithCount = ee.FeatureCollection(
  ee.Join.inner().apply({
    primary:   ageb,
    secondary: agebCountsFC,
    condition: ee.Filter.equals({ leftField: 'CVEGEO', rightField: 'ageb_key' })
  }).map(function(f) {
    return ee.Feature(f.get('primary'))
      .set('total', ee.Feature(f.get('secondary')).get('total'));
  })
);

// Join 2: + factor_sum (ambos joins son ligeros porque operan sobre shapefiles ya reducidos)
var agebFinal = ee.FeatureCollection(
  ee.Join.inner().apply({
    primary:   agebWithCount,
    secondary: agebFactorsFC,
    condition: ee.Filter.equals({ leftField: 'CVEGEO', rightField: 'ageb_key' })
  }).map(function(f) {
    return ee.Feature(f.get('primary'))
      .set('factor_sum', ee.Feature(f.get('secondary')).get('factor_sum'));
  })
);

var visAgeb = { min: 1, max: 50, palette: ['white', 'yellow', 'orange', 'red'] };
Map.centerObject(ageb, 10);
Map.addLayer(ee.Image().paint(agebFinal, 'total'),
             visAgeb, 'AGEB Respondents');
Map.addLayer(ee.Image().paint({ featureCollection: agebFinal, color: 1, width: 1 }),
             { palette: ['black'] }, 'AGEB borders');
Map.addLayer(agebFinal, { opacity: 0 }, 'AGEB (data)');

// ══════════════════════════════════════════════
// ── MANZANAS: solo las que tienen respondientes
// ══════════════════════════════════════════════

var mzaCounts = ee.Dictionary(
  respondentsWithKeys.reduceColumns({
    selectors: ['mza_key'],
    reducer: ee.Reducer.frequencyHistogram()
  }).get('histogram')
);

var mzaCountsFC = ee.FeatureCollection(
  mzaCounts.keys().map(function(key) {
    return ee.Feature(null, { 'mza_key': key, 'total': mzaCounts.get(key) });
  })
);

var manzanas = manzanas_raw;

var manzanasConRespondientes = ee.FeatureCollection(
  ee.Join.inner().apply({
    primary:   manzanas,
    secondary: mzaCountsFC,
    condition: ee.Filter.equals({ leftField: 'CVEGEO', rightField: 'mza_key' })
  }).map(function(f) {
    return ee.Feature(f.get('primary'))
      .set('total', ee.Feature(f.get('secondary')).get('total'));
  })
);

var mzaFactorGroups = ee.List(
  respondentsWithKeys.reduceColumns({
    reducer: ee.Reducer.sum().group({ groupField: 1, groupName: 'mza_key' }),
    selectors: ['factor_cvnl', 'mza_key']
  }).get('groups')
);

var mzaFactorsFC = ee.FeatureCollection(
  mzaFactorGroups.map(function(g) {
    g = ee.Dictionary(g);
    return ee.Feature(null, { 'mza_key': g.get('mza_key'), 'factor_sum': g.get('sum') });
  })
);

var manzanasFinal = ee.FeatureCollection(
  ee.Join.inner().apply({
    primary:   manzanasConRespondientes,
    secondary: mzaFactorsFC,
    condition: ee.Filter.equals({ leftField: 'CVEGEO', rightField: 'mza_key' })
  }).map(function(f) {
    return ee.Feature(f.get('primary'))
      .set('factor_sum', ee.Feature(f.get('secondary')).get('factor_sum'));
  })
);

var visMza = { min: 1, max: 5, palette: ['d4f7d4', '74c476', '238b45', '00441b'] };
Map.addLayer(ee.Image().paint(manzanasFinal, 'total'),
             visMza, 'Manzanas con Respondientes');
Map.addLayer(ee.Image().paint({ featureCollection: manzanasFinal, color: 1, width: 1 }),
             { palette: ['darkgreen'] }, 'Manzanas borders');
Map.addLayer(manzanasFinal, { opacity: 0 }, 'Manzanas (data)');

// ══════════════════════════════════════════════
// ── Capas adicionales
// ══════════════════════════════════════════════

Map.addLayer(distritos_raw, { opacity: 0 }, 'Distritos Data');
Map.addLayer(distritos_raw.style({ color: 'blue', fillColor: '00000000', width: 2 }), {}, 'Distritos');

// ══════════════════════════════════════════════
// ── Verificación de coincidencias
// ══════════════════════════════════════════════

var agebKeyList  = agebCounts.keys();
var cveAgebList  = ageb.aggregate_array('CVEGEO').distinct();
var noMatchAgeb  = agebKeyList.removeAll(cveAgebList);

print('── Verificación AGEB ──');
print('AGEB en respondientes:',   agebKeyList.size());
print('AGEB en shapefile:',       cveAgebList.size());
print('Sin match (deben ser 0):', noMatchAgeb.size(), noMatchAgeb);
print('Sin respondientes:',       cveAgebList.removeAll(agebKeyList).size());

var mzaKeyList  = mzaCounts.keys();
var cveMzaList  = manzanas.aggregate_array('CVEGEO').distinct();
var noMatchMza  = mzaKeyList.removeAll(cveMzaList);

print('── Verificación Manzanas ──');
print('Manzanas en respondientes:', mzaKeyList.size());
print('Manzanas en shapefile:',     cveMzaList.size());
print('Sin match (deben ser 0):',   noMatchMza.size(), noMatchMza);
print('Sin respondientes:',         cveMzaList.removeAll(mzaKeyList).size());

// ══════════════════════════════════════════════
// ── Totales globales
// ══════════════════════════════════════════════

print('── Totales AGEB ──');
print('total (suma):',      agebFinal.aggregate_sum('total'));
print('factor_sum (suma):', agebFinal.aggregate_sum('factor_sum'));

print('── Totales Manzanas ──');
print('total (suma):',      manzanasFinal.aggregate_sum('total'));
print('factor_sum (suma):', manzanasFinal.aggregate_sum('factor_sum'));

// ══════════════════════════════════════════════
// ── Manzanas en más de un distrito
// ══════════════════════════════════════════════

// Buffer negativo de 1 m: elimina toques de borde sin calcular áreas por par
var mzaErodidas = manzanasFinal.map(function(f) {
  return f.setGeometry(f.geometry().buffer(-1, 1));
});

// Join espacial vectorizado: cada manzana acumula los distritos que la solapan realmente
var mzaConDistritos = ee.Join.saveAll('distritos_match').apply({
  primary:   mzaErodidas,
  secondary: distritos_raw,
  condition: ee.Filter.intersects({ leftField: '.geo', rightField: '.geo' })
});

var mzaConCount = mzaConDistritos.map(function(mza) {
  return mza.set('n_distritos', ee.List(mza.get('distritos_match')).size());
});

var mzaMultiples = mzaConCount.filter(ee.Filter.gt('n_distritos', 1));

print('── Manzanas en más de un distrito ──');
print('Manzanas con respondientes:', manzanasFinal.size());
print('Manzanas en >1 distrito:',    mzaMultiples.size());

// ══════════════════════════════════════════════
// ── Export: respondentes + distritos de su manzana
// ══════════════════════════════════════════════

// Lista de IDs de distrito + distrito con mayor área de intersección por manzana
var mzaDistritosFC = mzaConCount.map(function(mza) {
  var matches = ee.List(mza.get('distritos_match'));
  var mzaGeom = mza.geometry();

  // Solo calcula intersecciones cuando hay más de un distrito (caso minoritario)
  var distritoUnico = ee.Algorithms.If(
    ee.Number(mza.get('n_distritos')).eq(1),
    ee.Feature(matches.get(0)).get('ID'),
    ee.Feature(
      ee.FeatureCollection(matches.map(function(d) {
        d = ee.Feature(d);
        return ee.Feature(null, {
          'area': mzaGeom.intersection(d.geometry(), ee.ErrorMargin(1)).area(1),
          'ID':   d.get('ID')
        });
      })).sort('area', false).first()
    ).get('ID')
  );

  return ee.Feature(null, {
    'mza_key':        mza.get('CVEGEO'),
    'distrito':       ee.FeatureCollection(matches).aggregate_array('ID'),
    'distrito_unico': distritoUnico
  });
});

// Join atributivo: respondentes + lista de distritos de su manzana
var respondentesConDistrito = ee.Join.inner().apply({
  primary:   respondentsWithKeys,
  secondary: mzaDistritosFC,
  condition: ee.Filter.equals({ leftField: 'mza_key', rightField: 'mza_key' })
}).map(function(f) {
  var sec = ee.Feature(f.get('secondary'));
  return ee.Feature(f.get('primary'))
    .set('distrito',       sec.get('distrito'))
    .set('distrito_unico', sec.get('distrito_unico'));
});

Export.table.toDrive({
  collection:  respondentesConDistrito,
  description: 'geodata_distritos',
  fileFormat:  'CSV'
});
