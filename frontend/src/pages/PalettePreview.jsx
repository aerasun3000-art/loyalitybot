function Swatch({ title, surface, border, heading, accent, secondary }) {
  return (
    <div className="rounded-2xl p-4 shadow-lg border mb-6" style={{ backgroundColor: surface, borderColor: border }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold" style={{ color: heading }}>{title}</h3>
        <span className="text-xs px-2 py-0.5 rounded-md" style={{ backgroundColor: accent, color: '#FFF' }}>accent</span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="space-y-1">
          <div className="font-medium" style={{ color: heading }}>Заголовок</div>
          <div style={{ color: secondary }}>Вторичный текст / описание</div>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 rounded-lg text-sm font-semibold shadow" style={{ backgroundColor: accent, color: '#FFF' }}>Кнопка</button>
          <button className="px-3 py-1.5 rounded-lg text-sm font-semibold border" style={{ color: accent, borderColor: border }}>Гостевая</button>
        </div>
      </div>
    </div>
  )
}

function PalettePreview() {
  return (
    <div className="min-h-screen p-4" style={{ background: 'linear-gradient(180deg, #8B008B 0%, #FF69B4 60%, #FFC0CB 100%)' }}>
      <h1 className="text-2xl font-bold text-white mb-4">Предпросмотр палитр</h1>

      <Swatch
        title="1) Blush Cream"
        surface="#FFF6F9"
        border="#F8C9DF"
        heading="#7C155A"
        accent="#D84E9C"
        secondary="#7A7A7A"
      />

      <Swatch
        title="2) Porcelain White"
        surface="#FFFFFF"
        border="#F3B9D3"
        heading="#6C0F53"
        accent="#E24AA6"
        secondary="#6E6E6E"
      />

      <Swatch
        title="3) Rose Champagne"
        surface="#FFF3E9"
        border="#EFBAC7"
        heading="#7A1D4E"
        accent="#DF3F8F"
        secondary="#6B6B6B"
      />

      <Swatch
        title="4) Vanilla Blush"
        surface="#FCF7F2"
        border="#F1C9DA"
        heading="#6E104A"
        accent="#D5408B"
        secondary="#707070"
      />

      <Swatch
        title="5) White Glass (glassmorphism)"
        surface="rgba(255,255,255,0.75)"
        border="rgba(216,78,156,0.25)"
        heading="#6E0F49"
        accent="#D84E9C"
        secondary="#6F6F6F"
      />
    </div>
  )
}

export default PalettePreview










