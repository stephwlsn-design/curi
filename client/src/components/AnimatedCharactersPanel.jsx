import { useMemo, useState } from 'react'
import { Search, Sparkles, Mic, Grid3X3 } from 'lucide-react'
import {
  CHARACTER_CATEGORIES,
  searchCharacters,
} from '../utils/characterCanvas'
import TalkingCharacterStudio from './TalkingCharacterStudio'

export default function AnimatedCharactersPanel({
  embedded = false,
  workspaceId,
  searchQuery = '',
  onSearchChange,
  onSelect,
  onTalkingCharacter,
}) {
  const [mode, setMode] = useState('browse')
  const [category, setCategory] = useState('mascots')
  const [internalSearch, setInternalSearch] = useState('')
  const [talkTarget, setTalkTarget] = useState(null)
  const search = onSearchChange ? searchQuery : internalSearch
  const setSearch = onSearchChange || setInternalSearch

  const filtered = useMemo(
    () => searchCharacters(search, category),
    [search, category],
  )

  const handleCharacterClick = (character) => {
    if (mode === 'browse') {
      onSelect?.(character)
      return
    }
    setTalkTarget(character)
  }

  return (
    <div className={embedded ? 'space-y-3' : 'card p-5'}>
      {!embedded && (
        <div className="mb-4">
          <div className="flex items-center gap-2 text-lg font-bold text-theme-text">
            <Sparkles size={20} className="text-curi-pink" />
            Animated Characters
          </div>
          <p className="text-sm text-theme-muted/60 mt-1">
            Browse glossy 3D mascots or create talking videos with voice
          </p>
        </div>
      )}

      <div className="flex gap-1 p-1 rounded-xl bg-theme-subtle/5 border border-theme-border">
        <button
          type="button"
          onClick={() => setMode('browse')}
          className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${
            mode === 'browse' ? 'bg-curi-pink text-white' : 'text-theme-muted/60'
          }`}
        >
          <Grid3X3 size={12} /> Browse
        </button>
        <button
          type="button"
          onClick={() => setMode('talk')}
          className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${
            mode === 'talk' ? 'bg-curi-blue text-white' : 'text-theme-muted/60'
          }`}
        >
          <Mic size={12} /> Talking Studio
        </button>
      </div>

      {mode === 'talk' ? (
        <TalkingCharacterStudio
          workspaceId={workspaceId}
          initialCharacter={talkTarget}
          onAddToCanvas={onTalkingCharacter}
        />
      ) : (
        <>
          <div className="relative mb-2">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-theme-muted/40" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search 3D mascots, blobs, stickers…"
              className="input w-full pl-8 py-1.5 text-xs"
            />
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {CHARACTER_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`px-2 py-1 rounded-full text-[10px] font-bold transition-all ${
                  category === cat.id
                    ? 'bg-curi-pink text-white'
                    : 'bg-theme-subtle/5 text-theme-muted/60 hover:text-theme-text'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="text-center py-8 text-theme-muted/50 text-xs">No characters match your search.</p>
          ) : (
            <>
              <p className="text-[10px] text-theme-muted/50 mb-2">
                {filtered.length} character{filtered.length === 1 ? '' : 's'}
                {category === 'mascots' ? ' · glossy 3D style' : ''}
              </p>
              <div className={`grid gap-2 ${embedded ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3'}`}>
                {filtered.map((character) => (
                  <button
                    key={character.id}
                    type="button"
                    onClick={() => handleCharacterClick(character)}
                    title={character.name}
                    className={`group relative aspect-square rounded-lg overflow-hidden border-2 border-theme-border hover:border-curi-pink/50 hover:scale-[1.02] transition-all ${
                      character.style === '3d'
                        ? 'bg-gradient-to-br from-pink-100/80 via-pink-50/40 to-blue-50/40 dark:from-pink-900/20 dark:via-theme-subtle/10 dark:to-blue-900/10'
                        : 'bg-theme-subtle/5'
                    }`}
                  >
                    <img
                      src={character.previewUrl}
                      alt={character.name}
                      className="w-full h-full object-contain p-1.5"
                      loading="lazy"
                    />
                    {character.style === '3d' ? (
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-curi-blue/90 text-white text-[8px] font-bold uppercase">
                        3D
                      </span>
                    ) : character.animated ? (
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-curi-pink/90 text-white text-[8px] font-bold uppercase">
                        GIF
                      </span>
                    ) : null}
                    {character.style === '3d' && (
                      <span className="absolute top-1 right-1 p-0.5 rounded bg-curi-green/90 text-white" title="Can speak in Talking Studio">
                        <Mic size={8} />
                      </span>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 pt-6 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-white text-[9px] font-bold leading-tight block truncate">{character.name}</span>
                    </div>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setMode('talk')}
                className="btn-secondary w-full text-xs py-2 mt-2 flex items-center justify-center gap-1.5"
              >
                <Mic size={14} /> Make a talking video
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}
