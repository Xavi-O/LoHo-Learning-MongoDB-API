// api/collections/[collectionName].js - with URL path filtering support
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

  // Get collection name and filter parameters from URL parameter (Vercel routing)
  const { collectionName, filterField, filterValue, id } = req.query;
  
  // Debug logging
  console.log("Request URL:", req.url);
  console.log("Query params:", req.query);
  console.log("Collection name:", collectionName);
  
  if (!collectionName) {
    return res.status(400).json({ error: 'Collection name is required' });
  }

  try {
    const client = new MongoClient(process.env.MONGO_URI);
    await client.connect();
    
    const db = client.db();
    const collection = db.collection(collectionName);

    // Initialize query object
    let query = {};
    
    // Check if we have filter parameters from URL path
    if (filterField && filterValue) {
      console.log(`Filtering ${collectionName} where ${filterField} = ${filterValue}`);
      query = { [filterField]: filterValue };
    }
    
    // If we have an id parameter, this takes precedence over other filters
    if (id) {
      console.log("Looking for specific document with ID:", id);
      const document = await collection.findOne({ _id: id });
      await client.close();
      
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      return res.status(200).json(document);
    }
    
    // Apply any JSON filter from query parameter if present (this can be combined with URL path filters)
    if (req.query.filter) {
      try {
        const jsonFilter = JSON.parse(req.query.filter);
        // Merge with existing query
        query = { ...query, ...jsonFilter };
      } catch (e) {
        return res.status(400).json({ error: 'Invalid filter format' });
      }
    }
    
    // Check if count parameter is provided
    if (req.query.count === 'true') {
      console.log("Getting count for collection with filter:", query);
      const count = await collection.countDocuments(query);
      await client.close();
      return res.status(200).json({ count });
    }
    
    // Will return all documents matching the query
    console.log("Final Query:", query);
    console.log("Retrieving filtered documents");
    
    const documents = await collection.find(query).toArray();
    await client.close();
    
    console.log("Found", documents.length, "documents");
    res.status(200).json(documents);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
};