// api/collections.js - for listing all collections
const { MongoClient } = require('mongodb');
const basicAuth = require('express-basic-auth');

// Helper for auth middleware
const authenticateRequest = (req, res) => {
  // Basic auth implementation
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Basic ')) {
    res.statusCode = 401;
    res.setHeader('WWW-Authenticate', 'Basic');
    res.end('Unauthorized');
    return false;
  }

  const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
  const username = auth[0];
  const password = auth[1];

  if (username !== process.env.API_USERNAME || password !== process.env.API_PASSWORD) {
    res.statusCode = 401;
    res.setHeader('WWW-Authenticate', 'Basic');
    res.end('Unauthorized');
    return false;
  }
  
  return true;
};

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  
  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only handle GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Authenticate request
  if (!authenticateRequest(req, res)) return;

  try {
    const client = new MongoClient(process.env.MONGO_URI);
    await client.connect();
    
    const db = client.db();
    const collections = await db.listCollections().toArray();
    await client.close();
    
    // Check if count parameter is provided
    if (req.query.count === 'true') {
      return res.status(200).json({ count: collections.length });
    }
    
    // Return collection names as before
    res.status(200).json(collections.map(c => c.name));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};