const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const xml2js = require('xml2js');

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Serverul de dosare este online!');
});

app.post('/cauta-dosar', async (req, res) => {
  const { numarDosar } = req.body;

  if (!numarDosar) {
    return res.status(400).json({ error: 'Lipseste numarul dosarului.' });
  }

  const soapEnvelope = `
  <?xml version="1.0" encoding="utf-8"?>
  <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                 xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                 xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
      <CautareDosare xmlns="http://portalquery.just.ro/Query">
        <numarDosar>${numarDosar}</numarDosar>
        <obiectDosar xsi:nil="true"/>
        <numeParte xsi:nil="true"/>
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
          const faultString = body['soap:Fault']['faultstring'] || "Eroare necunoscuta SOAP.";
          return res.status(500).json({ error: `Eroare SOAP: ${faultString}` });
        }

        const responseElement = body['CautareDosareResponse'];
        const dosareResult = responseElement['CautareDosareResult'];

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
  console.log(`✅ Serverul rulează pe portul ${PORT}`);
});
