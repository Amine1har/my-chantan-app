// Chantan JSX source tagger — Babel plugin (2026-08-04, PLAN_element_editor_pro).
//
// Stamps every JSX opening element with `data-chantan-src="relPath:LINE:COL"`
// (1-based line, 0-based col — the exact contract services/elementEdit.ts reads)
// so the preview overlay can trace a clicked element back to its source line.
// Adds `data-chantan-text="static"` when the element's children are a single
// static text node (safe to edit inline). DEV ONLY — the wrapper config applies
// this plugin only when mode !== 'production', so published builds are untouched
// and carry zero tagging overhead.
//
// Runs inside @vitejs/plugin-react's Babel pass:
//   react({ babel: { plugins: [[chantanTagger, { root: process.cwd() }]] } })
//
// Deliberately minimal + defensive: it never fails a build (skips anything it
// can't tag), never tags platform/generated components, and is idempotent.

import path from 'node:path'

const SKIP_TAGS = new Set(['Fragment', 'React.Fragment'])
const ATTR_SRC = 'data-chantan-src'
const ATTR_TEXT = 'data-chantan-text'

export default function chantanTagger(babel) {
  const { types: t } = babel
  return {
    name: 'chantan-tagger',
    visitor: {
      JSXOpeningElement(nodePath, state) {
        const node = nodePath.node
        if (!node.loc) return
        // Tag host elements (div/h1/img/…), named components AND member
        // expressions. Member expressions are the load-bearing case: generated
        // sites wrap nearly every headline/hero in `motion.h1` / `motion.div`
        // (framer-motion), which forwards unknown props straight to the DOM.
        // Skipping them left whole animated sections untaggable — the hero was
        // simply not clickable. Components that DON'T forward props just drop
        // the attribute, which is harmless.
        const nameNode = node.name
        let name = ''
        if (t.isJSXIdentifier(nameNode)) name = nameNode.name
        else if (t.isJSXMemberExpression(nameNode)) {
          const parts = []
          let cur = nameNode
          while (t.isJSXMemberExpression(cur)) { parts.unshift(cur.property.name); cur = cur.object }
          if (!t.isJSXIdentifier(cur)) return
          parts.unshift(cur.name)
          name = parts.join('.')
        }
        else return
        if (SKIP_TAGS.has(name)) return
        // Idempotent: never double-stamp.
        if (node.attributes.some(a => t.isJSXAttribute(a) && a.name && a.name.name === ATTR_SRC)) return

        const filename = state.filename || (state.file && state.file.opts && state.file.opts.filename) || ''
        const root = (state.opts && state.opts.root) || process.cwd()
        let rel = filename ? path.relative(root, filename) : ''
        rel = rel.split(path.sep).join('/')
        // Only tag project source under src/ (skip node_modules, virtual, etc).
        if (!rel || rel.startsWith('..') || !rel.startsWith('src/')) return
        if (!/\.(jsx|tsx)$/.test(rel)) return

        const line = node.loc.start.line
        const col = node.loc.start.column
        node.attributes.push(
          t.jsxAttribute(t.jsxIdentifier(ATTR_SRC), t.stringLiteral(`${rel}:${line}:${col}`)),
        )

        // Static-text marker: the parent element's children are exactly one
        // JSXText node (whitespace-trimmed non-empty). Lets the overlay enable
        // inline text editing only where the apply engine can safely act.
        const el = nodePath.parent
        if (t.isJSXElement(el)) {
          const kids = el.children.filter(c => !(t.isJSXText(c) && !c.value.trim()))
          if (kids.length === 1 && t.isJSXText(kids[0])) {
            node.attributes.push(
              t.jsxAttribute(t.jsxIdentifier(ATTR_TEXT), t.stringLiteral('static')),
            )
          }
        }
      },
    },
  }
}
