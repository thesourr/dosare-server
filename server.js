const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Serverul de dosare web-scraping este online!');
});

app.post('/cauta-dosar', async (req, res) => {
  const { numarDosar } = req.body;

  if (!numarDosar) {
    return res.status(400).json({ error: 'Lipsește numărul dosarului.' });
  }

  const searchUrl = `https://portal.just.ro/SitePages/portal.aspx`;

  try {
    const response = await fetch(`${searchUrl}?k=${encodeURIComponent(numarDosar)}`);
    const html = await response.text();

    const $ = cheerio.load(html);

    // Căutăm rezultatul dosarului
    const tabelRezultate = $('table.rgMasterTable'); // tabelul unde apare rezultatul

    if (!tabelRezultate.length) {
      return res.status(404).json({ error: 'Dosar inexistent sau pagina modificată.' });
    }

    // Extragem primul rând din tabelul de rezultate
    const primulRand = tabelRezultate.find('tbody tr').first();

    if (!primulRand.length) {
      return res.status(404).json({ error: 'Dosar găsit dar fără date disponibile.' });
    }

    const coloane = primulRand.find('td');
    const numar = $(coloane[0]).text().trim();
    const dataUltimTermen = $(coloane[4]).text().trim(); // Depinde de structură
    const stadiu = $(coloane[3]).text().trim();
    const solutie = $(coloane[6]).text().trim(); // De obicei coloana Soluție

    return res.json({
      numarDosar: numar,
      termen: dataUltimTermen || '-',
      stadiu: stadiu || '-',
      solutie: solutie || '-'
    });

  } catch (error) {
    console.error("❌ Eroare la fetch sau parsare:", error);
    return res.status(500).json({ error: 'Eroare la căutare sau parsare date.' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Serverul web-scraping rulează pe portul ${PORT}`);
});
