# Fonts

Self-hosted so no visitor request goes to Google before consent, and so the page has no
render-blocking third-party stylesheet.

| Family | Weights | Source | License |
|---|---|---|---|
| Inter | 400, 500, 600 (latin) | @fontsource/inter 5.x | SIL Open Font License 1.1 |
| JetBrains Mono | 400, 500 (latin) | @fontsource/jetbrains-mono 5.x | SIL Open Font License 1.1 |
| Space Grotesk | 600, 700 (latin) | @fontsource/space-grotesk 5.x | SIL Open Font License 1.1 |

OFL 1.1 allows bundling and redistribution with the site. Full text: https://openfontlicense.org
To update, `npm i @fontsource/inter @fontsource/jetbrains-mono @fontsource/space-grotesk`
in a scratch folder and copy the `*-latin-<weight>-normal.woff2` files from each package's `files/` folder.
