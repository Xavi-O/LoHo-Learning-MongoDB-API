// mongodb-middleware-api.js
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for Power BI requests
app.use(cors());

// Middleware for basic authentication
const basicAuth = require('express-basic-auth');
app.use(basicAuth({
  users: { [process.env.API_USERNAME]: process.env.API_PASSWORD },
  challenge: true
}));

// MongoDB connection string - stored in environment variable
const mongoConnectionString = process.env.MONGO_URI;

if (!mongoConnectionString) {
  console.error("MongoDB connection string is missing. Please set MONGO_URI.");
  process.exit(1);
}

// API endpoint to get all documents from a collection
app.get('/api/collections/:collectionName', async (req, res) => {
  try {
    const client = new MongoClient(mongoConnectionString);
    await client.connect();
    
    const db = client.db();
    const collection = db.collection(req.params.collectionName);
    
    // Add query parameters support
    let query = {};
    if (req.query.filter) {
      try {
        query = JSON.parse(req.query.filter);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid filter format' });
      }
    }
    
    // Add pagination
    const limit = parseInt(req.query.limit) || 1000;
    const skip = parseInt(req.query.skip) || 0;
    
    const documents = await collection.find(query).skip(skip).limit(limit).toArray();
    await client.close();
    
    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all collection names
app.get('/api/collections', async (req, res) => {
  try {
    const client = new MongoClient(mongoConnectionString);
    await client.connect();
    
    const db = client.db();
    const collections = await db.listCollections().toArray();
    await client.close();
    
    res.json(collections.map(c => c.name));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific document by ID
app.get('/api/collections/:collectionName/:id', async (req, res) => {
  try {
    const client = new MongoClient(mongoConnectionString);
    await client.connect();
    
    const db = client.db();
    const collection = db.collection(req.params.collectionName);
    
    const document = await collection.findOne({ _id: req.params.id });
    await client.close();
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    res.json(document);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`API server running on port ${port}`);
});
