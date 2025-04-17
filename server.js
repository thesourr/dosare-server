const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const xml2js = require('xml2js');
const https = require('https');

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// 🔵 Agent HTTPS care acceptă toate certificatele (pentru portal.just.ro)
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

app.get('/', (req, res) => {
  res.send('Serverul SOAP 1.2 este online!');
});

app.post('/cauta-dosar', async (req, res) => {
  const { numarDosar } = req.body;

  if (!numarDosar) {
    return res.status(400).json({ error: 'Lipsește numărul dosarului.' });
  }

  const soapEnvelope = `
  <?xml version="1.0" encoding="utf-8"?>
  <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                   xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                   xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
    <soap12:Body>
      <CautareDosare2 xmlns="http://portalquery.just.ro/Query">
        <numarDosar>${numarDosar}</numarDosar>
        <obiectDosar xsi:nil="true" />
        <numeParte xsi:nil="true" />
      </CautareDosare2>
    </soap12:Body>
  </soap12:Envelope>`;

  try {
    const response = await fetch('https://portalquery.just.ro/Query.asmx', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8'
      },
      body: soapEnvelope,
      agent: httpsAgent
    });

    const textResponse = await response.text();

    console.log("🔵 XML primit de la portal.just.ro:");
    console.log(textResponse);

    const parser = new xml2js.Parser({ explicitArray: false });
    parser.parseString(textResponse, (err, result) => {
      if (err) {
        console.error("❌ Eroare la parsarea XML:", err);
        return res.status(500).json({ error: 'Eroare la parsarea XML.' });
      }

      try {
        const body = result['soap:Envelope']['soap:Body'];

        if (body['soap:Fault']) {
          const faultString = body['soap:Fault']['faultstring'] || "Eroare necunoscută SOAP.";
          return res.status(500).json({ error: `Eroare SOAP: ${faultString}` });
        }

        const responseElement = body['CautareDosare2Response'];
        const dosareResult = responseElement['CautareDosare2Result'];

        if (!dosareResult || !dosareResult.Dosar) {
          return res.status(404).json({ error: 'Dosar inexistent sau date lipsă.' });
        }

        const dosar = dosareResult.Dosar;
        const stadiu = dosar.stadiuProcesual || '-';

        let termen = '-';
        let solutie = '-';

        if (dosar.sedinte) {
          const sedinte = Array.isArray(dosar.sedinte) ? dosar.sedinte : [dosar.sedinte];
          const ultimaSedinta = sedinte[sedinte.length - 1];
          if (ultimaSedinta.data) {
            termen = ultimaSedinta.data.split('T')[0];
          }
          if (ultimaSedinta.solutieSumar) {
            solutie = ultimaSedinta.solutieSumar;
          } else if (ultimaSedinta.solutie) {
            solutie = ultimaSedinta.solutie;
          }
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
    return res.status(500).json({ error: 'Eroare la conectare portal.just.ro.' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Serverul SOAP 1.2 rulează pe portul ${PORT}`);
});
