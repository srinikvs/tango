# Tango v1.0.2

Daily 6×6 sun-and-moon logic puzzle from Playadda. Fill every cell with a sun or a moon. Each row and column holds three of each. Never place three identical tokens in a line. `=` means match; `×` means differ.

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173/tango/`).

```bash
npx tsc -b
npm run build
npm run preview
```

Production assets are built with base `/tango/` to match the Playadda path `https://tessera-veera.duckdns.org/tango/`.

Serve the SPA so client paths do not 404:

```nginx
location /tango/ {
    try_files $uri $uri/ /tango/index.html;
}
```

## Play

1. Tap a cell to cycle empty → sun → moon. Hold or right-click to cycle back.
2. Each row and column must have three suns and three moons.
3. Never place three of the same token in a row or column.
4. `=` pairs must match. `×` pairs must differ.
5. Today is the daily board. Easy / Medium / Hard start a practice puzzle.

Streak, best time, and an in-progress daily are saved in `localStorage`. Refreshing `/tango/` resumes the board.

## Stack

- Vite + React 19 + TypeScript
- Procedural daily generator (deterministic per UTC date)
- Procedural SFX (Web Audio)

## License

Use and modify freely for personal or commercial projects.
