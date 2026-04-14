const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
require('dotenv').config();

const User      = require('../models/user.model');
const Bike      = require('../models/bike.model');
const PromoCode = require('../models/promo.model');

const users = [
  {
    name:     'Super Admin',
    email:    'admin@bikerental.com',
    password: 'admin123',
    role:     'admin',
    phone:    '+91-9000000001',
  },
  {
    name:     'Staff Member',
    email:    'staff@bikerental.com',
    password: 'staff123',
    role:     'staff',
    phone:    '+91-9000000002',
  },
];

const bikes = [
  { name: 'Honda Activa 6G',   brand: 'Honda',   type: 'petrol-scooter', price_per_hour: 60,  price_per_day: 350,  location: 'Kolkata', description: 'India\'s most trusted petrol scooter. Smooth ride for daily commutes.' },
  { name: 'TVS Jupiter Classic',brand: 'TVS',    type: 'petrol-scooter', price_per_hour: 55,  price_per_day: 320,  location: 'Kolkata', description: 'Comfortable and fuel-efficient petrol scooter for city roads.' },
  { name: 'Ola S1 Pro',        brand: 'Ola',     type: 'e-scooter',      price_per_hour: 80,  price_per_day: 480,  location: 'Kolkata', description: 'High-performance electric scooter with 120km range per charge.' },
  { name: 'Ather 450X',        brand: 'Ather',   type: 'e-scooter',      price_per_hour: 85,  price_per_day: 500,  location: 'Kolkata', description: 'Smart electric scooter with fast charging and connected features.' },
  { name: 'Royal Enfield Meteor 350', brand: 'Royal Enfield', type: 'petrol-bike', price_per_hour: 120, price_per_day: 700, location: 'Kolkata', description: 'Iconic cruiser for long rides. Powerful 350cc engine.' },
  { name: 'Bajaj Pulsar NS200', brand: 'Bajaj',  type: 'petrol-bike',    price_per_hour: 100, price_per_day: 600,  location: 'Kolkata', description: 'Sporty naked streetfighter with liquid-cooled 200cc engine.' },
  { name: 'Kawasaki Ninja 300', brand: 'Kawasaki',type: 'premium-bike',  price_per_hour: 220, price_per_day: 1300, location: 'Kolkata', description: 'Entry-level supersport with aggressive styling and twin-cylinder power.' },
  { name: 'KTM Duke 390',      brand: 'KTM',     type: 'premium-bike',   price_per_hour: 250, price_per_day: 1500, location: 'Kolkata', description: 'High-revving premium streetfighter. Thrilling 373cc single-cylinder.' },
];

const promos = [
  {
    code:               'WELCOME20',
    discount_type:      'percent',
    discount_value:     20,
    min_booking_amount: 200,
    usage_limit:        100,
    expires_at:         new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  },
  {
    code:               'FLAT50',
    discount_type:      'flat',
    discount_value:     50,
    min_booking_amount: 300,
    usage_limit:        50,
    expires_at:         new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days
  },
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅  Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      User.deleteMany(),
      Bike.deleteMany(),
      PromoCode.deleteMany(),
    ]);
    console.log('🗑️   Cleared existing data');

    // Hash passwords manually (pre-save hook doesn't run with insertMany)
    const hashedUsers = await Promise.all(
      users.map(async (u) => ({
        ...u,
        password: await bcrypt.hash(u.password, 12),
      }))
    );

    await User.insertMany(hashedUsers);
    await Bike.insertMany(bikes);
    await PromoCode.insertMany(promos);

    console.log('🌱  Seeded:');
    console.log(`    👤  ${users.length} users`);
    console.log(`    🏍️  ${bikes.length} motorbikes`);
    console.log(`    🏷️   ${promos.length} promo codes`);
    console.log('\n📋  Login credentials:');
    console.log('    Admin → admin@bikerental.com / admin123');
    console.log('    Staff → staff@bikerental.com / staff123\n');

    process.exit(0);
  } catch (err) {
    console.error('❌  Seeder error:', err.message);
    process.exit(1);
  }
};

seed();
