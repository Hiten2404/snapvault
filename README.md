# SnapVault 📸🔒

SnapVault is a production-quality, local-first Next.js web application designed to help you restore, organize, browse, manage, and export your Snapchat Memories from a Snapchat Data Export ZIP file. 

Snapchat exports do not preserve image metadata (EXIF headers) properly and are notoriously difficult to browse outside the Snapchat app. SnapVault solves this by repairing media metadata directly in your browser, detecting duplicate files, and providing a gorgeous, fluid timeline view with selective download options.

---

## ✨ Key Features

*   **🔒 100% Privacy-First & Local-First**: All processing, ZIP decompression, EXIF metadata repairs, and file storage happen entirely inside your web browser using **IndexedDB**. Your photos and videos are **never** uploaded to a server.
*   **🛠️ EXIF Metadata Repair**: Automatically reads Snapchat metadata records and reconstructs GPS coordinates and creation timestamps (DateTimeOriginal) back into your JPEG images using `piexifjs` during downloads.
*   **🖼️ Timeline-Based Gallery**: A virtualized chronological photo gallery (Google Photos / Apple Photos grid layout) with a collapsible nested timeline tree sidebar (`Year -> Month`) for smooth navigation.
*   **🎯 Global Selective Download**: Enter "Select Mode" directly in your memories gallery to toggle thumbnails and download a custom ZIP archive of only your selected files via a sticky floating action footer.
*   **👯 Duplicate detection**: Automatically hashes your media using SHA-256 on ingestion, clusters duplicates side-by-side, and offers one-click cleanups to save local disk space.
*   **⚡ Optimized Performance**: Implements a split database architecture that stores metadata separately from raw heavy media binaries, keeping catalog browsing and infinite scroll smooth and responsive.
*   **🧪 Local Sandbox Mode**: Bypass Google authentication/NextAuth setup completely to run and test the app fully offline.

---

## 🧭 How It Works (User Flow)

1.  **Enter the Vault**: Log in using **Local Sandbox Mode** for immediate offline access, or authenticate via Google Login.
2.  **Ingest your Snapchat Data**: 
    *   For smaller archives, drag-and-drop your Snapchat export `.zip` archive.
    *   For large archives (>2GB), upload the extracted Snapchat directory directly via the folder selector to avoid browser memory crash limits.
3.  **Process & Repair**: SnapVault parses `memories_history.html`, matches media files, generates thumbnails, hashes files, and commits them to IndexedDB.
4.  **Browse & Manage**: Navigate through your Timeline index, toggle favorites, edit metadata tags, or clear duplicate packages.
5.  **Export on your terms**: Download your entire archive, specific years, specific months, or a custom selection of images/videos with fully repaired EXIF headers.

---

## 🚀 Running SnapVault Locally

Follow these steps to set up and run SnapVault on your machine:

### Prerequisites

Make sure you have Node.js (version 18+ recommended) installed on your system.

### Setup Instructions

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/Hiten2404/snapvault.git
    cd snapvault
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Configure Environment Variables (Optional)**:
    Create a `.env.local` file in the root directory if you wish to configure Google Auth:
    ```env
    NEXTAUTH_URL=http://localhost:3000
    NEXTAUTH_SECRET=your_random_secret_string
    GOOGLE_CLIENT_ID=your_google_client_id
    GOOGLE_CLIENT_SECRET=your_google_client_secret
    ```
    *Note: You do not need to configure these to run the application. You can simply use the **Local Sandbox Mode (Bypass)** on the login screen to run offline.*

4.  **Start the Development Server**:
    ```bash
    npm run dev
    ```

5.  **Launch the App**:
    Open your browser and navigate to **[http://localhost:3000](http://localhost:3000)**. 
    Click the **Local Sandbox Mode** button, trigger an import, and enjoy your restored memories archive!
