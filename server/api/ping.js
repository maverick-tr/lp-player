const express = require('express');
const ping = require('ping');
const router = express.Router();

router.get('/api/ping', async (req, res) => {
  const { ip } = req.query;
  
  try {
    const result = await ping.promise.probe(ip);
    res.json({ isAlive: result.alive });
  } catch (error) {
    console.error('Ping failed:', error);
    res.json({ isAlive: false });
  }
});

module.exports = router; 