const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const xml2js = require('xml2js');
const https = require('https');

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// 🔵 Agent HTTPS care acceptă toate certificatele SSL
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

app.get('/', (req, res) => {
  res.send('✅ Server SOAP 1.2 adaptat după PortalWSClient este online!');
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

    console.log("🔵 XML brut primit:");
    console.log(textResponse);

    const parser = new xml2js.Parser({ explicitArray: false });
    parser.parseString(textResponse, (err, result) => {
      if (err) {
        console.error("❌ Eroare parsare XML:", err);
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

        // 🔵 Extragem date principale
        const stadiu = dosar.stadiuProcesual || '-';
        const obiectDosar = dosar.obiectDosar || '-';
        const materie = dosar.materie || '-';
        const submaterie = dosar.submaterie || '-';
        const dataUltimeiModificari = dosar.dataUltimeiModificari || '-';

        // 🔵 Extragem lista de sedinte
        let sedinte = [];
        if (dosar.sedinte) {
          const listaSedinte = Array.isArray(dosar.sedinte) ? dosar.sedinte : [dosar.sedinte];
          sedinte = listaSedinte.map(s => ({
            data: s.data || '-',
            ora: s.ora || '-',
            solutieSumar: s.solutieSumar || '-',
            solutie: s.solutie || '-',
            complet: s.complet || '-',
            documentSedinta: s.documentSedinta || '-'
          }));
        }

        // 🔵 Extragem lista de parti
        let parti = [];
        if (dosar.parti) {
          const listaParti = Array.isArray(dosar.parti) ? dosar.parti : [dosar.parti];
          parti = listaParti.map(p => ({
            nume: p.nume || '-',
            calitateParte: p.calitateParte || '-'
          }));
        }

        return res.json({
          numarDosar: dosar.numarDosar || '-',
          stadiu: stadiu,
          obiectDosar: obiectDosar,
          materie: materie,
          submaterie: submaterie,
          dataUltimeiModificari: dataUltimeiModificari,
          sedinte: sedinte,
          parti: parti
        });

      } catch (parseError) {
        console.error("❌ Eroare extragere date:", parseError);
        return res.status(500).json({ error: 'Eroare extragere date din răspuns.' });
      }
    });

  } catch (fetchError) {
    console.error("❌ Eroare fetch:", fetchError);
    return res.status(500).json({ error: 'Eroare la conectare portal.just.ro.' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Serverul SOAP 1.2 complet rulează pe portul ${PORT}`);
});
