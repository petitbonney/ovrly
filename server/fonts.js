// Google Fonts families for the font field's suggestions, most popular first. Read from the list fonts.google.com
// itself uses (no API key, but unofficial), once per server run; a failed fetch is tried again next time.
let families
export function list() {
  families ??= fetch('https://fonts.google.com/metadata/fonts').then(async (res) => {
    if (!res.ok) throw new Error(`Google Fonts answered ${res.status}`)
    const { familyMetadataList } = await res.json()
    return familyMetadataList.sort((a, b) => a.popularity - b.popularity).map((f) => f.family)
  })
  return families.catch((err) => {
    families = undefined
    throw err
  })
}
