import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Equivalencias entre nombres del World Happiness Report y Natural Earth.
const ALIASES = {
  'argelia': 'algeria', 'united states': 'united states of america',
  'bosnia and herzegovina': 'bosnia and herz.',
  'central african republic': 'central african rep.',
  'congo (brazzaville)': 'congo', 'congo (kinshasa)': 'dem. rep. congo',
  'czech republic': 'czechia', 'dominican republic': 'dominican rep.',
  'eswatini': 'eswatini', 'swaziland': 'eswatini',
  'ivory coast': 'cote d’ivoire', 'north cyprus': 'n. cyprus',
  'palestinian territories': 'palestine', 'state of palestine': 'palestine',
  'somaliland region': 'somaliland', 'south sudan': 's. sudan',
  'trinidad & tobago': 'trinidad and tobago', 'turkiye': 'turkey',
  'north macedonia': 'macedonia',
};
const normalize = value => String(value ?? '').normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, '')
  .toLowerCase().trim().replace(/\s+/g, ' ');
function nameKey(value) {
  const key = normalize(value);
  return normalize(ALIASES[key] || key);
}
const scoreColor = score => score == null ? '#e2e8eb'
  : score < 4 ? '#e07a5f' : score < 5 ? '#f2a66d'
  : score < 6 ? '#f4c95d' : score < 7 ? '#86c8b9' : '#3aafa9';
function ResetView({ region }) {
  const map = useMap();
  useEffect(() => { if (region === 'Todas las regiones') map.setView([18, 0], 1, { animate: false }); }, [map, region]);
  return null;
}
export default function HappinessMap({ rows, year, region }) {
  const [geo, setGeo] = useState(null);
  const [error, setError] = useState('');
  const [hovered, setHovered] = useState(null);
  const layerRef = useRef(null);
  useEffect(() => {
    fetch('/data/world_countries.geojson').then(r => {
      if (!r.ok) throw new Error('No se pudo cargar el mapa mundial.');
      return r.json();
    }).then(setGeo).catch(e => setError(e.message));
  }, []);
  const scores = useMemo(() => new Map(rows.map(r => [nameKey(r.country), r.score])), [rows]);
  const features = useMemo(() => geo?.features ?? [], [geo]);
  // Remontar la capa al cambiar filtros, para refrescar colores y eventos.
  const geoKey = `${year}-${region}`;
  const matched = useMemo(() => features.filter(f => scores.has(nameKey(f.properties.name))).length, [features, scores]);
  if (error) return <div className="empty-chart" role="alert">{error}</div>;
  if (!geo) return <div className="empty-chart">Cargando mapa mundial…</div>;
  return <div className="map-wrapper">
    <div className="map-summary" aria-live="polite">{hovered
      ? <><strong>{hovered.country}</strong> · {hovered.score == null ? 'Sin datos para el filtro' : `Felicidad: ${hovered.score.toFixed(3)}`}</>
      : 'Pasa el cursor sobre un país para ver su puntuación'}</div>
    <MapContainer center={[18, 0]} zoom={1} minZoom={1} maxZoom={6} scrollWheelZoom={false}
      worldCopyJump={false} attributionControl={true} className="happiness-map" zoomControl={true}>
      <ResetView region={region}/>
      <GeoJSON key={geoKey} ref={layerRef} data={geo}
        style={feature => ({ fillColor: scoreColor(scores.get(nameKey(feature.properties.name))),
          fillOpacity: .9, color: '#ffffff', weight: .6 })}
        onEachFeature={(feature, layer) => {
          const country = feature.properties.name;
          const score = scores.get(nameKey(country));
          layer.on({ mouseover: () => {
            layer.setStyle({ weight: 1.8, color: '#142b3a', fillOpacity: 1 });
            layer.bringToFront(); setHovered({ country, score });
          }, mouseout: () => { layer.setStyle({ weight: .6, color: '#fff', fillOpacity: .9 }); setHovered(null); } });
          layer.bindPopup(`<strong>${country.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</strong><br/>${score == null ? 'Sin datos' : 'Felicidad: '+score.toFixed(3)}`);
        }}/>
    </MapContainer>
    <div className="map-legend" aria-label="Leyenda de felicidad">
      <span><i style={{background:'#e07a5f'}}/>Menos de 4</span>
      <span><i style={{background:'#f2a66d'}}/>4–4.99</span>
      <span><i style={{background:'#f4c95d'}}/>5–5.99</span>
      <span><i style={{background:'#86c8b9'}}/>6–6.99</span>
      <span><i style={{background:'#3aafa9'}}/>7 o más</span>
      <span><i style={{background:'#e2e8eb'}}/>Sin datos</span>
    </div>
    <p className="map-note">{matched} territorios representados con datos. Algunos países pequeños o territorios no aparecen en el mapa base de Natural Earth. El color gris indica ausencia de datos para el año y región elegidos.</p>
  </div>;
}
