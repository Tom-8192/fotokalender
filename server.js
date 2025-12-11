const express = require('express');
const puppeteer = require('puppeteer');
const archiver = require('archiver');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
// Erlaube große Payloads (dein HTML mit Base64 Bildern ist riesig!)
app.use(bodyParser.json({ limit: '50mb' }));
app.use(cors());

// Serve index.html on root
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.post('/generate-calendar', async (req, res) => {
    // 1. Das HTML kommt vom Frontend
    const { htmlContent } = req.body;

    if (!htmlContent) {
        return res.status(400).send('Kein HTML-Inhalt gefunden');
    }

    console.log('🎨 Starte Rendering...');
    
    // Browser starten (Mit Docker-Argumenten)
    const browser = await puppeteer.launch({
        headless: 'new',
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', // Wichtig für Docker Speicher
            '--font-render-hinting=none'
        ]
    });

    try {
        const page = await browser.newPage();
        
        // Hohe Auflösung für Druck (300 DPI Ansatz)
        await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 2 }); // ~A4 Proportionen

        // HTML setzen
        // Timeout erhöhen auf 120 Sekunden für große Payloads (User hat Timeout Fehler bei 60s)
        await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 120000 });

        // CSS Injection für sauberen Druck
        await page.addStyleTag({
            content: `
                .no-print { display: none !important; }
                body { background: transparent !important; }
                .sheet { margin: 0 !important; box-shadow: none !important; background: transparent !important; }
                .transparent-pattern { background: transparent !important; background-image: none !important; }
                .transparent-placeholder-content { display: none !important; }
            `
        });

        // Setup ZIP Stream
        const archive = archiver('zip', { zlib: { level: 9 } });
        res.attachment('Mein_Kalender_2025.zip');
        archive.pipe(res);

        // Die IDs deiner Kalenderblätter
        const sheets = ['sheet-cover'];
        for(let i=0; i<12; i++) sheets.push(`sheet-${i}`);

        // Screenshots machen und ins ZIP packen
        for (const sheetId of sheets) {
            const element = await page.$(`#${sheetId}`);
            if (element) {
                const buffer = await element.screenshot({ omitBackground: true });
                // Dateiname im ZIP: 00_Cover.png, 01_Januar.png, etc.
                const fileName = formatFileName(sheetId); 
                archive.append(buffer, { name: fileName });
            }
        }

        await archive.finalize();
        console.log('✅ Rendering fertig & ZIP gesendet.');

    } catch (error) {
        console.error('Fehler:', error);
        res.status(500).send('Rendering Fehler');
    } finally {
        await browser.close();
    }
});

// Hilfsfunktion für schöne Dateinamen im ZIP
function formatFileName(sheetId) {
    if(sheetId === 'sheet-cover') return '00_Cover.png';
    const num = parseInt(sheetId.split('-')[1]) + 1;
    return `${num.toString().padStart(2, '0')}_Monat.png`;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));
