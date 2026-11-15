# Supported File Types

`pagedex` previews and serves files based on extension and view mode (`Preview`, `Edit`, `Diff`, `Raw`, plus `Download` in the top-right options menu).

| Type | Extensions | Preview Mode | Raw / Edit | Search Indexed |
|---|---|---|---|---|
| **Markdown** | `.md`, `.markdown`, `.mdx` | Rendered HTML, wikilinks, backlinks, outline | WYSIWYG (`TiptapEditor`), Raw, Diff | Yes (FTS5) |
| **HTML** | `.html`, `.htm` | Sandboxed `<iframe src="/raw/...">` | Syntax-highlighted XML/HTML | Yes |
| **PDF** | `.pdf` | Built-in browser PDF `<iframe>` + Download | — | No |
| **Audio** | `.mp3`, `.wav`, `.m4a`, `.ogg` | `<audio controls>` with HTTP `Range` seeking | — | No |
| **Video** | `.mp4`, `.webm`, `.mov` | `<video controls>` with HTTP `Range` seeking | — | No |
| **Tables** | `.csv`, `.tsv` | Styled HTML `<table>` | Raw text | Yes |
| **Images** | `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.ico` | Inline `<img>` | — | No |
| **SVG** | `.svg` | Inline `<img>` | Raw XML toggle | No |
| **Text / Code** | `.txt`, `.js`, `.ts`, `.py`, `.json`, etc. | Syntax-highlighted raw view | Raw / Diff | Yes (≤ 2 MB) |
| **Other Binaries** | `.epub`, `.zip`, `.docx`, `.sqlite`, `.db`, etc. | Download card | — | No |

## HTML + Sibling Files (`style.css`, `data.json`, `app.js`)

HTML files in Preview mode are loaded from `/raw/<path>` rather than `srcDoc`, so relative paths inside your HTML resolve naturally against the same folder:

```html
<link rel="stylesheet" href="style.css" />
<script src="app.js"></script>
```

```js
fetch('data.json').then((r) => r.json())
```
