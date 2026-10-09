import { useEffect, useState } from 'react'
import styles from './App.module.css'
import { NavBar, TabBar } from './components/NavBar'
import { useRoute } from './lib/router'
import { NO_FILTERS, type ShowFilters } from './lib/search'
import { MyArtists } from './routes/MyArtists'
import { Shows } from './routes/Shows'
import { SignIn } from './routes/SignIn'

export function App() {
  const route = useRoute()
  // Kept here so search and filters survive a visit to another screen and a category change.
  const [filters, setFilters] = useState<ShowFilters>(NO_FILTERS)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [route.name, route.category])

  return (
    <div className={styles.app}>
      <NavBar route={route} query={filters.query} onQueryChange={(query) => setFilters((f) => ({ ...f, query }))} />
      <main className={styles.main}>
        {route.name === 'shows' && <Shows route={route} filters={filters} onFiltersChange={setFilters} />}
        {route.name === 'artists' && <MyArtists />}
        {route.name === 'signin' && <SignIn />}
      </main>
      <TabBar route={route} />
    </div>
  )
}
