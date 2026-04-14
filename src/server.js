const app = require('./app');
const connectDB = require('./config/db');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

// Connect to MongoDB then start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚲  Bike Rental API running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    console.log(`📡  http://localhost:${PORT}/api\n`);
  });
});
