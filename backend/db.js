const fs   = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'students.json');

function readDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify({ students: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function findStudent(email) {
  const { students } = readDB();
  return students.find(s => s.email === email.toLowerCase()) || null;
}

function createStudent({ fullName, dob, email, zalo, goal }) {
  const db = readDB();
  const student = {
    id:        Date.now().toString(),
    fullName,
    dob,
    email:     email.toLowerCase(),
    zalo,
    goal,
    password:  null,
    paid:      false,
    paidAt:    null,
    activated: false,
    createdAt: new Date().toISOString()
  };
  db.students.push(student);
  writeDB(db);
  return student;
}

function activateStudent(email) {
  const db = readDB();
  const idx = db.students.findIndex(s => s.email === email.toLowerCase());
  if (idx === -1) return null;
  db.students[idx].paid      = true;
  db.students[idx].paidAt    = new Date().toISOString();
  db.students[idx].activated = true;
  // Auto-generate temp password = last 6 digits of phone or random
  if (!db.students[idx].password) {
    db.students[idx].password = Math.random().toString(36).slice(-8);
  }
  writeDB(db);
  return db.students[idx];
}

function setPassword(email, hashedPassword) {
  const db = readDB();
  const idx = db.students.findIndex(s => s.email === email.toLowerCase());
  if (idx === -1) return null;
  db.students[idx].password = hashedPassword;
  writeDB(db);
  return db.students[idx];
}

module.exports = { findStudent, createStudent, activateStudent, setPassword, readDB };
