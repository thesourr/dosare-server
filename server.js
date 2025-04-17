const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const xml2js = require('xml2js');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
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
    const parser = new xml2js.Parser({ explicitArray: false });

    parser.parseString(textResponse, (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Eroare la parsarea XML.' });
      }

      try {
        const dosare = result['soap:Envelope']['soap:Body']['CautareDosareResponse']['CautareDosareResult']['Dosar'];

        if (!dosare) {
          return res.status(404).json({ error: 'Dosar inexistent.' });
        }

        const stadiu = dosare.stadiuProcesual || '-';

        let termen = '-';
        let solutie = '-';

        if (dosare.sedinte && dosare.sedinte.length) {
          const sedinta = dosare.sedinte[dosare.sedinte.length - 1]; // ultima sedinta
          termen = sedinta.data ? sedinta.data.split('T')[0] : '-';
          solutie = sedinta.solutieSumar || sedinta.solutie || '-';
        }

        return res.json({
          termen: termen,
          stadiu: stadiu,
          solutie: solutie
        });

      } catch (parseError) {
        return res.status(500).json({ error: 'Eroare la extragerea datelor.' });
      }
    });

  } catch (fetchError) {
    return res.status(500).json({ error: 'Eroare la conectare portal.just.ro' });
  }
});

app.listen(PORT, () => {
  console.log(`Serverul rulează pe portul ${PORT}`);
});