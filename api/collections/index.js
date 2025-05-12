// api/collections/index.js - with count support
const { MongoClient } = require('mongodb');

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

  // Get the collection name from query params when using the index endpoint
  const collectionName = req.query.collectionName;
  
  if (!collectionName) {
    return res.status(400).json({ error: 'Collection name is required' });
  }

  try {
    const client = new MongoClient(process.env.MONGO_URI);
    await client.connect();
    
    const db = client.db();
    const collection = db.collection(collectionName);
    
    // Add query parameters support
    let query = {};
    if (req.query.filter) {
      try {
        query = JSON.parse(req.query.filter);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid filter format' });
      }
    }
    
    // Check if count parameter is provided
    if (req.query.count === 'true') {
      console.log("Getting count for collection:", collectionName);
      const count = await collection.countDocuments(query);
      await client.close();
      return res.status(200).json({ count });
    }
    
    // Removed pagination - will return all documents
    console.log("Retrieving all documents from collection:", collectionName);
    
    const documents = await collection.find(query).toArray();
    await client.close();
    
    res.status(200).json(documents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};