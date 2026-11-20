import HappinessMap from './HappinessMap.jsx';
import { useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip,
  ScatterChart, Scatter, BarChart, Bar, Cell, Legend
} from 'recharts';

const YEARS = Array.from({ length: 10 }, (_, i) => 2015 + i);
const COLORS = { navy: '#142B3A', teal: '#3AAFA9', coral: '#E07A5F', yellow: '#F4C95D' };
const number = (value) => {
  const cleaned = String(value ?? '').trim().replace(',', '.');
  return cleaned === '' ? null : (Number.isFinite(Number(cleaned)) ? Number(cleaned) : null);
};
const average = (values) => {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
};
function pearson(rows) {
  const valid = rows.filter(r => Number.isFinite(r.gdp) && Number.isFinite(r.score));
  if (valid.length < 2) return null;
  const mx = average(valid.map(r => r.gdp));
  const my = average(valid.map(r => r.score));
  let xy = 0, xx = 0, yy = 0;
  valid.forEach(r => { const x = r.gdp - mx, y = r.score - my; xy += x * y; xx += x * x; yy += y * y; });
  return xx > 0 && yy > 0 ? xy / Math.sqrt(xx * yy) : null;
}
const fmt = (value, decimals = 2) => value == null ? '—' : value.toFixed(decimals);
function KPI({ label, value, note, main }) {
  return <article className={'kpi ' + (main ? 'main' : '')}><p>{label}</p><strong>{value}</strong><small>{note}</small></article>;
}
function Panel({ title, subtitle, children }) {
  return <article className="panel"><h2>{title}</h2><p className="sub">{subtitle}</p><div className="chart-area">{children}</div></article>;
}
const tooltipStyle = { borderRadius: 9, fontSize: 12 };
function Empty({ message = 'No hay datos para los filtros seleccionados.' }) { return <div className="empty-chart">{message}</div>; }

export default function App() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState('2024');
  const [region, setRegion] = useState('Todas las regiones');

  useEffect(() => {
    fetch('/data/world_happiness_combined.csv')
      .then(response => { if (!response.ok) throw new Error(`No se pudo cargar el CSV (${response.status}).`); return response.text(); })
      .then(csv => {
        const parsed = Papa.parse(csv.replace(/^\uFEFF/, ''), { header: true, delimiter: ';', skipEmptyLines: true });
        const clean = parsed.data.map(r => ({
          country: String(r.Country ?? '').trim(),
          region: String(r['Regional indicator'] ?? '').trim() || 'Sin región',
          year: number(r.Year), score: number(r['Happiness score']),
          gdp: number(r['GDP per capita'])
        })).filter(r => r.country && Number.isFinite(r.year) && Number.isFinite(r.score));
        if (!clean.length) throw new Error('El CSV no contiene registros válidos. Revisa el separador y los encabezados.');
        setRows(clean);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const regions = useMemo(() => ['Todas las regiones', ...Array.from(new Set(rows.map(r => r.region))).sort()], [rows]);
  const regionRows = useMemo(() => rows.filter(r => region === 'Todas las regiones' || r.region === region), [rows, region]);
  const selected = useMemo(() => regionRows.filter(r => r.year === Number(year)), [regionRows, year]);
  const avgScore = average(selected.map(r => r.score));
  const correlation = pearson(selected);
  const countries = new Set(selected.map(r => r.country)).size;

  const yearly = useMemo(() => YEARS.map(y => ({ year: String(y), felicidad: average(regionRows.filter(r => r.year === y).map(r => r.score)) })), [regionRows]);
  const ranking = useMemo(() => [...selected].sort((a, b) => b.score - a.score), [selected]);
  const top = ranking.slice(0, 10).reverse().map(r => ({ country: r.country, score: r.score }));
  const bottom = ranking.slice(-10).reverse().map(r => ({ country: r.country, score: r.score }));
  const regionAverages = useMemo(() => {
    const groups = new Map();
    selected.forEach(r => { if (!groups.has(r.region)) groups.set(r.region, []); groups.get(r.region).push(r.score); });
    return [...groups].map(([name, values]) => ({ name, score: average(values) })).sort((a, b) => b.score - a.score);
  }, [selected]);

  return <main className="wrap">
    <header><div><small className="eyebrow">BIENESTAR Y DESARROLLO HUMANO</small><h1>El pulso de la felicidad mundial</h1><p className="intro">Explora cómo se relaciona la felicidad con factores económicos y sociales.</p></div>
      <div className="filters"><label>Año<select value={year} onChange={e => setYear(e.target.value)}>{YEARS.map(y => <option key={y} value={y}>{y}</option>)}</select></label>
      <label>Región<select value={region} onChange={e => setRegion(e.target.value)}>{regions.map(r => <option key={r} value={r}>{r}</option>)}</select></label></div></header>
    {loading && <p role="status">Cargando datos del World Happiness Report…</p>}
    {error && <p role="alert" className="error">{error}</p>}
    <section className="kpis"><KPI main label={`Promedio de felicidad · ${year}`} value={fmt(avgScore, 3)} note="Media de los países seleccionados" />
      <KPI label="Correlación PIB y felicidad" value={fmt(correlation, 3)} note="Coeficiente de Pearson · no implica causalidad" />
      <KPI label="Países incluidos" value={loading ? '—' : String(countries)} note="Países con puntuación disponible" /></section>
    <section className="row2">
      <Panel title="Felicidad por país" subtitle={`Mapa interactivo · ${year} · ${region}`}><HappinessMap rows={selected} year={year} region={region} /></Panel>
      <Panel title="Evolución anual" subtitle="Promedio de felicidad · 2015–2024 · región seleccionada">
        {yearly.some(r => r.felicidad != null) ? <ResponsiveContainer width="100%" height={245}><LineChart data={yearly} margin={{ top: 12, right: 15, bottom: 4, left: -12 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="year" tick={{ fontSize: 10 }} /><YAxis domain={[0, 10]} tick={{ fontSize: 10 }} /><Tooltip contentStyle={tooltipStyle} formatter={v => [fmt(v, 3), 'Felicidad']} /><Line dataKey="felicidad" type="monotone" stroke={COLORS.teal} strokeWidth={3} connectNulls dot={{ r: 3 }} /></LineChart></ResponsiveContainer> : <Empty />}
      </Panel>
    </section>
    <section className="row3">
      <Panel title="PIB per cápita vs. felicidad" subtitle={`Dispersión · países de ${year} · región seleccionada`}>
        {selected.some(r => r.gdp != null) ? <ResponsiveContainer width="100%" height={245}><ScatterChart margin={{ top: 12, right: 15, bottom: 8, left: -12 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" dataKey="gdp" name="PIB (indicador del dataset)" tick={{ fontSize: 10 }} /><YAxis type="number" dataKey="score" name="Felicidad" domain={[0, 10]} tick={{ fontSize: 10 }} /><Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => active && payload?.length ? <div className="scatter-tooltip"><strong>{payload[0]?.payload?.country}</strong><div>PIB: {fmt(payload[0]?.payload?.gdp, 3)}</div><div>Felicidad: {fmt(payload[0]?.payload?.score, 3)}</div></div> : null} /><Scatter data={selected.filter(r => r.gdp != null)} fill={COLORS.teal} /></ScatterChart></ResponsiveContainer> : <Empty />}
      </Panel>
      <Panel title="Ranking de países" subtitle={`Top 10 y Bottom 10 · ${year}`}>
        {ranking.length ? <div className="rankings"><div><h3>Top 10</h3>{[...top].reverse().map((r, i) => <div className="rank-row" key={`t-${i}`}><span title={r.country}>{i + 1}. {r.country}</span><strong>{fmt(r.score, 2)}</strong></div>)}</div><div><h3>Bottom 10</h3>{bottom.map((r, i) => <div className="rank-row" key={`b-${i}`}><span title={r.country}>{r.country}</span><strong>{fmt(r.score, 2)}</strong></div>)}</div></div> : <Empty />}
      </Panel>
      <Panel title="Promedio por región" subtitle={`Comparación regional · ${year}`}>
        {regionAverages.length ? <ResponsiveContainer width="100%" height={Math.max(245, regionAverages.length * 34)}><BarChart data={regionAverages} layout="vertical" margin={{ top: 8, right: 12, bottom: 4, left: 6 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" domain={[0, 10]} tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="name" width={112} tick={{ fontSize: 9 }} /><Tooltip formatter={v => [fmt(v, 3), 'Felicidad']} contentStyle={tooltipStyle} /><Bar dataKey="score" fill={COLORS.coral} radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer> : <Empty />}
      </Panel>
    </section>
    <footer>Fuente: World Happiness Report · 2015–2024 <span>Filtro: {year} · {region}</span></footer>
  </main>;
}
