const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const xml2js = require('xml2js');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// Test simplu să vedem dacă serverul e online
app.get('/', (req, res) => {
  res.send('Serverul de dosare este online!');
});

// Funcția principală de căutare dosar
app.post('/cauta-dosar', async (req, res) => {
  const { numarDosar } = req.body;

  if (!numarDosar) {
    return res.status(400).json({ error: 'Lipseste numarul dosarului.' });
  }

  const soapEnvelope = `
    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                   xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                   xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>
        <CautareDosare xmlns="http://portalquery.just.ro/Query">
          <numarDosar>${numarDosar}</numarDosar>
          <obiectDosar></obiectDosar>
          <numeParte></numeParte>
        </CautareDosare>
      </soap:Body>
    </soap:Envelope>`;

  try {
    const response = await fetch('http://portalquery.just.ro/Query.asmx', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://portalquery.just.ro/Query/CautareDosare'
      },
      body: soapEnvelope
    });

    const textResponse = await response.text();
    
    // 🔵 LOG NOU: vedem exact XML-ul brut primit de la portal.just.ro
    console.log("🔵 XML primit de la portal.just.ro:");
    console.log(textResponse);

    const parser = new xml2js.Parser({ explicitArray: false });

    parser.parseString(textResponse, (err, result) => {
      if (err) {
        console.error("❌ Eroare la parsarea XML:", err);
        return res.status(500).json({ error: 'Eroare la parsarea XML.' });
      }

      try {
        const dosareResult = result['soap:Envelope']['soap:Body']['CautareDosareResponse']['CautareDosareResult'];

        if (!dosareResult || !dosareResult.Dosar) {
          return res.status(404).json({ error: 'Dosar inexistent.' });
        }

        const dosar = dosareResult.Dosar;
        const stadiu = dosar.stadiuProcesual || '-';

        let termen = '-';
        let solutie = '-';

        if (dosar.sedinte && Array.isArray(dosar.sedinte)) {
          const sedinta = dosar.sedinte[dosar.sedinte.length - 1]; // ultima ședință
          termen = sedinta.data ? sedinta.data.split('T')[0] : '-';
          solutie = sedinta.solutieSumar || sedinta.solutie || '-';
        } else if (dosar.sedinte && typeof dosar.sedinte === 'object') {
          // Dacă există o singură ședință (nu array)
          const sedinta = dosar.sedinte;
          termen = sedinta.data ? sedinta.data.split('T')[0] : '-';
          solutie = sedinta.solutieSumar || sedinta.solutie || '-';
        }

        return res.json({
          termen: termen,
          stadiu: stadiu,
          solutie: solutie
        });

      } catch (parseError) {
        console.error("❌ Eroare la extragerea datelor:", parseError);
        return res.status(500).json({ error: 'Eroare la extragerea datelor.' });
      }
    });

  } catch (fetchError) {
    console.error("❌ Eroare la conectare cu portal.just.ro:", fetchError);
    return res.status(500).json({ error: 'Eroare la conectare portal.just.ro' });
  }
});

// Pornim serverul
app.listen(PORT, () => {
  console.log(`✅ Serverul rulează pe portul ${PORT}`);
});
