# Student Document Chat - Frontend Demo

This is a simple frontend-only demo that lets a student login, upload PDF or image documents, and ask questions about the uploaded content. It uses PDF.js to extract text from PDFs and Tesseract.js for OCR on images. Everything is stored locally in your browser (localStorage).

Files added:
- `index.html` - main UI
- `styles.css` - styling with transparent panels over a books background
- `app.js` - client-side logic for login, file parsing, chat, and storage

How to run:
1. Open `index.html` in a modern browser (Chrome/Edge/Firefox).
2. Create a username and password. Data is stored locally in your browser.
3. Upload PDF(s) or image(s). Wait for extraction to finish.
4. Ask questions in the chat box. The frontend will search the extracted text and return relevant excerpts.

Notes and limitations:
- This demo runs entirely in the browser. No server or backend is included.
- OCR on images may be slow depending on CPU.
- PDF.js and Tesseract.js are included via CDN in `index.html`.
- Security: passwords are stored in localStorage in plaintext for demo purposes — do NOT use for real authentication.
