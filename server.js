// ------------------------------------------------------
//  IMPORTS
// ------------------------------------------------------
const express = require("express");
const mysql = require("mysql2");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const app = express();

app.use(express.json());
app.use(cors());
app.use("/uploads", express.static("uploads"));  // Host uploaded files


// ------------------------------------------------------
//  BASE URL FOR UPLOADED FILES
// ------------------------------------------------------
const BASE_URL = "https://school-erp-zhpk.onrender.com/uploads/";


// ------------------------------------------------------
//  CONNECT MYSQL (Railway ENV Variables)
// ------------------------------------------------------
const mysql = require("mysql");

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
});

db.connect((err) => {
    if (err) {
        console.log("DB Connection Error:", err);
    } else {
        console.log("MySQL Connected Successfully!");
    }
});

module.exports = db;


// ------------------------------------------------------
//  MULTER STORAGE
// ------------------------------------------------------
const storage = multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage });


// ------------------------------------------------------
//  LOGIN
// ------------------------------------------------------
app.post("/login", (req, res) => {
    const { email, password, role } = req.body;

    const sql = "SELECT * FROM users WHERE email = ? AND role = ?";
    db.query(sql, [email, role], (err, rows) => {
        if (err) return res.json({ error: err });

        if (rows.length === 0) {
            return res.json({ success: false, message: "Invalid email or role" });
        }

        const user = rows[0];

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


// ------------------------------------------------------
//  ADD STUDENT
// ------------------------------------------------------
app.post("/add_student", (req, res) => {
    const { name, email, phone, cls, pass } = req.body;

    const sql = "INSERT INTO students (name, email, phone, class, password) VALUES (?, ?, ?, ?, ?)";
    db.query(sql, [name, email, phone, cls, pass], (err) => {
        if (err) return res.json({ error: err });
        res.json({ message: "Student Added" });
    });
});


// ------------------------------------------------------
//  ADD TEACHER
// ------------------------------------------------------
app.post("/add_teacher", (req, res) => {
    const { name, email, phone, pass } = req.body;

    const sql = "INSERT INTO teachers (name, email, phone, password) VALUES (?, ?, ?, ?)";
    db.query(sql, [name, email, phone, pass], (err) => {
        if (err) return res.json({ error: err });
        res.json({ message: "Teacher Added" });
    });
});


// ------------------------------------------------------
//  UPLOAD EVENT
// ------------------------------------------------------
app.post("/upload_event", upload.single("image"), (req, res) => {
    if (!req.file) return res.json({ error: "Image missing" });

    const imageUrl = BASE_URL + req.file.filename;

    const sql = "INSERT INTO events (title, description, image, time) VALUES (?, ?, ?, ?)";
    db.query(sql, [req.body.title, req.body.desc, imageUrl, Date.now()], (err) => {
        if (err) return res.json({ error: err });
        res.json({ message: "Event Uploaded!" });
    });
});


// ------------------------------------------------------
//  UPLOAD GALLERY
// ------------------------------------------------------
app.post("/upload_gallery", upload.array("images", 10), (req, res) => {
    if (!req.files) return res.json({ error: "Images missing" });

    const values = req.files.map(f => [BASE_URL + f.filename, Date.now()]);

    const sql = "INSERT INTO gallery (imageUrl, time) VALUES ?";
    db.query(sql, [values], (err) => {
        if (err) return res.json({ error: err });
        res.json({ message: "Gallery Uploaded!" });
    });
});


// ------------------------------------------------------
//  UPLOAD NOTES
// ------------------------------------------------------
app.post("/upload_notes", upload.single("pdf"), (req, res) => {
    const pdfUrl = BASE_URL + req.file.filename;

    const sql = "INSERT INTO notes (class, title, pdfUrl, time) VALUES (?, ?, ?, ?)";
    db.query(sql, [req.body.cls, req.body.title, pdfUrl, Date.now()], (err) => {
        if (err) return res.json({ error: err });
        res.json({ message: "Notes Uploaded!" });
    });
});


// ------------------------------------------------------
//  UPLOAD TIMETABLE
// ------------------------------------------------------
app.post("/upload_timetable", upload.single("pdf"), (req, res) => {
    const pdfUrl = BASE_URL + req.file.filename;

    const sql = "INSERT INTO timetable (class, pdfUrl, time) VALUES (?, ?, ?)";
    db.query(sql, [req.body.cls, pdfUrl, Date.now()], (err) => {
        if (err) return res.json({ error: err });
        res.json({ message: "Timetable Uploaded!" });
    });
});


// ------------------------------------------------------
//  START SERVER
// ------------------------------------------------------
app.listen(3000, "0.0.0.0", () => {
    console.log("Server running on Render");
});

