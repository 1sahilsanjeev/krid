# Krid

Krid is a powerful, browser-based data exploration and spreadsheet-like tool designed for speed, flexibility, and privacy.

## Features

- **Fast Data Engine**: Powered by DuckDB WASM for high-performance analytical queries.
- **Privacy-First**: All data processing stays local in your browser. No servers store your files.
- **AI-Assisted**: Use natural language to filter, sort, and transform your data.
- **Fluid UI**: Modern, glassmorphism-inspired design with a focus on usability.
- **Local Persistence**: Integrated IndexedDB storage keeps your workspace saved across sessions.

## Getting Started

1. **Install dependencies**: `npm install`
2. **Launch dev server**: `npm run dev`
3. **Build for production**: `npm run build`

## Tech Stack

- **Framework**: React 19 + TypeScript + Vite
- **Data Engine**: DuckDB WASM
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Persistence**: Zustand + IndexedDB
