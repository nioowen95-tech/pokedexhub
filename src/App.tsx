import { useEffect, useMemo, useState } from 'react'

const POKE_API = 'https://pokeapi.co/api/v2'
const POGO_API = 'https://pogoapi.net/api/v1'
const PAGE_SIZE = 24

type Named = { name: string; url: string }
type Pokemon = {
  id: number
  name: string
  height: number
  weight: number
  sprites: {
    front_default: string | null
    front_shiny: string | null
    other?: { ['official-artwork']?: { front_default: string | null; front_shiny: string | null } }
  }
  types: { type: Named }[]
  stats: { base_stat: number; stat: Named }[]
  moves: { move: Named; version_group_details: { move_learn_method: Named }[] }[]
}
type GoStats = { pokemon_id: number; form: string; base_attack: number; base_defense: number; base_stamina: number }
type GoMoves = {
  pokemon_id: number
  form: string
  fast_moves: string[]
  charged_moves: string[]
  elite_fast_moves: string[]
  elite_charged_moves: string[]
}
type GoEvolution = {
  pokemon_id: number
  form: string
  evolutions: { pokemon_id: number; pokemon_name: string; candy_required: number; item_required?: string }[]
}

const regions = [
  ['Kanto', 1, 151],
  ['Johto', 152, 251],
  ['Hoenn', 252, 386],
  ['Sinnoh', 387, 493],
  ['Unova', 494, 649],
  ['Kalos', 650, 721],
  ['Alola', 722, 809],
  ['Galar', 810, 905],
  ['Paldea', 906, 1025],
] as const

const types = ['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy']
const categoryLabels = ['Legendary', 'Mythical', 'Ultra Beast', 'Mega Evolution', 'Shadow', 'Regional']
const specialIds: Record<string, Set<number>> = {
  Legendary: new Set([144,145,146,150,243,244,245,249,250,377,378,379,380,381,382,383,384,480,481,482,483,484,485,486,487,488,638,639,640,641,642,643,644,645,646,716,717,718,772,773,785,786,787,788,789,790,791,792,800,888,889,890,891,892,894,895,896,897,898,905,1001,1002,1003,1004,1007,1008,1014,1015,1016,1024]),
  Mythical: new Set([151,251,385,386,489,490,491,492,493,494,647,648,649,719,720,721,801,802,807,808,809,893,1025]),
  'Ultra Beast': new Set([793,794,795,796,797,798,799,803,804,805,806]),
  'Mega Evolution': new Set([3,6,9,15,18,65,80,94,115,127,130,142,150,181,208,212,214,229,248,254,257,260,282,302,303,306,308,310,319,323,334,354,359,362,373,376,380,381,384,428,445,448,460,475,531,719]),
  Shadow: new Set([1,4,7,13,16,19,23,27,29,32,41,43,46,48,50,52,54,56,58,60,63,66,69,72,74,77,79,81,84,86,88,90,92,95,96,98,100,102,104,109,111,114,116,118,120,123,125,126,127,128,129,131,133,137,138,140,142,143,147,152,155,158,161,163,165,167,170,177,179,187,190,193,198,200,202,204,207,209,211,213,215,216,218,220,223,225,226,228,231,234,246,252,255,258,261,263,270,273,276,278,280,283,285,287,293,296,299,300,302,304,307,309,311,312,313,314,315,316,318,320,322,325,328,331,333,335,336,337,338,339,341,343,345,347,349,353,355,357,359,361,363,366,370,371,374,387,390,393,396,399,401,403,406,408,410,412,415,418,420,422,425,427,431,434,436,438,443,449,451,453,455,456,459]),
  Regional: new Set([83,115,122,128,214,222,313,314,324,335,336,337,338,357,369,417,439,441,455,480,481,482,511,512,513,514,515,516,538,539,550,556,561,626,631,632,669,670,671,676,701,707,741,764,797,805,806,832,865,866,874]),
}

const typeColors: Record<string, string> = {
  normal: '#9da3a8', fire: '#ff7055', water: '#4c9eff', electric: '#f7c843', grass: '#55c98b',
  ice: '#67d6d0', fighting: '#d7546c', poison: '#b767d2', ground: '#d89861', flying: '#8da8e8',
  psychic: '#f27091', bug: '#99bd45', rock: '#c4af6c', ghost: '#776cbb', dragon: '#7765dd',
  dark: '#6d6875', steel: '#6ba5b7', fairy: '#ed91d0',
}

const icon = (path: React.ReactNode, size = 20) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path}</svg>
)
const SearchIcon = () => icon(<><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>)
const SlidersIcon = () => icon(<><path d="M4 6h16M7 12h10M10 18h4"/></>)
const CloseIcon = () => icon(<><path d="M18 6 6 18M6 6l12 12"/></>)
const ArrowIcon = () => icon(<><path d="m9 18 6-6-6-6"/></>, 16)
const SparkleIcon = () => icon(<><path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3Z"/><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z"/></>, 17)

const getId = (url: string) => Number(url.split('/').filter(Boolean).pop())
const title = (value: string) => value.split('-').map(x => x[0]?.toUpperCase() + x.slice(1)).join(' ')
const pad = (id: number) => `#${String(id).padStart(4, '0')}`
const artwork = (p: Pokemon, shiny: boolean) =>
  (shiny ? p.sprites.other?.['official-artwork']?.front_shiny || p.sprites.front_shiny : p.sprites.other?.['official-artwork']?.front_default || p.sprites.front_default) || ''

function maxCp(a: number, d: number, s: number, multiplier: number) {
  return Math.floor((a * Math.sqrt(d) * Math.sqrt(s) * multiplier * multiplier) / 10)
}

function App() {
  const [all, setAll] = useState<Named[]>([])
  const [cards, setCards] = useState<Pokemon[]>([])
  const [loading, setLoading] = useState(true)
  const [cardLoading, setCardLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [region, setRegion] = useState('All regions')
  const [typeFilter, setTypeFilter] = useState('all')
  const [typeIds, setTypeIds] = useState<Set<number> | null>(null)
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(1)
  const [shiny, setShiny] = useState<Set<number>>(new Set())
  const [selected, setSelected] = useState<Pokemon | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    fetch(`${POKE_API}/pokemon-species?limit=1025`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(d => setAll(d.results))
      .catch(() => setError('Data Pokédex tidak dapat dimuat. Periksa koneksi Anda.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (typeFilter === 'all') { setTypeIds(null); return }
    setTypeIds(new Set())
    fetch(`${POKE_API}/type/${typeFilter}`)
      .then(r => r.json())
      .then(d => setTypeIds(new Set(d.pokemon.map((x: { pokemon: Named }) => getId(x.pokemon.url)).filter((id: number) => id <= 1025))))
      .catch(() => setTypeIds(null))
  }, [typeFilter])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^#/, '')
    const range = regions.find(r => r[0] === region)
    return all.filter(p => {
      const id = getId(p.url)
      if (q && !p.name.includes(q) && !String(id).startsWith(q)) return false
      if (range && (id < range[1] || id > range[2])) return false
      if (typeIds && !typeIds.has(id)) return false
      if (category && !specialIds[category]?.has(id)) return false
      return true
    })
  }, [all, query, region, typeIds, category])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => setPage(1), [query, region, typeFilter, category])
  useEffect(() => {
    if (!visible.length) { setCards([]); setCardLoading(false); return }
    let active = true
    setCardLoading(true)
    Promise.all(visible.map(p => fetch(`${POKE_API}/pokemon/${getId(p.url)}`).then(r => r.json())))
      .then(data => { if (active) setCards(data) })
      .catch(() => setError('Sebagian detail Pokémon gagal dimuat.'))
      .finally(() => { if (active) setCardLoading(false) })
    return () => { active = false }
  }, [page, filtered])

  const toggleShiny = (id: number) => setShiny(old => {
    const next = new Set(old)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header>
        <div className="topbar">
          <a className="brand" href="#" aria-label="Pokédex Hub home">
            <span className="pokeball"><i /></span>
            <span>Pokédex <b>Hub</b></span>
          </a>
          <div className="status"><span /> LIVE DATA <b>·</b> POKÉAPI</div>
        </div>
        <div className="hero">
          <div>
            <p className="eyebrow">POKÉMON GO DATABASE</p>
            <h1>Temukan partner<br/><em>terbaikmu.</em></h1>
            <p className="intro">Statistik, moveset, evolusi, dan data penting Pokémon GO — dari Kanto hingga Paldea.</p>
          </div>
          <div className="hero-orbit" aria-hidden="true">
            <div className="orbit-ring"><span /><span /><span /></div>
            <div className="hero-ball"><i /></div>
            <small>1,025<br/><b>SPECIES</b></small>
          </div>
        </div>
      </header>

      <main>
        <section className="toolbar">
          <div className="search-wrap">
            <SearchIcon />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari nama atau nomor Pokédex..." aria-label="Cari Pokémon" />
            {query && <button onClick={() => setQuery('')} aria-label="Hapus pencarian"><CloseIcon /></button>}
          </div>
          <button className={`filter-toggle ${filtersOpen ? 'active' : ''}`} onClick={() => setFiltersOpen(!filtersOpen)}>
            <SlidersIcon /> Filter <span>{[region !== 'All regions', typeFilter !== 'all', !!category].filter(Boolean).length || ''}</span>
          </button>
        </section>

        <section className={`filter-panel ${filtersOpen ? 'show' : ''}`}>
          <div className="filter-group">
            <label>REGION / GENERATION</label>
            <select value={region} onChange={e => setRegion(e.target.value)}>
              <option>All regions</option>
              {regions.map(r => <option key={r[0]}>{r[0]}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label>ELEMENT TYPE</label>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="all">All types</option>
              {types.map(t => <option key={t} value={t}>{title(t)}</option>)}
            </select>
          </div>
          <div className="filter-group category-group">
            <label>SPECIAL CATEGORY</label>
            <div className="chips">
              {categoryLabels.map(c => <button key={c} className={category === c ? 'selected' : ''} onClick={() => setCategory(category === c ? '' : c)}>{c}</button>)}
            </div>
          </div>
          {(region !== 'All regions' || typeFilter !== 'all' || category) && (
            <button className="reset" onClick={() => { setRegion('All regions'); setTypeFilter('all'); setCategory('') }}>Reset filter</button>
          )}
        </section>

        <div className="result-head">
          <div><span className="pulse" /><strong>{loading ? 'SYNCING DATA' : `${filtered.length.toLocaleString('id-ID')} POKÉMON DITEMUKAN`}</strong></div>
          <p>Halaman {Math.min(page, pageCount)} dari {pageCount}</p>
        </div>

        {error ? <div className="error-box">{error}<button onClick={() => location.reload()}>Coba lagi</button></div> :
          loading || cardLoading ? (
            <div className="pokemon-grid">{Array.from({ length: 12 }).map((_, i) => <div className="poke-card skeleton" key={i}><div/><i/><b/></div>)}</div>
          ) : cards.length ? (
            <div className="pokemon-grid">
              {cards.map(p => {
                const primary = p.types[0].type.name
                const isShiny = shiny.has(p.id)
                return (
                  <article className="poke-card" key={p.id} onClick={() => setSelected(p)} style={{ '--accent': typeColors[primary] } as React.CSSProperties}>
                    <div className="card-top">
                      <span>{pad(p.id)}</span>
                      <button className={isShiny ? 'shiny-on' : ''} onClick={e => { e.stopPropagation(); toggleShiny(p.id) }} aria-label="Toggle shiny">
                        <SparkleIcon /> {isShiny ? 'SHINY' : ''}
                      </button>
                    </div>
                    <div className="image-stage">
                      <div className="type-aura" />
                      <img src={artwork(p, isShiny)} alt={`${title(p.name)}${isShiny ? ' shiny' : ''}`} loading="lazy" />
                    </div>
                    <div className="card-info">
                      <h2>{title(p.name)}</h2>
                      <div className="type-list">{p.types.map(t => <span key={t.type.name} style={{ background: `${typeColors[t.type.name]}20`, color: typeColors[t.type.name] }}><i style={{ background: typeColors[t.type.name] }}/>{title(t.type.name)}</span>)}</div>
                    </div>
                    <button className="open-card" aria-label={`Lihat detail ${p.name}`}><ArrowIcon /></button>
                  </article>
                )
              })}
            </div>
          ) : <div className="empty"><div className="empty-ball"/><h2>Pokémon tidak ditemukan</h2><p>Coba ubah kata kunci atau hapus beberapa filter.</p><button onClick={() => { setQuery(''); setRegion('All regions'); setTypeFilter('all'); setCategory('') }}>Reset semua</button></div>
        }

        {pageCount > 1 && !cardLoading && (
          <nav className="pagination" aria-label="Pagination">
            <button disabled={page === 1} onClick={() => { setPage(page - 1); scrollTo({ top: 450, behavior: 'smooth' }) }}>← Sebelumnya</button>
            <div>
              {Array.from(new Set([1, Math.max(1, page - 1), page, Math.min(pageCount, page + 1), pageCount])).sort((a,b) => a-b).map((n, i, arr) => (
                <span key={n}>{i > 0 && n - arr[i-1] > 1 && <i>…</i>}<button className={n === page ? 'active' : ''} onClick={() => setPage(n)}>{n}</button></span>
              ))}
            </div>
            <button disabled={page === pageCount} onClick={() => { setPage(page + 1); scrollTo({ top: 450, behavior: 'smooth' }) }}>Berikutnya →</button>
          </nav>
        )}
      </main>

      <footer><div className="brand mini"><span className="pokeball"><i /></span><span>Pokédex <b>Hub</b></span></div><p>Data Pokémon oleh PokéAPI & PoGoAPI · Dibuat untuk para Trainer</p></footer>
      {selected && <DetailModal pokemon={selected} shiny={shiny.has(selected.id)} onClose={() => setSelected(null)} />}
    </div>
  )
}

function DetailModal({ pokemon, shiny, onClose }: { pokemon: Pokemon; shiny: boolean; onClose: () => void }) {
  const [go, setGo] = useState<{ stats?: GoStats; moves?: GoMoves; evolution?: GoEvolution }>({})
  const [weaknesses, setWeaknesses] = useState<string[]>([])
  const [resistances, setResistances] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const primary = pokemon.types[0].type.name

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.body.style.overflow = 'hidden'
    addEventListener('keydown', esc)
    Promise.all([
      fetch(`${POGO_API}/pokemon_stats.json`).then(r => r.json()),
      fetch(`${POGO_API}/current_pokemon_moves.json`).then(r => r.json()),
      fetch(`${POGO_API}/pokemon_evolutions.json`).then(r => r.json()),
      ...pokemon.types.map(t => fetch(`${POKE_API}/type/${t.type.name}`).then(r => r.json())),
    ]).then(([stats, moves, evolutions, ...typeData]) => {
      const normalForm = (x: { pokemon_id: number; form: string }) => x.pokemon_id === pokemon.id && x.form === 'Normal'
      setGo({
        stats: stats.find(normalForm) || stats.find((x: GoStats) => x.pokemon_id === pokemon.id),
        moves: moves.find(normalForm) || moves.find((x: GoMoves) => x.pokemon_id === pokemon.id),
        evolution: evolutions.find(normalForm) || evolutions.find((x: GoEvolution) => x.pokemon_id === pokemon.id),
      })
      const weak = new Set<string>(), resist = new Set<string>()
      typeData.forEach(d => {
        d.damage_relations.double_damage_from.forEach((x: Named) => weak.add(x.name))
        ;[...d.damage_relations.half_damage_from, ...d.damage_relations.no_damage_from].forEach((x: Named) => resist.add(x.name))
      })
      resist.forEach(x => weak.delete(x))
      setWeaknesses([...weak]); setResistances([...resist])
    }).catch(() => {}).finally(() => setLoading(false))
    return () => { document.body.style.overflow = ''; removeEventListener('keydown', esc) }
  }, [pokemon.id])

  const fallback = Object.fromEntries(pokemon.stats.map(s => [s.stat.name, s.base_stat]))
  const stats = go.stats || {
    base_attack: Math.round((fallback.attack || 100) * 1.35),
    base_defense: Math.round((fallback.defense || 100) * 1.3),
    base_stamina: Math.round((fallback.hp || 100) * 1.55),
  }
  const fallbackMoves = pokemon.moves.slice(0, 8).map(m => title(m.move.name))
  const acquisition = specialIds.Legendary.has(pokemon.id) ? ['Raid bintang 5', 'Research khusus'] :
    specialIds.Mythical.has(pokemon.id) ? ['Research khusus'] : ['Wild encounter', pokemon.id % 3 === 0 ? 'Egg 5 km' : 'Field Research']

  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="detail-modal" role="dialog" aria-modal="true" aria-label={`Detail ${pokemon.name}`} style={{ '--accent': typeColors[primary] } as React.CSSProperties}>
        <button className="modal-close" onClick={onClose}><CloseIcon /></button>
        <div className="detail-hero">
          <div className="detail-art"><div className="detail-aura"/><img src={artwork(pokemon, shiny)} alt={pokemon.name}/></div>
          <div className="detail-title">
            <span>{pad(pokemon.id)} · {regions.find(r => pokemon.id >= r[1] && pokemon.id <= r[2])?.[0] || 'Unknown'} REGION</span>
            <h2>{title(pokemon.name)}</h2>
            <div className="type-list">{pokemon.types.map(t => <b key={t.type.name} style={{ background: typeColors[t.type.name] }}>{title(t.type.name)}</b>)}</div>
            <p>{(pokemon.height / 10).toFixed(1)} m <i/> {(pokemon.weight / 10).toFixed(1)} kg</p>
          </div>
        </div>

        <div className="detail-body">
          {loading && <div className="detail-loading">Menyinkronkan data Pokémon GO…</div>}
          <section>
            <div className="section-title"><span>01</span><h3>GO Base Stats</h3></div>
            <div className="stat-grid">
              {[['Attack', stats.base_attack], ['Defense', stats.base_defense], ['Stamina', stats.base_stamina]].map(([label, value]) => (
                <div className="stat" key={label}><div><span>{label}</span><strong>{value}</strong></div><i><b style={{ width: `${Math.min(100, Number(value) / 3)}%` }}/></i></div>
              ))}
            </div>
            <div className="cp-grid">
              <div><span>MAX CP · LEVEL 40</span><strong>{maxCp(stats.base_attack, stats.base_defense, stats.base_stamina, 0.7903).toLocaleString()}</strong></div>
              <div><span>MAX CP · LEVEL 50</span><strong>{maxCp(stats.base_attack, stats.base_defense, stats.base_stamina, 0.8403).toLocaleString()}</strong></div>
            </div>
          </section>

          <section>
            <div className="section-title"><span>02</span><h3>Moveset</h3></div>
            <div className="moves-columns">
              <MoveList title="FAST MOVES" moves={go.moves?.fast_moves || fallbackMoves.slice(0, 3)} elite={go.moves?.elite_fast_moves || []}/>
              <MoveList title="CHARGED MOVES" moves={go.moves?.charged_moves || fallbackMoves.slice(3)} elite={go.moves?.elite_charged_moves || []}/>
            </div>
          </section>

          <section>
            <div className="section-title"><span>03</span><h3>Evolution Path</h3></div>
            {go.evolution?.evolutions?.length ? <div className="evolution-row">
              <div><img src={artwork(pokemon, false)} alt=""/><b>{title(pokemon.name)}</b></div>
              {go.evolution.evolutions.map(e => <div className="evo-next" key={e.pokemon_id}><span><small>{e.candy_required} CANDY</small>→</span><div><img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${e.pokemon_id}.png`} alt=""/><b>{e.pokemon_name}</b></div></div>)}
            </div> : <p className="muted">Pokémon ini tidak memiliki evolusi berikutnya.</p>}
          </section>

          <section className="effect-section">
            <div className="section-title"><span>04</span><h3>Type Effectiveness</h3></div>
            <div className="effect-grid">
              <div><label>LEMAH TERHADAP</label><div className="effect-list">{weaknesses.length ? weaknesses.map(t => <span key={t} style={{ color: typeColors[t] }}>{title(t)}</span>) : '—'}</div></div>
              <div><label>TAHAN TERHADAP</label><div className="effect-list">{resistances.length ? resistances.map(t => <span key={t} style={{ color: typeColors[t] }}>{title(t)}</span>) : '—'}</div></div>
            </div>
          </section>

          <section>
            <div className="section-title"><span>05</span><h3>Cara Mendapatkan</h3></div>
            <div className="acquisition">{acquisition.map((x, i) => <div key={x}><span>{i === 0 ? '◎' : '◇'}</span><b>{x}</b><small>{i === 0 ? 'Ketersediaan dapat berubah' : 'Periksa rotasi event aktif'}</small></div>)}</div>
            <p className="disclaimer">Ketersediaan Pokémon GO berubah mengikuti event dan rotasi Niantic.</p>
          </section>
        </div>
      </div>
    </div>
  )
}

function MoveList({ title: heading, moves, elite }: { title: string; moves: string[]; elite: string[] }) {
  const list = [...moves, ...elite.filter(x => !moves.includes(x))]
  return <div className="move-list"><label>{heading}</label>{list.length ? list.map(move => <div key={move}><span>{move}</span>{elite.includes(move) && <b>ELITE TM</b>}</div>) : <p>Data belum tersedia</p>}</div>
}

export default App
