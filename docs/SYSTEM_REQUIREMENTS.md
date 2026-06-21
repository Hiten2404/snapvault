# SnapVault — System Requirements Document (SRS)

This document specifies the functional and non-functional requirements for the SnapVault Snapchat Memories restoration application.

---

## 📋 Functional Requirements

### 1. User Authentication & Authorization
* **FR-1.1**: The system MUST support user authentication via Google OAuth 2.0.
* **FR-1.2**: The system MUST support a "Local Sandbox Mode" developer bypass, which creates a mock session with generic profile details, allowing complete offline use.
* **FR-1.3**: The authentication state MUST be maintained across session restarts using local secure JSON Web Tokens (JWT) handled client-side.

### 2. Data Import & Ingestion System
* **FR-2.1**: The system MUST support importing standard Snapchat Data Export ZIP files.
* **FR-2.2**: The system MUST support importing unzipped Snapchat Data folders using HTML5 `webkitdirectory` selection.
* **FR-2.3**: The system MUST auto-detect and parse `memories_history.html` (primary index) or `memories_history.json` (fallback index).
* **FR-2.4**: The system MUST match HTML/JSON metadata entries to physical media files based on matching filename strings or timestamp proximity (within a 10-second margin of error).
* **FR-2.5**: The system MUST support filtering original vs combined versions during import (Keep Both, Originals Only, Combined Only).

### 3. Metadata Repair Engine
* **FR-3.1**: The system MUST parse GPS coordinates and timestamps from Snapchat HTML/JSON logs.
* **FR-3.2**: The system MUST write EXIF tags (`DateTime` and `DateTimeOriginal`) into the binary headers of JPEG files based on the parsed dates.
* **FR-3.3**: The system MUST write GPS rational coordinate tags (`GPSLatitude`, `GPSLatitudeRef`, `GPSLongitude`, `GPSLongitudeRef`) into JPEG headers if location coordinates are available in the log.
* **FR-3.4**: If GPS data is missing, the system MUST leave EXIF GPS headers empty (N/A) and must NEVER estimate or infer coordinates.

### 4. Media Storage & Gallery View
* **FR-4.1**: The system MUST save all media files locally in the browser's IndexedDB.
* **FR-4.2**: The system MUST generate and store smaller thumbnail representations (JPEG, max 300px bounding box) for all images and videos to accelerate gallery rendering.
* **FR-4.3**: The system MUST support browsing media grouped in "Year View", "Month View", or "Grid View".
* **FR-4.4**: The system MUST support client-side filtering by media type (All, Photos, Videos), favorites status, and search queries (date, year, month, or filename).

### 5. Chronological Timeline Navigator
* **FR-5.1**: The system MUST render an interactive hierarchical Tree navigator listing `Years -> Months`.
* **FR-5.2**: Clicking a year or month in the tree index MUST filter the active memories gallery accordingly.

### 6. Duplicate Detection & Cleanup
* **FR-6.1**: The system MUST compute SHA-256 hashes of all imported file binaries using the Web Crypto API.
* **FR-6.2**: The system MUST identify and group files sharing identical SHA-256 hashes.
* **FR-6.3**: The system MUST display duplicate groups side-by-side and provide options to select individual items or execute a "Keep Preferred Copy" shortcut.
* **FR-6.4**: The system MUST dynamically calculate and display potential storage savings in MB/GB before deletion.

### 7. Export & Downloads
* **FR-7.1**: The system MUST support single-file downloads.
* **FR-7.2**: The system MUST support packing multiple selected files into a ZIP archive on the fly inside the browser.
* **FR-7.3**: The export system MUST support archiving by Year, Month, or full vault.
* **FR-7.4**: JPEGs downloaded or exported MUST contain the latest timestamp or location modifications written inside their headers.

---

## ⚙️ Non-Functional Requirements

### 1. Performance & Scalability
* **NFR-1.1 (Memory Capacity)**: The system MUST support indexing and rendering catalogs of **5,000+ memories** smoothly.
* **NFR-1.2 (Lazy Loading)**: Gallery images and videos MUST load progressively (lazy loading) to prevent layout shifts.
* **NFR-1.3 (UI Virtualization)**: The gallery MUST utilize list pagination or chunked loading (rendering chunks of 60 items as the user scrolls) to prevent DOM exhaustion and maintain 60 FPS scrolling.
* **NFR-1.4 (Asynchronous Indexing)**: Ingestion tasks MUST save records to IndexedDB in batches of 10 items, yielding execution to the browser thread to prevent page freezing.

### 2. Privacy & Security
* **NFR-2.1 (Local Isolation)**: 100% of processing and database writes MUST occur in the local browser context. No backend database or cloud media processing is allowed.
* **NFR-2.2 (Data Retention)**: Clear database options in Settings MUST fully purge all tables in IndexedDB, leaving no residues.

### 3. Browser Compatibility
* **NFR-3.1 (Required HTML5 APIs)**: The browser MUST support the following APIs:
  * **IndexedDB v2** (For large binary BLOB storage)
  * **Web Crypto API** (SubtleCrypto for fast SHA-256 computation)
  * **Directory Selection API** (`webkitdirectory` for unzipped folders)
  * **Canvas API** (For thumbnail resizing)
  * **URL.createObjectURL** (For binary blob element attachments)
