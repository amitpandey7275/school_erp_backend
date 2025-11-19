// ----------------------- IMPORTS ----------------------------
require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const multer = require("multer");
const path = require("path");
const app = express();

app.use(express.json());
app.use("/uploads", express.static("uploads"));   // Image/PDF folder


// ----------------------- DATABASE (Railway) ----------------------------
const db = mysql.createConnection({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT
});


console.log("DEBUG => MYSQLHOST =", process.env.MYSQLHOST);
console.log("DEBUG => MYSQLPORT =", process.env.MYSQLPORT);
console.log("DEBUG => MYSQLUSER =", process.env.MYSQLUSER);
console.log("DEBUG => MYSQLPASSWORD =", process.env.MYSQLPASSWORD);
console.log("DEBUG => MYSQLDATABASE =", process.env.MYSQLDATABASE);


db.connect(err => {
    if (err) {
        console.log("DB Connection Error:", err);
    } else {
        console.log("MySQL Connected Successfully!");
    }
});

// ----------------------- MULTER CONFIG ----------------------------
const storage = multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage });
const uploadNotes = multer({ storage });
const uploadTimeTable = multer({ storage });


// ----------------------- REGISTER ----------------------------
app.post("/register", (req, res) => {
    const { name, email, password, role } = req.body;

    const sql = "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)";

    db.query(sql, [name, email, password, role], (err, result) => {
        if (err) return res.status(500).json({ error: err });

        res.json({ message: "User Registered", userId: result.insertId });
    });
});


// ----------------------- LOGIN ----------------------------
app.post("/login", (req, res) => {
    const { email, password, role } = req.body;

    const sql = "SELECT * FROM users WHERE email = ? AND role = ?";

    db.query(sql, [email, role], (err, results) => {
        if (err) return res.status(500).json({ error: err });

        if (results.length === 0) {
            return res.json({ success: false, message: "Invalid email or role" });
        }

        const user = results[0];

        if (user.password !== password) {
            return res.json({ success: false, message: "Invalid password" });
        }

        res.json({
            success: true,
            id: user.id,
            name: user.name,
            role: user.role
        });
    });
});

// ----------------------- ADD STUDENT ----------------------------
app.post("/add_student", (req, res) => {
    const { name, email, phone, cls, pass } = req.body;

    const sql = "INSERT INTO students (name, email, phone, class, password) VALUES (?, ?, ?, ?, ?)";

    db.query(sql, [name, email, phone, cls, pass], (err, result) => {
        if (err) return res.status(500).json({ error: err });

        res.json({ message: "Student Added!" });
    });
});


// ----------------------- ADD TEACHER ----------------------------
app.post("/add_teacher", (req, res) => {
    const { name, email, phone, pass } = req.body;

    const sql = "INSERT INTO teachers (name, email, phone, password) VALUES (?, ?, ?, ?)";

    db.query(sql, [name, email, phone, pass], (err, result) => {
        if (err) return res.status(500).json({ error: err });

        res.json({ message: "Teacher Added!" });
    });
});


// ----------------------- START SERVER ----------------------------
app.listen(3000, "0.0.0.0", () => {
    console.log("Server running on port 3000");
});

