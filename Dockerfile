# Wir starten mit einem schlanken Node-Image
FROM node:20-slim

# 1. Installiere Google Chrome Stable und Fonts
# Wir brauchen wget und gnupg, um Chrome zu holen.
# Außerdem installieren wir Schriftarten, damit dein Kalender nicht kaputt aussieht.
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
    && sh -c 'echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# 2. Arbeitsverzeichnis erstellen
WORKDIR /app

# 3. Dependencies installieren
COPY package*.json ./
# Wir überspringen den Chromium Download von Puppeteer, weil wir oben Chrome installiert haben
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

RUN npm install

# 4. Source Code kopieren
COPY . .

# 5. User wechseln (Sicherheit: Nicht als Root laufen lassen!)
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && mkdir -p /home/pptruser/Downloads \
    && chown -R pptruser:pptruser /home/pptruser \
    && chown -R pptruser:pptruser /app

USER pptruser

# 6. Server starten
CMD ["node", "server.js"]