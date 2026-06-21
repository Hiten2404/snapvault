# SnapVault — Product Concept & User Flow

SnapVault is a private, local-first web application designed to help users restore, organize, browse, manage, and export Snapchat Memories from standard Snapchat Data Export files. 

---

## 💡 The Core Concept

### The Problem
When you request a data download from Snapchat, the export format is poorly optimized for archiving or browsing outside the Snapchat app:
1. **Stripped Metadata**: The media files (images and videos) are stripped of their creation dates and GPS coordinates in the file headers.
2. **Separated Index**: The actual timestamps and GPS locations are stored separately inside a single `memories_history.html` (or `.json`) index file.
3. **Double File Wrappers**: The export frequently bundles duplicates of edited memories as separate files (e.g. `image-main.jpg` and `image-combined.jpg`), cluttering folders.
4. **Poor Browsability**: Browsing raw file lists is out of chronological order, lacks map links, and relies on Snapchat CDN links which expire.

### The Solution
SnapVault solves this by acting as a **local-first, browser-based metadata repair shop and media gallery** (similar to a private Google Photos or Apple Photos instance specifically tuned for Snapchat exports). 

All processing, parsing, EXIF injection, and database indexing occur **directly inside the user's browser**. No media files or credential tokens are ever uploaded to a server, ensuring 100% privacy.

---

## 🛠️ Main Features

* **ZIP & Folder Uploader**: Drag-and-drop a ZIP archive (for exports <2GB) or upload the unzipped Snapchat Export folder directly (via HTML5 folder selector) to bypass browser contiguous memory limits on files up to 50GB.
* **Metadata Repair Engine**: Automatically matches media files with their records in the Snapchat HTML/JSON log. Injects EXIF tags (`DateTimeOriginal` and GPS coordinates) directly into JPEG files on the fly.
* **Timeline-Based Gallery**: Group memories by Year, Month, or scroll a chronological Grid. Navigate using an interactive Year/Month tree index sidebar.
* **Detail Lightbox**: Double-click a memory to inspect dimensions, metadata, GPS positions, edit date/coordinates, download, favorite, or delete.
* **Deduplication Manager**: Scans files using SHA-256 hashes to group exact duplicates, displaying space savings and allowing users to select and delete duplicates while keeping a preferred copy.
* **ZIP Exporter**: Create customized bulk ZIP downloads (export by Year, Month, or current selection). All exported JPEGs include your latest metadata edits written directly in the file headers.

---

## 🔄 User Flow

The application design coordinates a seamless, linear transition from initial landing to fully browsing the vault:

```mermaid
graph TD
    A[User Land: Login Page] --> B{Choose Auth Mode}
    B -- Google Sign-In --> C[OAuth Authorization]
    B -- Sandbox Bypass --> D[Instant Local Profile]
    C --> E[Empty Dashboard]
    D --> E
    E --> F[Open Import Wizard]
    F --> G{Select Input Source}
    G -- Upload ZIP Archive --> H[JSZip Unpacking]
    G -- Select Folder --> I[HTML5 Directory Scan]
    H --> J[Read memories_history.html]
    I --> J
    J --> K[Match files by timestamp / filename]
    K --> L[Inject EXIF Tags into JPEGs]
    L --> M[Generate Canvas Thumbnails]
    M --> N[Save split: Metadata -> memories | Blobs -> media]
    N --> O[Dashboard Populated with Stats]
    O --> P[Browse Chronological Timeline Tree]
    O --> Q[Clean Duplicates via SHA-256]
    O --> R[Custom ZIP Exports with EXIF]
```

### Step 1: Authentication
- The user lands on a secure login screen.
- They choose to authorize via **Google Login** (to fetch their name/avatar profile picture) or **Local Sandbox Mode** (to bypass all network handshakes and work fully offline).

### Step 2: Import Source Selection
- The user triggers the Import Modal. 
- For small exports, they select the **ZIP File** option.
- For large exports (>1GB), they select the **Unzipped Folder** option (which allows selecting the extracted Snapchat folder directly, saving RAM and avoiding browser crash limits).

### Step 3: Local Processing (Browser Threads)
- The app scans the files and locates the metadata log.
- It maps the records, filters out duplicate wrappers according to user configuration (keep main, combined, or both), repairs EXIF headers, generates thumbnails, and saves them in batches to IndexedDB.

### Step 4: Storage Allocation
- Heavy media binaries are written to a separate `media_content` store in IndexedDB.
- Metadata and thumbnails are saved to the `memories` store, maintaining a fast loading index.

### Step 5: Explore & Manage
- The user browses their memories chronologically, filters by type or favorites, and uses the Sidebar Timeline index to skip directly to specific dates.
- They inspect duplicate groups, bulk-delete matching hash copies, and download customized packages.
