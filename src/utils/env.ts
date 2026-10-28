// true im GitHub-Pages-Build (reines Frontend, kein Server). Wird in .github/workflows/pages.yml gesetzt.
export const IS_STATIC = import.meta.env.VITE_STATIC === 'true';
