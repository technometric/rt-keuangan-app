const mongoose = require('mongoose');

async function connectDB() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://192.168.1.9:27017/rt_keuangan_app';
  try {
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected:', mongoUri);
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
}

module.exports = connectDB;
