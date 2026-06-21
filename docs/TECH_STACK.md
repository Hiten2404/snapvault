# SnapVault — Tech Stack & Architecture Document

This document outlines the libraries, tools, database structures, and feature-based folder hierarchy used to build SnapVault.

---

## 🛠️ Tech Stack Choices

### 1. Framework & Core
* **Next.js 15+ (App Router)**: Client-side routing, static pages, and Turbopack compiler.
* **React 19**: Modern state management and component rendering.
* **TypeScript (Strict Mode)**: Type safety across file entries, settings, database records, and import metrics.

### 2. Styling & UI Design
* **Tailwind CSS v4**: Utility classes and theme customization.
* **Lucide React**: Modern, clean iconography.
* **Google Fonts (Inter)**: Typography.
* **Custom CSS Variables**: Handles dark-mode defaults and custom scrollbars.

### 3. Local Storage (IndexedDB)
* **IndexedDB API**: Native browser transaction-based key-value store, supporting multi-gigabyte binary BLOB storage directly in client sandboxes. No cloud or backend database.

### 4. File Processing & Metadata Injection
* **JSZip**: Asynchronous ZIP reader and packer.
* **piexifjs**: Local JPEG binary modifier. Parses and injects EXIF headers (`DateTimeOriginal` and GPS coordinates) in the browser.

---

## 💾 Database Architecture

To handle huge folders (e.g. 5,000+ files) without crashing the browser's memory, the database is split into two separate object stores in IndexedDB under `snapvault_db` (version 2):

### 1. `memories` Store
Holds metadata index records and small gallery thumbnails. Loaded fully on index queries.
```typescript
interface SnapchatMemory {
  id: string; // SHA-256 + '_main' or '_combined'
  filename: string;
  type: 'photo' | 'video';
  dateTaken: string; // ISO date format
  location: { lat: number; lng: number } | null;
  thumbnailBlob: Blob | null; // Max 300px JPEG thumbnail
  isFavorite: boolean;
  sha256: string;
  size: number; // File size in bytes
  resolution: string | null;
  originalFilename: string;
  isCombined: boolean;
  metadataRepaired: boolean;
}
```
* **Indexes**: `dateTaken`, `sha256`, `isFavorite`.

### 2. `media_content` Store
Holds the raw original high-resolution media binaries. **Only loaded on-demand** when the user opens the lightbox detail view or exports files.
```typescript
interface MediaContent {
  id: string; // Matches memory id
  mediaBlob: Blob; // Original raw JPEG, PNG, MP4, or MOV file
}
```

---

## 🔒 Browser Native APIs Used

* **Web Crypto API (`crypto.subtle.digest`)**: Computes SHA-256 hashes of file buffers directly in browser threads, achieving high-performance deduplication.
* **HTML5 Canvas**: Dynamically resizes images and captures video frames (seeking to 1.0s) to create JPEG thumbnails client-side.
* **URL.createObjectURL**: Creates local memory addresses for Blobs to display in `<img>` and `<video>` tags or trigger single file downloads, with automatic memory cleanups (revocations) on unmount.
* **Directory Upload API (`webkitdirectory`)**: Scans unzipped folder file structures recursively, bypassing the browser's 2GB maximum contiguous buffer lock limit.

---

## 📁 Project Directory Structure

We use a feature-based architecture underneath the Next.js `src/` directory to keep features isolated, reusable, and structured:

```text
src/
├── app/                              # Next.js App Router Page Tree
│   ├── api/auth/[...nextauth]/       # NextAuth API configuration
│   ├── login/                        # Login View Page
│   ├── globals.css                   # Global CSS, scrollbars & glassmorphism styling
│   ├── layout.tsx                    # Root Layout wrapper
│   ├── page.tsx                      # Root Page router & sidebar container
│   └── providers.tsx                 # QueryClient & Session Client Providers
│
├── components/                       # Shared Global Components
│   ├── Sidebar.tsx                   # Main Sidebar tab navigations
│   └── ThumbnailImage.tsx            # Memory-safe Blob thumbnail renderer
│
├── features/                         # Feature Modules
│   ├── dashboard/                    # Overview Analytics
│   │   └── components/Dashboard.tsx  # Stat metric cards & empty import prompt
│   │
│   ├── import/                       # Ingestion Wizards
│   │   ├── components/ImportModal.tsx# Folders/ZIP pickers and progress states
│   │   └── services/zipProcessor.ts  # ZIP and Folder processing logic
│   │
│   ├── gallery/                      # Image & Video Galleries
│   │   ├── components/MemoryGallery.tsx # Groups display (Year/Month/Grid)
│   │   └── components/MemoryDetail.tsx  # Lightbox viewer, metadata editor, single downloader
│   │
│   ├── timeline/                     # Chronological Timeline
│   │   └── components/TimelineView.tsx # Index tree sidebar links
│   │
│   ├── duplicates/                   # Duplicate Cleanup
│   │   └── components/DuplicateManager.tsx # Side-by-side matches and deletion triggers
│   │
│   ├── downloads/                    # Bulk Export
│   │   └── components/DownloadManager.tsx # ZIP packers (by Year, Month, selections)
│   │
│   └── metadata/                     # EXIF repair helpers
│       └── utils/exifRepair.ts       # piexifjs JPEG modifiers
│
├── hooks/                            # Custom React Hooks
│   ├── useMemories.ts                # React Query hooks for getMemories, stats & edits
│   └── useDuplicates.ts              # React Query hooks for duplicate checks & deletions
│
├── services/                         # Global Database Services
│   └── indexedDB.ts                  # Split schema IndexedDB CRUD transactions
│
├── types/                            # Type Definitions
│   └── index.ts                      # Interfaces for SnapchatMemory, UserSettings, etc.
│
└── utils/                            # Shared Utilities
    └── thumbnail.ts                  # HTML5 Canvas image/video thumbnail drawers
```
