/**
 * server.js
 * Express backend that proxies selected feeds and returns JSON for the frontend.
 *
 * Endpoints:
 *  GET /api/earthquakes   -> USGS all_day GeoJSON
 *  GET /api/tsunami       -> Parsed tsunami.gov ATOM feed (entries)
 *  GET /api/volcanoes     -> Parsed Smithsonian GVP "current eruptions" snippet
 *  GET /api/floods        -> ReliefWeb quick search for "flood"
 *
 * Notes:
 *  - This file uses axios for HTTP, cheerio for HTML parsing, xml2js for ATOM parsing.
 *  - Run: npm install, then npm start
 */
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const xml2js = require('xml2js');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

// 1) Earthquakes - USGS GeoJSON (all earthquakes past day)
app.get('/api/earthquakes', async (req, res) => {
  try {
    const url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';
    const r = await axios.get(url, { timeout: 10000 });
    return res.json({ ok: true, source: 'usgs', data: r.data });
  } catch (err) {
    console.error('earthquakes error', err.message);
    return res.status(500).json({ ok: false, error: 'Failed to fetch earthquakes' });
  }
});

// 2) Tsunami - parse tsunami.gov ATOM feed (NTWC/PTWC feeds available)
app.get('/api/tsunami', async (req, res) => {
  try {
    // NTWC Atom feed (example). You can switch to PTWC feed if wanted.
    const atomUrl = 'https://www.tsunami.gov/events/xml/PAAQAtom.xml';
    const r = await axios.get(atomUrl, { timeout: 10000 });
    const parser = new xml2js.Parser({ explicitArray: false });
    const parsed = await parser.parseStringPromise(r.data);
    // parsed.feed.entry may be single or array
    const entries = parsed.feed && parsed.feed.entry ? (Array.isArray(parsed.feed.entry) ? parsed.feed.entry : [parsed.feed.entry]) : [];
    const out = entries.map(e => ({
      id: e.id,
      title: e.title,
      updated: e.updated,
      summary: e.summary && e.summary._ ? e.summary._ : (e.summary || ''),
      link: (Array.isArray(e.link) ? e.link[0].$.href : (e.link && e.link.$ && e.link.$.href) || '')
    }));
    return res.json({ ok: true, source: 'tsunami.gov', data: out });
  } catch (err) {
    console.error('tsunami error', err.message);
    return res.status(500).json({ ok: false, error: 'Failed to fetch tsunami feed' });
  }
});

// 3) Volcanoes - scrape a small summary from Smithsonian Global Volcanism Program "current eruptions"
app.get('/api/volcanoes', async (req, res) => {
  try {
    const url = 'https://volcano.si.edu/gvp_currenteruptions.cfm';
    const r = await axios.get(url, { timeout: 10000 });
    const $ = cheerio.load(r.data);
    // The page lists volcanoes; attempt to get first 6 items from the list/table shown
    const eruptions = [];
    // Look for common patterns: table rows or list items
    $('table tr').each((i, tr) => {
      if (eruptions.length >= 8) return;
      const tds = $(tr).find('td');
      if (tds.length >= 1) {
        const name = $(tds[0]).text().trim();
        if (!name) return;
        const status = $(tds[1]).text().trim();
        eruptions.push({ name, status });
      }
    });
    // Fallback: if none found, try other selectors
    if (eruptions.length === 0) {
      $('li').each((i, li) => {
        if (eruptions.length >= 8) return;
        const text = $(li).text().trim();
        if (text.length > 10) eruptions.push({ name: text.substring(0, 60), status: '' });
      });
    }
    return res.json({ ok: true, source: 'gvp', data: eruptions.slice(0, 8) });
  } catch (err) {
    console.error('volcanoes error', err.message);
    return res.status(500).json({ ok: false, error: 'Failed to fetch volcano info' });
  }
});

// 4) Floods - sample ReliefWeb API call searching for "flood"
app.get('/api/floods', async (req, res) => {
  try {
    // ReliefWeb v2 API quick search; appname param requested by reliefweb docs.
    const api = 'https://api.reliefweb.int/v2/reports';
    const r = await axios.get(api, {
      params: {
        appname: 'rtddr-demo', // recommended by ReliefWeb docs
        limit: 6,
        sort: 'date:desc',
        // quick query searching "flood"
        query: JSON.stringify({ query: { value: 'flood', operator: 'OR' } })
      },
      timeout: 12000
    });
    return res.json({ ok: true, source: 'reliefweb', data: r.data });
  } catch (err) {
    console.error('floods error', err.message);
    return res.status(500).json({ ok: false, error: 'Failed to fetch flood reports' });
  }
});

// 5) Simple status/ping
app.get('/api/ping', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.listen(PORT, () => {
  console.log(`Realtime Disaster server running on http://localhost:${PORT}`);
});
