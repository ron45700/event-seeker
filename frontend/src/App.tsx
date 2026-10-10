import { useEffect, useState } from 'react'
import styles from './App.module.css'
import { NavBar, TabBar } from './components/NavBar'
import { categoryFromParam } from './lib/categories'
import { navigate, replaceRoute, showsHref, useRoute } from './lib/router'
import { sameFilters, type ShowFilters } from './lib/search'
import { Admin } from './routes/Admin'
import { MyArtists } from './routes/MyArtists'
import { Shows } from './routes/Shows'
import { SignIn } from './routes/SignIn'

export function App() {
  const route = useRoute()
  const onShows = route.name === 'shows'
  const category = onShows ? categoryFromParam(route.category) : null
  // The events page keeps its search and filters in the URL, so a reload or Back restores
  // them. They are also held here: the input updates at once (the hash follows a moment
  // later), and they survive a visit to another screen.
  const [filters, setFilters] = useState<ShowFilters>(route.filters)

  // The URL changed from outside: Back / Forward, a link, a typed address.
  const urlFilters = route.filters
  useEffect(() => {
    if (onShows) setFilters((current) => (sameFilters(current, urlFilters) ? current : urlFilters))
  }, [onShows, urlFilters])

  function changeFilters(next: ShowFilters) {
    setFilters(next)
    // Replace, not push: Back leaves the page instead of undoing one keystroke at a time.
    if (onShows) replaceRoute(showsHref(category, next))
    else navigate(showsHref(null, next))
  }

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [route.name, route.category])

  return (
    <div className={styles.app}>
      <NavBar
        route={route}
        showsLink={showsHref(null, filters)}
        query={filters.query}
        // Searching from another screen takes you to the results.
        onQueryChange={(query) => changeFilters({ ...filters, query })}
      />
      <main className={styles.main}>
        {onShows && <Shows route={route} filters={filters} onFiltersChange={changeFilters} />}
        {route.name === 'artists' && <MyArtists />}
        {route.name === 'signin' && <SignIn />}
        {route.name === 'admin' && <Admin />}
      </main>
      <TabBar route={route} showsLink={showsHref(null, filters)} />
    </div>
  )
}
