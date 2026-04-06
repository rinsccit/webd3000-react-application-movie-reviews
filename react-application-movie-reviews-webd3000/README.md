# MovieReviews Frontend (WEBD3000)

## Project purpose
This project is a React web application that lets people:

- browse movies,
- open an individual movie page,
- read published critic reviews,
- and search with highlighted matches.

The application connects to a C# A.P.I through the `/api` proxy configured in Vite.

## How to run the project

1. Install packages:

```bash
npm install
```

2. Start development mode:

```bash
npm run dev
```

3. Create a production build:

```bash
npm run build
```

## File-by-file guide (plain language)

- `src/main.tsx`: Starts React and mounts the application into the H.T.M.L webpage.
- `src/App.tsx`: Contains routing, shared layout, homepage logic, movie details logic and search/highlighting behaviour.
- `src/services/movieApi.ts`: Handles A.P.I calls, normalizes payloads and provides review debug helpers.
- `src/types/Movie.ts`: Defines the movie data shape used by the interface.
- `src/types/Review.ts`: Defines the review data shape used by the interface.
- `src/index.css`: Main visual style rules and animation helpers.
- `index.html`: Basic H.T.M.L shell where React mounts.
- `vite.config.ts`: Development server settings and A.P.I proxy rules.
- `eslint.config.js`: Code-quality and linting rules.
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`: TypeScript safety rules for application code and tooling.
- `.gitignore`: Files that should stay local and not be committed.

## Notes about comments and machine-generated files

- This project now includes explanatory comments in source and configuration files that support comments.
- `package.json` and `package-lock.json` are strict J.S.O.N files so comment syntax is not valid there.
