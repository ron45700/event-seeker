import { CloseIcon, SearchIcon } from './icons'
import styles from './SearchField.module.css'

interface Props {
  value: string
  onChange: (value: string) => void
  className?: string
}

/** The rounded search pill, used in the header and in the phone's sticky bar. */
export function SearchField({ value, onChange, className }: Props) {
  return (
    <div className={`${styles.field} ${className ?? ''}`}>
      <SearchIcon className={styles.icon} />
      <input
        type="search"
        className={styles.input}
        placeholder="חיפוש אמן או אירוע"
        aria-label="חיפוש אירועים"
        enterKeyHint="search"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button type="button" className={styles.clear} aria-label="ניקוי החיפוש" onClick={() => onChange('')}>
          <CloseIcon width={20} height={20} />
        </button>
      )}
    </div>
  )
}
