// PDF export functionality
import { getEditorHtml } from './editor.js';
import { escapeHtml } from './utils.js';

const PRINT_DOCUMENT_STYLES = `
    :root {
        color-scheme: light;
        --print-ink: #1d1d1f;
        --print-muted: #6e6e73;
        --print-accent: #2b5e9b;
        --print-rule: #d9dde3;
        --print-code-bg: #f5f5f7;
        --print-code-border: #d5d7dc;
    }

    * {
        box-sizing: border-box;
    }

    html {
        background: #e9edf2;
    }

    body {
        margin: 0;
        background: #e9edf2;
        color: var(--print-ink);
        font-family: "Georgia", "Times New Roman", serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }

    .print-shell {
        width: 210mm;
        min-height: 297mm;
        margin: 0 auto;
        padding: 18mm 18mm 22mm;
        background: #ffffff;
    }

    .print-title {
        margin: 0 0 6mm;
        padding-bottom: 4mm;
        border-bottom: 0.6mm solid var(--print-rule);
        font-family: "Helvetica Neue", Arial, sans-serif;
        font-size: 22pt;
        font-weight: 700;
        line-height: 1.15;
        letter-spacing: -0.02em;
    }

    .print-content {
        font-size: 12pt;
        line-height: 1.55;
    }

    .print-content > :first-child {
        margin-top: 0;
    }

    .print-content h1,
    .print-content h2,
    .print-content h3,
    .print-content h4,
    .print-content h5,
    .print-content h6 {
        break-after: avoid-page;
        page-break-after: avoid;
        break-inside: avoid;
        page-break-inside: avoid;
        color: var(--print-accent);
        font-family: "Helvetica Neue", Arial, sans-serif;
        font-weight: 700;
        line-height: 1.2;
    }

    .print-content h1 {
        margin: 0 0 4mm;
        font-size: 19pt;
    }

    .print-content h2 {
        margin: 6mm 0 3mm;
        font-size: 16pt;
        font-style: italic;
    }

    .print-content h3 {
        margin: 5mm 0 2.5mm;
        font-size: 13pt;
    }

    .print-content h4,
    .print-content h5,
    .print-content h6 {
        margin: 4mm 0 2mm;
        font-size: 11.5pt;
    }

    .print-content p,
    .print-content ul,
    .print-content ol,
    .print-content pre,
    .print-content blockquote,
    .print-content table {
        margin: 0 0 3.6mm;
    }

    .print-content ul,
    .print-content ol {
        padding-left: 6mm;
    }

    .print-content li {
        margin: 0 0 1.6mm;
    }

    .print-content a {
        color: inherit;
        text-decoration: underline;
        text-decoration-color: #a8b8c9;
    }

    .print-content hr {
        border: 0;
        border-top: 0.5mm solid var(--print-rule);
        margin: 5mm 0;
    }

    .print-content blockquote {
        margin-left: 0;
        padding-left: 5mm;
        border-left: 1mm solid #d6dce3;
        color: #45474d;
    }

    .print-content pre,
    .print-content code {
        font-family: "SFMono-Regular", Menlo, Consolas, monospace;
    }

    .print-content pre {
        padding: 3.5mm 4mm;
        border: 0.4mm solid var(--print-code-border);
        border-radius: 2mm;
        background: var(--print-code-bg);
        font-size: 9.5pt;
        line-height: 1.45;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
    }

    .print-content img,
    .print-content svg,
    .print-content table,
    .print-content pre,
    .print-content blockquote {
        break-inside: avoid;
        page-break-inside: avoid;
        max-width: 100%;
    }

    .print-content img {
        height: auto;
    }

    .print-content table {
        width: 100%;
        border-collapse: collapse;
    }

    .print-content th,
    .print-content td {
        padding: 2.2mm 2.6mm;
        border: 0.3mm solid #d9dde3;
        vertical-align: top;
        text-align: left;
    }

    .print-content .indent-1 { padding-left: 8mm; }
    .print-content .indent-2 { padding-left: 16mm; }
    .print-content .indent-3 { padding-left: 24mm; }
    .print-content .indent-4 { padding-left: 32mm; }

    @page {
        size: A4;
        margin: 14mm;
    }

    @media print {
        html,
        body {
            background: #ffffff;
        }

        .print-shell {
            width: auto;
            min-height: auto;
            margin: 0;
            padding: 0;
        }
    }
`;

export async function exportNoteToPdf() {
    const title = document.getElementById('noteTitle')?.value?.trim() || 'Untitled Note';
    const content = sanitizePrintableHtml(getEditorHtml());

    if (!content || content.trim().length === 0) {
        alert('There is no content to export.');
        return;
    }

    const printableHtml = buildPrintableDocument(title, content);
    openPrintFrame(printableHtml);
}

function buildPrintableDocument(title, content) {
    const escapedTitle = escapeHtml(title);
    const documentTitle = escapeHtml(createFilename(title));
    const baseHref = escapeHtml(window.location.href);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${documentTitle}</title>
    <base href="${baseHref}">
    <style>${PRINT_DOCUMENT_STYLES}</style>
</head>
<body>
    <main class="print-shell">
        <h1 class="print-title">${escapedTitle}</h1>
        <article class="print-content">${content}</article>
    </main>
    <script>
        (() => {
            const waitForImages = () => {
                const images = Array.from(document.images);
                if (images.length === 0) return Promise.resolve();
                return Promise.all(images.map((image) => {
                    if (image.complete) return Promise.resolve();
                    return new Promise((resolve) => {
                        image.addEventListener('load', resolve, { once: true });
                        image.addEventListener('error', resolve, { once: true });
                    });
                }));
            };

            const runPrint = async () => {
                await waitForImages();
                window.focus();
                window.print();
            };

            if (document.readyState === 'complete') {
                runPrint();
            } else {
                window.addEventListener('load', runPrint, { once: true });
            }
        })();
    </script>
</body>
</html>`;
}

function createFilename(title) {
    return (title || 'note')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'note';
}

function sanitizePrintableHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = String(html || '');

    template.content.querySelectorAll('script, style, iframe, object, embed').forEach((node) => {
        node.remove();
    });

    template.content.querySelectorAll('*').forEach((element) => {
        Array.from(element.attributes).forEach((attribute) => {
            const name = attribute.name.toLowerCase();
            const value = attribute.value.trim();

            if (name.startsWith('on')) {
                element.removeAttribute(attribute.name);
                return;
            }

            if ((name === 'href' || name === 'src') && /^javascript:/i.test(value)) {
                element.removeAttribute(attribute.name);
            }
        });
    });

    return template.innerHTML;
}

function openPrintFrame(printableHtml) {
    const existingFrame = document.getElementById('notePdfPrintFrame');
    if (existingFrame) {
        existingFrame.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'notePdfPrintFrame';
    iframe.setAttribute('title', 'PDF print frame');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';

    document.body.appendChild(iframe);

    const cleanup = () => {
        window.setTimeout(() => {
            iframe.remove();
        }, 1000);
    };

    iframe.addEventListener('load', () => {
        const frameWindow = iframe.contentWindow;
        if (!frameWindow) {
            cleanup();
            alert('Failed to open the print view. Please try again.');
            return;
        }

        const handleAfterPrint = () => {
            frameWindow.removeEventListener('afterprint', handleAfterPrint);
            cleanup();
        };

        frameWindow.addEventListener('afterprint', handleAfterPrint);
    }, { once: true });

    const doc = iframe.contentDocument;
    if (!doc) {
        iframe.remove();
        alert('Failed to open the print view. Please try again.');
        return;
    }

    doc.open();
    doc.write(printableHtml);
    doc.close();
}
