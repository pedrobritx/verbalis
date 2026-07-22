const XML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
}

export function escapeXml(s: string): string {
  // Strip XML 1.0 invalid control chars (except tab, LF, CR) — matching them is
  // the whole point here.
  // eslint-disable-next-line no-control-regex
  const cleaned = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
  return cleaned.replace(/[&<>"']/g, (c) => XML_ESCAPE[c])
}

export function getXmlLang(el: Element): string | null {
  return (
    el.getAttribute('xml:lang') ??
    el.getAttributeNS('http://www.w3.org/XML/1998/namespace', 'lang') ??
    el.getAttribute('lang')
  )
}
