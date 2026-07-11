import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

const dbDir = path.join(process.env.APPDATA, "pos");
if (!fs.existsSync(dbDir)) {
  console.error("DB folder not found:", dbDir);
  process.exit(1);
}

const dbPath = path.join(dbDir, "pos.db");
const db = new Database(dbPath);

function makeId() {
  return randomUUID();
}

function timestamp() {
  return new Date().toISOString();
}

const now = timestamp();

const vendors = [
  { name: "Khan Flour Mills", phone: "03214567890", address: "Main Bazaar, Lahore", mill_name: "Khan Mills" },
  { name: "Al-Rahman Traders", phone: "03001234567", address: "GT Road, Rawalpindi", mill_name: "Al-Rahman Mill" },
  { name: "Sindh Supply Co.", phone: "03129876543", address: "Saddar, Karachi", mill_name: "Sindh Supply" },
  { name: "Bhatti Brothers", phone: "03335551234", address: "Hall Road, Lahore", mill_name: "Bhatti Bros Mill" },
  { name: "Peshawar Grain Market", phone: "03456667890", address: "Qissa Khwani Bazar, Peshawar", mill_name: "PK Grain" },
  { name: "Multan Food Supply", phone: "03012223344", address: "Hussain Agahi Bazar, Multan", mill_name: "Multan Foods" },
  { name: "Faisalabad Flour House", phone: "03118889900", address: "D Ground, Faisalabad", mill_name: "FF House" },
  { name: "Quetta Traders", phone: "03221110099", address: "Jinnah Road, Quetta", mill_name: "Quetta Trading" },
  { name: "Abbottabad Supply", phone: "03432225566", address: "Mansehra Road, Abbottabad", mill_name: "Abbt Supply" },
  { name: "Gujranwala Grain Co.", phone: "03097778811", address: "GT Road, Gujranwala", mill_name: "Gujranwala GC" },
];

const customers = [
  { name: "Ahmed Raza", phone: "03001112233", address: "Model Town, Lahore", shop_name: "Ahmed General Store" },
  { name: "Fatima Bibi", phone: "03214445566", address: "DHA Phase 5, Lahore", shop_name: "Fatima Kirana" },
  { name: "Usman Ghani", phone: "03337778899", address: "Satellite Town, Rawalpindi", shop_name: "Usman Traders" },
  { name: "Sanaullah Khan", phone: "03121002003", address: "Sadder, Peshawar", shop_name: "Sana Mart" },
  { name: "Bilal Ahmed", phone: "03005556677", address: "Gulshan-e-Iqbal, Karachi", shop_name: "Bilal Wholesale" },
  { name: "Ayesha Malik", phone: "03458889900", address: "F-8, Islamabad", shop_name: "Ayesha Mini Market" },
  { name: "Tariq Mehmood", phone: "03213334455", address: "Bosan Road, Multan", shop_name: "Tariq & Sons" },
  { name: "Nadia Parveen", phone: "03116667788", address: "Dijkot Road, Faisalabad", shop_name: "Nadia Department Store" },
  { name: "Hassan Javed", phone: "03332221100", address: "Satellite Town, Gujranwala", shop_name: "Hassan Mega Mart" },
  { name: "Zainab Fatima", phone: "03099998877", address: "Jinnah Road, Quetta", shop_name: "Zainab General Store" },
  { name: "Imran Shah", phone: "03431112233", address: "Mansoorabad, Hyderabad", shop_name: "Imran Traders" },
  { name: "Rukhsana Khatun", phone: "03224445566", address: "Bannu Road, Kohat", shop_name: "Rukhsana Store" },
  { name: "Asif Nawaz", phone: "03017778899", address: "Chowk Bazaar, Sialkot", shop_name: "Asif Wholesale" },
  { name: "Maryam Bibi", phone: "03110001122", address: "Main Market, Abbottabad", shop_name: "Maryam Mart" },
  { name: "Shahid Afridi", phone: "03335556600", address: "Bara Kahu, Islamabad", shop_name: "Shahid Super Store" },
];

const insertVendor = db.prepare(`
  INSERT INTO vendors (id, name, phone, address, mill_name, created_at, updated_at, synced)
  VALUES (?, ?, ?, ?, ?, ?, ?, 0)
`);

const insertCustomer = db.prepare(`
  INSERT INTO customers (id, name, phone, address, shop_name, created_at, updated_at, synced)
  VALUES (?, ?, ?, ?, ?, ?, ?, 0)
`);

const insertVendors = db.transaction((rows) => {
  for (const v of rows) {
    insertVendor.run(makeId(), v.name, v.phone, v.address, v.mill_name, now, now);
  }
});

const insertCustomers = db.transaction((rows) => {
  for (const c of rows) {
    insertCustomer.run(makeId(), c.name, c.phone, c.address, c.shop_name, now, now);
  }
});

console.log("Seeding vendors...");
insertVendors(vendors);
console.log(`  Inserted ${vendors.length} vendors`);

console.log("Seeding customers...");
insertCustomers(customers);
console.log(`  Inserted ${customers.length} customers`);

db.close();
console.log("Done!");
